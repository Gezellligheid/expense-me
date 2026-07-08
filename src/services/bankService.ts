import { auth } from "./firebaseService";
import { storageService, type Expense, type Income } from "./storageService";

export interface Aspsp {
  name: string;
  country: string;
  bic?: string;
  logo?: string;
}

export interface BankAccount {
  uid: string;
  name?: string;
  iban?: string;
  currency?: string;
}

export interface BankStatus {
  connected: boolean;
  aspspName?: string;
  aspspCountry?: string;
  accounts?: BankAccount[];
  connectedAt?: string;
}

async function authHeader(): Promise<Record<string, string>> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Not signed in");
  return { Authorization: `Bearer ${token}` };
}

async function readError(res: Response, fallback: string): Promise<string> {
  const data = await res.json().catch(() => null);
  return (data as { error?: string } | null)?.error ?? fallback;
}

export const bankService = {
  async listAspsps(country?: string): Promise<Aspsp[]> {
    const qs = country ? `?country=${encodeURIComponent(country)}` : "";
    const res = await fetch(`/api/bank/aspsps${qs}`);
    if (!res.ok) throw new Error(await readError(res, "Failed to load bank list"));
    const data = await res.json();
    return data.aspsps as Aspsp[];
  },

  /** Starts the bank auth flow and returns the URL to redirect the browser to. */
  async connect(aspspName: string, aspspCountry: string): Promise<string> {
    const res = await fetch("/api/bank/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeader()) },
      body: JSON.stringify({ aspspName, aspspCountry }),
    });
    if (!res.ok) throw new Error(await readError(res, "Failed to start bank connection"));
    const data = await res.json();
    return data.url as string;
  },

  /** Exchanges the code/state from the bank redirect for a stored connection. */
  async exchange(code: string, state: string): Promise<void> {
    const res = await fetch("/api/bank/exchange", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeader()) },
      body: JSON.stringify({ code, state }),
    });
    if (!res.ok) throw new Error(await readError(res, "Failed to complete bank connection"));
  },

  async status(): Promise<BankStatus> {
    const res = await fetch("/api/bank/status", { headers: await authHeader() });
    if (!res.ok) throw new Error(await readError(res, "Failed to load bank status"));
    return res.json();
  },

  async disconnect(): Promise<void> {
    const res = await fetch("/api/bank/disconnect", {
      method: "POST",
      headers: await authHeader(),
    });
    if (!res.ok) throw new Error(await readError(res, "Failed to disconnect bank"));
  },

  /** Pulls new transactions, dedupes against existing externalIds, and saves them locally. */
  async syncNow(): Promise<{ imported: number; skipped: number }> {
    const res = await fetch("/api/bank/sync", {
      method: "POST",
      headers: await authHeader(),
    });
    if (!res.ok) throw new Error(await readError(res, "Failed to sync bank transactions"));

    const { expenses, incomes } = (await res.json()) as {
      expenses: Expense[];
      incomes: Income[];
    };

    const existingExpenseIds = new Set(
      storageService
        .loadExpenses()
        .map((e) => e.externalId)
        .filter((id): id is string => Boolean(id)),
    );
    const existingIncomeIds = new Set(
      storageService
        .loadIncomes()
        .map((i) => i.externalId)
        .filter((id): id is string => Boolean(id)),
    );

    const newExpenses = expenses.filter((e) => !existingExpenseIds.has(e.externalId!));
    const newIncomes = incomes.filter((i) => !existingIncomeIds.has(i.externalId!));

    if (newExpenses.length > 0) storageService.saveExpenses(newExpenses);
    if (newIncomes.length > 0) storageService.saveIncomes(newIncomes);

    const imported = newExpenses.length + newIncomes.length;
    const skipped = expenses.length + incomes.length - imported;
    return { imported, skipped };
  },
};
