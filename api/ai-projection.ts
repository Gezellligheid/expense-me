import type { VercelRequest, VercelResponse } from "@vercel/node";
import Groq from "groq-sdk";

// Simple in-memory rate limiter (reset on cold start; primary guard is the client)
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW = 60_000;
const aiRequestTimestamps: number[] = [];

function checkRateLimit(): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  while (
    aiRequestTimestamps.length > 0 &&
    aiRequestTimestamps[0]! < now - RATE_LIMIT_WINDOW
  ) {
    aiRequestTimestamps.shift();
  }
  if (aiRequestTimestamps.length >= RATE_LIMIT_MAX) {
    const retryAfter = Math.ceil(
      (aiRequestTimestamps[0]! + RATE_LIMIT_WINDOW - now) / 1000,
    );
    return { allowed: false, retryAfter };
  }
  aiRequestTimestamps.push(now);
  return { allowed: true, retryAfter: 0 };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const rl = checkRateLimit();
  if (!rl.allowed) {
    res.setHeader("Retry-After", String(rl.retryAfter));
    res
      .status(429)
      .json({ error: "Rate limit exceeded", retryAfter: rl.retryAfter });
    return;
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "GROQ_API_KEY not configured" });
    return;
  }

  try {
    const {
      expenses = [],
      incomes = [],
      recurringExpenses = [],
      recurringIncomes = [],
      initialBalance = 0,
      forecastStartMonth,
      forecastMonths = 60,
    } = req.body as {
      expenses: { date: string; amount: string; description?: string }[];
      incomes: { date: string; amount: string; description?: string }[];
      recurringExpenses: {
        amount: string;
        description: string;
        frequency: string;
        startDate: string;
        endDate?: string;
        dayOfMonth?: number;
        dayOfWeek?: number;
      }[];
      recurringIncomes: {
        amount: string;
        description: string;
        frequency: string;
        startDate: string;
        endDate?: string;
        dayOfMonth?: number;
        dayOfWeek?: number;
      }[];
      initialBalance: number;
      forecastStartMonth: string;
      forecastMonths: number;
    };

    // Use up to the past 2 years of historical data
    const now = new Date();
    const twoYearsAgo = new Date(
      now.getFullYear() - 2,
      now.getMonth(),
      now.getDate(),
    );
    const cutoffDate = twoYearsAgo.toISOString().slice(0, 10);
    const today = now.toISOString().slice(0, 10);

    const allDates = [
      ...expenses.map((e) => e.date),
      ...incomes.map((i) => i.date),
    ].sort();
    const earliestDate = allDates[0] ?? cutoffDate;
    const cutoff = earliestDate > cutoffDate ? earliestDate : cutoffDate;

    // Split: past transactions (historical patterns) vs future one-time scheduled events
    const allRecentExpenses = expenses.filter((e) => e.date >= cutoff);
    const allRecentIncomes = incomes.filter((i) => i.date >= cutoff);

    const pastExpenses = allRecentExpenses.filter((e) => e.date < today);
    const pastIncomes = allRecentIncomes.filter((i) => i.date < today);
    const futureOneTimeExpenses = allRecentExpenses.filter(
      (e) => e.date >= today,
    );
    const futureOneTimeIncomes = allRecentIncomes.filter(
      (i) => i.date >= today,
    );

    const clampedMonths = Math.min(Math.max(forecastMonths, 1), 60);

    // ── Build explicit list of forecast month labels (YYYY-MM) ─────────────
    const forecastMonthLabels: string[] = [];
    {
      const [fsy, fsm] = forecastStartMonth.split("-").map(Number) as [
        number,
        number,
      ];
      let y = fsy,
        m = fsm;
      for (let i = 0; i < clampedMonths; i++) {
        forecastMonthLabels.push(`${y}-${String(m).padStart(2, "0")}`);
        m++;
        if (m > 12) {
          m = 1;
          y++;
        }
      }
    }

    // ── Pre-compute monthly equivalent for each recurring item ─────────────
    const DAYS_PER_MONTH = 30.4375;
    const WEEKS_PER_MONTH = DAYS_PER_MONTH / 7;

    function monthlyEquivalent(amount: string, frequency: string): number {
      const amt = parseFloat(amount);
      switch (frequency) {
        case "daily":
          return amt * DAYS_PER_MONTH;
        case "weekly":
          return amt * WEEKS_PER_MONTH;
        case "monthly":
          return amt;
        case "yearly":
          return amt / 12;
        default:
          return amt;
      }
    }

    const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    function summariseRecurring(items: typeof recurringExpenses) {
      return items.map((r) => ({
        description: r.description,
        frequency: r.frequency,
        amountPerOccurrence: parseFloat(r.amount),
        monthlyEquivalent: +monthlyEquivalent(r.amount, r.frequency).toFixed(2),
        activeFrom: r.startDate,
        activeTo: r.endDate ?? "ongoing",
        ...(r.dayOfMonth ? { dayOfMonth: r.dayOfMonth } : {}),
        ...(r.dayOfWeek !== undefined
          ? { dayOfWeek: DAY_NAMES[r.dayOfWeek] }
          : {}),
      }));
    }

    const recurringExpSummary = summariseRecurring(recurringExpenses);
    const recurringIncSummary = summariseRecurring(recurringIncomes);

    const totalRecurringInc = recurringIncSummary.reduce(
      (s, r) => s + r.monthlyEquivalent,
      0,
    );
    const totalRecurringExp = recurringExpSummary.reduce(
      (s, r) => s + r.monthlyEquivalent,
      0,
    );
    const baseRecurringNet = totalRecurringInc - totalRecurringExp;

    // ── Estimate baseline variable spending from past data ─────────────────
    type TxItem = { date: string; amount: string; description?: string };

    function monthlyTotals(items: TxItem[]): Record<string, number> {
      const out: Record<string, number> = {};
      for (const item of items) {
        const ym = item.date.slice(0, 7);
        out[ym] = (out[ym] ?? 0) + parseFloat(item.amount);
      }
      return out;
    }

    const pastExpByMonth = monthlyTotals(pastExpenses);

    const pastExpMonthVals = Object.values(pastExpByMonth);
    const avgMonthlyVarExp =
      pastExpMonthVals.length > 0
        ? +(
            pastExpMonthVals.reduce((a, b) => a + b, 0) /
            pastExpMonthVals.length
          ).toFixed(2)
        : null;
    const histDataMonths = pastExpMonthVals.length;

    // Group future one-time events by YYYY-MM
    const futureExpByMonth: Record<string, { amount: number; desc: string }[]> =
      {};
    for (const e of futureOneTimeExpenses) {
      const ym = e.date.slice(0, 7);
      if (!futureExpByMonth[ym]) futureExpByMonth[ym] = [];
      futureExpByMonth[ym]!.push({
        amount: parseFloat(e.amount),
        desc: e.description ?? "",
      });
    }
    const futureIncByMonth: Record<string, { amount: number; desc: string }[]> =
      {};
    for (const i of futureOneTimeIncomes) {
      const ym = i.date.slice(0, 7);
      if (!futureIncByMonth[ym]) futureIncByMonth[ym] = [];
      futureIncByMonth[ym]!.push({
        amount: parseFloat(i.amount),
        desc: i.description ?? "",
      });
    }

    // ── Compute deterministic net per forecast month (server-side) ───────────
    // Recurring cash flows + one-time events are computed exactly here.
    // Groq is only asked for the variable (day-to-day) spending part.
    function isActiveInMonth(
      activeFrom: string,
      activeTo: string,
      ym: string,
    ): boolean {
      if (activeFrom.slice(0, 7) > ym) return false;
      if (activeTo === "ongoing") return true;
      return activeTo.slice(0, 7) >= ym;
    }

    const deterministicNets: number[] = forecastMonthLabels.map((ym) => {
      const recInc = recurringIncSummary
        .filter((r) => isActiveInMonth(r.activeFrom, r.activeTo, ym))
        .reduce((s, r) => s + r.monthlyEquivalent, 0);
      const recExp = recurringExpSummary
        .filter((r) => isActiveInMonth(r.activeFrom, r.activeTo, ym))
        .reduce((s, r) => s + r.monthlyEquivalent, 0);
      const oneTimeInc = (futureIncByMonth[ym] ?? []).reduce(
        (s, e) => s + e.amount,
        0,
      );
      const oneTimeExp = (futureExpByMonth[ym] ?? []).reduce(
        (s, e) => s + e.amount,
        0,
      );
      return recInc + oneTimeInc - recExp - oneTimeExp;
    });

    // Seasonal multipliers by calendar month index (0=Jan … 11=Dec)
    const SEASONAL = [
      0.9, 0.95, 1.0, 1.0, 1.0, 1.12, 1.18, 1.18, 1.0, 1.0, 1.1, 1.45,
    ];

    const varExpBase =
      avgMonthlyVarExp ??
      Math.max(200, Math.min(500, totalRecurringInc * 0.15));

    function fallbackVarExp(i: number): number {
      const ym = forecastMonthLabels[i]!;
      const monthIdx = parseInt(ym.slice(5, 7), 10) - 1;
      const inflation = Math.pow(1.003, i);
      const seasonal = SEASONAL[monthIdx] ?? 1.0;
      const noise = 1 + (((i * 7 + 3) % 17) - 8) / 80;
      return +(varExpBase * seasonal * inflation * noise).toFixed(2);
    }

    // ── Ask Groq only for variable expense per month ────────────────────────
    const pastTxSummary =
      pastExpenses.length > 0
        ? `Recent irregular expense transactions (past ${histDataMonths} month(s)):\n` +
          pastExpenses
            .slice(-40)
            .map(
              (e) =>
                `  ${e.date} €${parseFloat(e.amount).toFixed(2)} ${e.description ?? "(no description)"}`,
            )
            .join("\n")
        : "No past expense transactions available.";

    const pastIncSummary =
      pastIncomes.length > 0
        ? `Recent irregular income transactions (past ${histDataMonths} month(s)):\n` +
          pastIncomes
            .slice(-40)
            .map(
              (i) =>
                `  ${i.date} €${parseFloat(i.amount).toFixed(2)} ${i.description ?? "(no description)"}`,
            )
            .join("\n")
        : "No past income transactions available.";

    const varExpContext =
      histDataMonths >= 2
        ? `Based on ${histDataMonths} months of real historical data:
- Past monthly expense totals by YYYY-MM: ${JSON.stringify(pastExpByMonth)}
- Average total past expenses: €${avgMonthlyVarExp}/month
- Individual past transactions:\n${pastTxSummary}`
        : `No reliable history yet.\n${pastTxSummary}`;

    const varExpBudgetHint =
      baseRecurringNet > 0
        ? `The person has ~€${baseRecurringNet.toFixed(0)}/month left after all recurring charges. Variable expenses must fit within this budget.`
        : `After recurring charges the budget is tight (net: €${baseRecurringNet.toFixed(0)}/month). Estimate conservatively.`;

    const futureExpSummary =
      futureOneTimeExpenses.length > 0
        ? futureOneTimeExpenses
            .map(
              (e) =>
                `  ${e.date} €${parseFloat(e.amount).toFixed(2)} ${e.description ?? "(no description)"}`,
            )
            .join("\n")
        : "None scheduled.";

    const futureIncSummary =
      futureOneTimeIncomes.length > 0
        ? futureOneTimeIncomes
            .map(
              (i) =>
                `  ${i.date} €${parseFloat(i.amount).toFixed(2)} ${i.description ?? "(no description)"}`,
            )
            .join("\n")
        : "None scheduled.";

    const prompt = `You are a financial assistant estimating variable day-to-day expenses for a personal budget forecast.

Variable expenses = groceries, dining, clothing, fuel, personal care, recreation, and other irregular unplanned day-to-day purchases.
Do NOT include: rent, subscriptions, insurance, loan repayments — those fixed costs are handled separately.

## FINANCIAL CONTEXT
Monthly recurring income: €${totalRecurringInc.toFixed(2)}
Monthly recurring expenses (rent, subscriptions, loans, insurance, etc.): €${totalRecurringExp.toFixed(2)}
Net after recurring charges: €${baseRecurringNet.toFixed(2)}/month
${varExpBudgetHint}

## HISTORICAL INCOME
${pastIncSummary}

## HISTORICAL SPENDING
${varExpContext}

## FUTURE ONE-TIME EXPENSES
These are already accounted for in the deterministic net — do NOT subtract them again. Use them only to understand the person's upcoming financial context and adjust variable spending behaviour if relevant (e.g. a big holiday trip may raise variable spending that month).
${futureExpSummary}

## FUTURE ONE-TIME INCOMES
These are already accounted for in the deterministic net — do NOT add them again. Use them only for context (e.g. a large bonus may loosen variable spending slightly).
${futureIncSummary}

## INSTRUCTIONS
- Base your estimate on the historical data above and the available budget context.
- If past data exists, use the individual transaction amounts and descriptions to calibrate the typical monthly variable spend.
- Pay close attention to period-related keywords in descriptions (e.g. "yearly", "annually", "quarterly", "seasonal", "one-time", "bonus", "tax", "holiday", "vacation") — these signal cyclical or exceptional items; do NOT spread them evenly but spike the relevant month(s) in each cycle.
- Apply seasonal patterns every year: Jan −10%, Feb −5%, Mar–May baseline, Jun–Aug +12–18%, Sep–Oct baseline, Nov +10%, Dec +40%
- Add natural random variation (±8%) so no two months are identical — avoid a straight line.
- For each subsequent year beyond the first, apply ~0.3%/month cumulative inflation.
- The estimated variable expense must be realistic for this person's specific budget.

Return a JSON array of EXACTLY ${clampedMonths} numbers.
Each number = estimated variable expense for that month (positive euros).
Month index 0 = ${forecastMonthLabels[0]}, index ${clampedMonths - 1} = ${forecastMonthLabels[forecastMonthLabels.length - 1]}.
Output ONLY the JSON array. No text, no markdown.`;

    const client = new Groq({ apiKey });
    const completion = await client.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.3-70b-versatile",
    });

    const text = (completion.choices[0]?.message?.content ?? "").trim();

    const jsonMatch = text.match(/\[[\s\S]*]/);
    let varExpenses: number[] = [];
    if (jsonMatch) {
      try {
        const parsed: unknown = JSON.parse(jsonMatch[0]);
        if (
          Array.isArray(parsed) &&
          parsed.length > 0 &&
          parsed.every((v) => typeof v === "number")
        ) {
          varExpenses = (parsed as number[]).slice(0, clampedMonths);
        }
      } catch {
        // fall through to fallback
      }
    }

    // Fill any missing months with the deterministic seasonal fallback
    for (let i = varExpenses.length; i < clampedMonths; i++) {
      varExpenses.push(fallbackVarExp(i));
    }

    // ── Build final running balance array ────────────────────────────────────
    const balances: number[] = [];
    let bal = initialBalance;
    for (let i = 0; i < clampedMonths; i++) {
      const varExp = varExpenses[i] ?? fallbackVarExp(i);
      bal += deterministicNets[i]! - varExp;
      balances.push(+bal.toFixed(2));
    }

    res.json({ startMonth: forecastStartMonth, balances, histDataMonths });
  } catch (err) {
    console.error("AI projection error:", err);
    res.status(500).json({ error: "Failed to generate AI projection" });
  }
}
