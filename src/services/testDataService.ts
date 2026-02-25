/**
 * Test Data Service — dev mode only.
 * Provides realistic hardcoded/generated data for UI testing.
 * Nothing here is ever saved to localStorage or the cloud.
 */
import type {
  Expense,
  Income,
  RecurringExpense,
  RecurringIncome,
  RecurringIncomeOverride,
} from "./storageService";

// ── Static recurring data ─────────────────────────────────────────────────────
export const TEST_RECURRING_EXPENSES: RecurringExpense[] = [
  {
    id: "test-re-1",
    amount: "950.00",
    description: "Rent",
    frequency: "monthly",
    startDate: "2024-01-01",
    dayOfMonth: 1,
  },
  {
    id: "test-re-2",
    amount: "15.99",
    description: "Netflix",
    frequency: "monthly",
    startDate: "2024-01-01",
    dayOfMonth: 5,
  },
  {
    id: "test-re-3",
    amount: "29.00",
    description: "Phone Bill",
    frequency: "monthly",
    startDate: "2024-01-01",
    dayOfMonth: 10,
  },
  {
    id: "test-re-4",
    amount: "35.00",
    description: "Gym Membership",
    frequency: "monthly",
    startDate: "2024-01-01",
    dayOfMonth: 15,
  },
  {
    id: "test-re-5",
    amount: "45.00",
    description: "Internet & Cable",
    frequency: "monthly",
    startDate: "2024-01-01",
    dayOfMonth: 3,
  },
  {
    id: "test-re-6",
    amount: "12.99",
    description: "Spotify",
    frequency: "monthly",
    startDate: "2024-06-01",
    dayOfMonth: 7,
  },
  {
    id: "test-re-7",
    amount: "8.99",
    description: "Cloud Storage",
    frequency: "monthly",
    startDate: "2025-01-01",
    dayOfMonth: 20,
  },
];

export const TEST_RECURRING_INCOMES: RecurringIncome[] = [
  {
    id: "test-ri-1",
    amount: "3200.00",
    description: "Monthly Salary",
    frequency: "monthly",
    startDate: "2024-01-01",
    dayOfMonth: 25,
  },
  {
    id: "test-ri-2",
    amount: "420.00",
    description: "Freelance Work",
    frequency: "monthly",
    startDate: "2025-04-01",
    dayOfMonth: 28,
  },
];

export const TEST_INITIAL_BALANCE = 5000;

// ── Deterministic seeded PRNG (LCG) ──────────────────────────────────────────
function seededRand(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = Math.imul(s, 1664525) + 1013904223;
    return (s >>> 0) / 0xffffffff;
  };
}

// ── One-time expense templates ────────────────────────────────────────────────
const EXP_TEMPLATES: { desc: string; base: number; prob: number }[] = [
  { desc: "Groceries", base: 88, prob: 1.0 },
  { desc: "Grocery Run", base: 64, prob: 0.9 },
  { desc: "Weekly Shop", base: 72, prob: 0.85 },
  { desc: "Dining Out", base: 42, prob: 0.8 },
  { desc: "Restaurant", base: 68, prob: 0.55 },
  { desc: "Takeaway", base: 26, prob: 0.75 },
  { desc: "Coffee & Snacks", base: 18, prob: 0.9 },
  { desc: "Public Transport", base: 45, prob: 0.85 },
  { desc: "Fuel", base: 72, prob: 0.65 },
  { desc: "Parking", base: 14, prob: 0.5 },
  { desc: "Clothing", base: 98, prob: 0.35 },
  { desc: "Shoes", base: 85, prob: 0.2 },
  { desc: "Pharmacy", base: 24, prob: 0.5 },
  { desc: "Doctor Visit", base: 55, prob: 0.18 },
  { desc: "Home Supplies", base: 52, prob: 0.5 },
  { desc: "Cleaning Products", base: 22, prob: 0.6 },
  { desc: "Entertainment", base: 38, prob: 0.55 },
  { desc: "Cinema", base: 24, prob: 0.4 },
  { desc: "Haircut", base: 28, prob: 0.45 },
  { desc: "Books", base: 32, prob: 0.3 },
  { desc: "Gift", base: 48, prob: 0.22 },
  { desc: "Electronics", base: 130, prob: 0.12 },
  { desc: "Sport Equipment", base: 75, prob: 0.1 },
  { desc: "Weekend Trip", base: 195, prob: 0.18 },
];

// ── One-time income templates ─────────────────────────────────────────────────
const INC_TEMPLATES: { desc: string; base: number; prob: number }[] = [
  { desc: "Cashback Reward", base: 18, prob: 0.3 },
  { desc: "Sold Items Online", base: 72, prob: 0.18 },
  { desc: "Tax Refund", base: 820, prob: 0.06 },
  { desc: "Side Project Payment", base: 360, prob: 0.12 },
  { desc: "Referral Bonus", base: 50, prob: 0.1 },
  { desc: "Yearly Performance Bonus", base: 1500, prob: 0.04 },
  { desc: "Quarterly Bonus", base: 600, prob: 0.06 },
];

// ── Specific future transactions (Mar–May 2026) ───────────────────────────────
const FUTURE_EXPENSES: Expense[] = [
  { date: "2026-03-08", amount: "320.00", description: "Spring Clothing Haul" },
  {
    date: "2026-03-22",
    amount: "180.00",
    description: "Weekend Trip Amsterdam",
  },
  {
    date: "2026-04-06",
    amount: "95.00",
    description: "Easter Groceries & Supplies",
  },
  {
    date: "2026-04-19",
    amount: "240.00",
    description: "Easter Holiday Travel",
  },
  { date: "2026-05-10", amount: "75.00", description: "Dentist Appointment" },
  {
    date: "2026-05-25",
    amount: "550.00",
    description: "Summer Vacation Deposit (yearly)",
  },
];

const FUTURE_INCOMES: Income[] = [
  {
    date: "2026-03-15",
    amount: "300.00",
    description: "Freelance Project Payment",
  },
  { date: "2026-04-25", amount: "600.00", description: "Quarterly Bonus" },
  { date: "2026-05-01", amount: "120.00", description: "Cashback & Rewards" },
];

// ── Generate monthly one-time transactions ────────────────────────────────────
function generateMonth(
  ym: string,
  monthIndex: number,
  cutAtToday: boolean,
): { expenses: Expense[]; incomes: Income[] } {
  const rand = seededRand(monthIndex * 31337 + 99991);
  const [y, m] = ym.split("-").map(Number) as [number, number];
  const daysInMonth = new Date(y, m, 0).getDate();
  const today = new Date().toISOString().slice(0, 10);

  const expenses: Expense[] = [];
  const incomes: Income[] = [];

  for (const t of EXP_TEMPLATES) {
    if (rand() < t.prob) {
      const day = Math.floor(rand() * daysInMonth) + 1;
      const date = `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      if (cutAtToday && date > today) continue;
      const variation = 0.75 + rand() * 0.5;
      expenses.push({
        amount: (t.base * variation).toFixed(2),
        description: t.desc,
        date,
      });
    } else {
      rand(); // consume roll for consistent downstream seeds
    }
  }

  for (const t of INC_TEMPLATES) {
    if (rand() < t.prob) {
      const day = Math.floor(rand() * daysInMonth) + 1;
      const date = `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      if (cutAtToday && date > today) continue;
      const variation = 0.85 + rand() * 0.3;
      incomes.push({
        amount: (t.base * variation).toFixed(2),
        description: t.desc,
        date,
      });
    } else {
      rand();
    }
  }

  return { expenses, incomes };
}

// ── Build full transaction set (1 year history + 3 months future) ─────────────
function buildTransactions(): { expenses: Expense[]; incomes: Income[] } {
  const now = new Date();
  const allExpenses: Expense[] = [];
  const allIncomes: Income[] = [];

  // 13 months: 12 full history months + current partial month
  for (let i = 12; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const isCurrentMonth = i === 0;
    const { expenses, incomes } = generateMonth(ym, 12 - i, isCurrentMonth);
    allExpenses.push(...expenses);
    allIncomes.push(...incomes);
  }

  // 3 future months
  for (let i = 1; i <= 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const { expenses, incomes } = generateMonth(ym, 13 + i, false);
    allExpenses.push(...expenses);
    allIncomes.push(...incomes);
  }

  // Add hardcoded future specifics
  allExpenses.push(...FUTURE_EXPENSES);
  allIncomes.push(...FUTURE_INCOMES);

  // Sort by date
  allExpenses.sort((a, b) => a.date.localeCompare(b.date));
  allIncomes.sort((a, b) => a.date.localeCompare(b.date));

  return { expenses: allExpenses, incomes: allIncomes };
}

// Computed once per session
let _cache: { expenses: Expense[]; incomes: Income[] } | null = null;
function getCache() {
  if (!_cache) _cache = buildTransactions();
  return _cache;
}

// ── Recurring calculation helpers (mirror storageService logic) ───────────────
function calcRecurringExpenses(yearMonth: string): Expense[] {
  const [y, m] = yearMonth.split("-").map(Number) as [number, number];
  const monthStart = new Date(y, m - 1, 1);
  const monthEnd = new Date(y, m, 0);
  const result: Expense[] = [];

  for (const rec of TEST_RECURRING_EXPENSES) {
    const startDate = new Date(rec.startDate);
    const endDate = rec.endDate ? new Date(rec.endDate) : null;
    if (startDate > monthEnd || (endDate && endDate < monthStart)) continue;

    switch (rec.frequency) {
      case "daily":
        for (let day = 1; day <= monthEnd.getDate(); day++) {
          const d = new Date(y, m - 1, day);
          if (d >= startDate && (!endDate || d <= endDate))
            result.push({
              amount: rec.amount,
              description: `${rec.description} (Recurring)`,
              date: d.toISOString().slice(0, 10),
            });
        }
        break;
      case "weekly":
        for (let day = 1; day <= monthEnd.getDate(); day++) {
          const d = new Date(y, m - 1, day);
          if (
            d.getDay() === rec.dayOfWeek &&
            d >= startDate &&
            (!endDate || d <= endDate)
          )
            result.push({
              amount: rec.amount,
              description: `${rec.description} (Recurring)`,
              date: d.toISOString().slice(0, 10),
            });
        }
        break;
      case "monthly": {
        const targetDay = Math.min(rec.dayOfMonth ?? 1, monthEnd.getDate());
        const d = new Date(y, m - 1, targetDay);
        if (d >= startDate && (!endDate || d <= endDate))
          result.push({
            amount: rec.amount,
            description: `${rec.description} (Recurring)`,
            date: d.toISOString().slice(0, 10),
          });
        break;
      }
      case "yearly": {
        const recMonth = startDate.getMonth() + 1;
        if (recMonth === m) {
          const d = new Date(y, m - 1, startDate.getDate());
          if (d >= startDate && (!endDate || d <= endDate))
            result.push({
              amount: rec.amount,
              description: `${rec.description} (Recurring)`,
              date: d.toISOString().slice(0, 10),
            });
        }
        break;
      }
    }
  }
  return result;
}

function calcRecurringIncomes(yearMonth: string): Income[] {
  const [y, m] = yearMonth.split("-").map(Number) as [number, number];
  const monthStart = new Date(y, m - 1, 1);
  const monthEnd = new Date(y, m, 0);
  const result: Income[] = [];

  for (const rec of TEST_RECURRING_INCOMES) {
    const startDate = new Date(rec.startDate);
    const endDate = rec.endDate ? new Date(rec.endDate) : null;
    if (startDate > monthEnd || (endDate && endDate < monthStart)) continue;

    switch (rec.frequency) {
      case "daily":
        for (let day = 1; day <= monthEnd.getDate(); day++) {
          const d = new Date(y, m - 1, day);
          if (d >= startDate && (!endDate || d <= endDate))
            result.push({
              amount: rec.amount,
              description: `${rec.description} (Recurring)`,
              date: d.toISOString().slice(0, 10),
            });
        }
        break;
      case "weekly":
        for (let day = 1; day <= monthEnd.getDate(); day++) {
          const d = new Date(y, m - 1, day);
          if (
            d.getDay() === rec.dayOfWeek &&
            d >= startDate &&
            (!endDate || d <= endDate)
          )
            result.push({
              amount: rec.amount,
              description: `${rec.description} (Recurring)`,
              date: d.toISOString().slice(0, 10),
            });
        }
        break;
      case "monthly": {
        const targetDay = Math.min(rec.dayOfMonth ?? 1, monthEnd.getDate());
        const d = new Date(y, m - 1, targetDay);
        if (d >= startDate && (!endDate || d <= endDate))
          result.push({
            amount: rec.amount,
            description: `${rec.description} (Recurring)`,
            date: d.toISOString().slice(0, 10),
          });
        break;
      }
      case "yearly": {
        const recMonth = startDate.getMonth() + 1;
        if (recMonth === m) {
          const d = new Date(y, m - 1, startDate.getDate());
          if (d >= startDate && (!endDate || d <= endDate))
            result.push({
              amount: rec.amount,
              description: `${rec.description} (Recurring)`,
              date: d.toISOString().slice(0, 10),
            });
        }
        break;
      }
    }
  }
  return result;
}

// ── Public API (mirrors storageService read interface) ────────────────────────
export const testDataService = {
  loadExpenses(): Expense[] {
    return getCache().expenses;
  },
  loadIncomes(): Income[] {
    return getCache().incomes;
  },
  loadRecurringExpenses(): RecurringExpense[] {
    return TEST_RECURRING_EXPENSES;
  },
  loadRecurringIncomes(): RecurringIncome[] {
    return TEST_RECURRING_INCOMES;
  },
  loadRecurringIncomeOverrides(): RecurringIncomeOverride[] {
    return [];
  },
  getInitialBalance(): number {
    return TEST_INITIAL_BALANCE;
  },
  calculateRecurringExpensesForMonth(yearMonth: string): Expense[] {
    return calcRecurringExpenses(yearMonth);
  },
  calculateRecurringIncomesForMonth(yearMonth: string): Income[] {
    return calcRecurringIncomes(yearMonth);
  },
};
