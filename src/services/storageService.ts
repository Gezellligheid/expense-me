import { pushToCloud, pushValueToCloud } from "./cloudSyncService";
import { simState } from "./simulationState";

// ── Helpers: write to localStorage AND mirror to Firestore ───────────────────
function lsSet(key: string, value: string): void {
  localStorage.setItem(key, value);
  // Suppress cloud push during simulation — changes are local-only until accepted
  if (!simState.active) {
    void pushToCloud(key, value);
  }
}

function lsClear(key: string, emptyValue: unknown = []): void {
  localStorage.removeItem(key);
  if (!simState.active) {
    void pushValueToCloud(key, emptyValue);
  }
}

export interface Expense {
  amount: string;
  description: string;
  date: string;
  excludeFromBudget?: boolean;
  _sim?: true;
}

export interface Income {
  amount: string;
  description: string;
  date: string;
  _sim?: true;
}

export interface RecurringExpense {
  id: string;
  amount: string;
  description: string;
  frequency: "daily" | "weekly" | "monthly" | "yearly";
  startDate: string;
  endDate?: string;
  dayOfMonth?: number; // For monthly (1-31)
  dayOfWeek?: number; // For weekly (0-6, Sun-Sat)
  _sim?: true;
}

export interface RecurringIncome {
  id: string;
  amount: string;
  description: string;
  frequency: "daily" | "weekly" | "monthly" | "yearly";
  startDate: string;
  endDate?: string;
  dayOfMonth?: number;
  dayOfWeek?: number;
  _sim?: true;
}

/** Per-month amount override for a recurring income entry. */
export interface RecurringIncomeOverride {
  recurringId: string;
  yearMonth: string; // YYYY-MM
  amount: string;
  _sim?: true;
}

/**
 * A manual balance correction at a specific date.
 * All balance calculations after this date start from `amount`.
 */
export interface BalanceUpdate {
  id: string;
  date: string; // YYYY-MM-DD
  amount: number;
  note?: string;
  /** Keys of same-day transactions that were NOT yet cleared when the correction was saved.
   *  These will still be applied to the balance after the correction anchor. */
  pendingKeys?: string[];
}

export const storageService = {
  // Expense operations
  loadExpenses(): Expense[] {
    const stored = localStorage.getItem("expenses");
    return stored ? JSON.parse(stored) : [];
  },

  saveExpenses(newExpenses: Expense[]): void {
    const existing = this.loadExpenses();
    const toSave = simState.active
      ? newExpenses.map((e) => ({ ...e, _sim: true as const }))
      : newExpenses;
    const combined = [...existing, ...toSave];
    // Sort by date, oldest to newest
    combined.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
    lsSet("expenses", JSON.stringify(combined));
    this.notifyStorageUpdate();
  },

  updateExpense(original: Expense, updated: Expense): void {
    const existing = this.loadExpenses();
    const idx = existing.findIndex(
      (e) =>
        e.date === original.date &&
        e.description === original.description &&
        e.amount === original.amount,
    );
    if (idx !== -1) {
      existing[idx] = { ...updated };
      existing.sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      );
      lsSet("expenses", JSON.stringify(existing));
      this.notifyStorageUpdate();
    }
  },

  deleteExpense(expense: Expense): void {
    const existing = this.loadExpenses();
    const idx = existing.findIndex(
      (e) =>
        e.date === expense.date &&
        e.description === expense.description &&
        e.amount === expense.amount,
    );
    if (idx !== -1) existing.splice(idx, 1);
    lsSet("expenses", JSON.stringify(existing));
    this.notifyStorageUpdate();
  },

  // Income operations
  loadIncomes(): Income[] {
    const stored = localStorage.getItem("incomes");
    return stored ? JSON.parse(stored) : [];
  },

  saveIncomes(newIncomes: Income[]): void {
    const existing = this.loadIncomes();
    const toSave = simState.active
      ? newIncomes.map((i) => ({ ...i, _sim: true as const }))
      : newIncomes;
    const combined = [...existing, ...toSave];
    // Sort by date, oldest to newest
    combined.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
    lsSet("incomes", JSON.stringify(combined));
    this.notifyStorageUpdate();
  },

  deleteIncome(income: Income): void {
    const existing = this.loadIncomes();
    const idx = existing.findIndex(
      (i) =>
        i.date === income.date &&
        i.description === income.description &&
        i.amount === income.amount,
    );
    if (idx !== -1) existing.splice(idx, 1);
    lsSet("incomes", JSON.stringify(existing));
    this.notifyStorageUpdate();
  },

  // Utility functions
  getTodayDate(): string {
    const today = new Date();
    return today.toISOString().split("T")[0]!;
  },

  notifyStorageUpdate(): void {
    window.dispatchEvent(new Event("storage-updated"));
  },

  // Recurring Expense operations
  loadRecurringExpenses(): RecurringExpense[] {
    const stored = localStorage.getItem("recurringExpenses");
    return stored ? JSON.parse(stored) : [];
  },

  saveRecurringExpense(recurring: RecurringExpense): void {
    const existing = this.loadRecurringExpenses();
    const toSave = simState.active
      ? { ...recurring, _sim: true as const }
      : recurring;
    existing.push(toSave);
    lsSet("recurringExpenses", JSON.stringify(existing));
    this.notifyStorageUpdate();
  },

  updateRecurringExpense(id: string, data: Omit<RecurringExpense, "id">): void {
    const existing = this.loadRecurringExpenses();
    const idx = existing.findIndex((r) => r.id === id);
    if (idx >= 0) {
      existing[idx] = { ...data, id };
      lsSet("recurringExpenses", JSON.stringify(existing));
      this.notifyStorageUpdate();
    }
  },

  deleteRecurringExpense(id: string): void {
    const existing = this.loadRecurringExpenses();
    const filtered = existing.filter((r) => r.id !== id);
    lsSet("recurringExpenses", JSON.stringify(filtered));
    this.notifyStorageUpdate();
  },

  // Recurring Income operations
  loadRecurringIncomes(): RecurringIncome[] {
    const stored = localStorage.getItem("recurringIncomes");
    return stored ? JSON.parse(stored) : [];
  },

  saveRecurringIncome(recurring: RecurringIncome): void {
    const existing = this.loadRecurringIncomes();
    const toSave = simState.active
      ? { ...recurring, _sim: true as const }
      : recurring;
    existing.push(toSave);
    lsSet("recurringIncomes", JSON.stringify(existing));
    this.notifyStorageUpdate();
  },

  /** Update a recurring income's base settings without touching its overrides. */
  updateRecurringIncome(id: string, data: Omit<RecurringIncome, "id">): void {
    const existing = this.loadRecurringIncomes();
    const idx = existing.findIndex((r) => r.id === id);
    if (idx >= 0) {
      existing[idx] = { ...data, id };
      lsSet("recurringIncomes", JSON.stringify(existing));
      this.notifyStorageUpdate();
    }
  },

  deleteRecurringIncome(id: string): void {
    const existing = this.loadRecurringIncomes();
    const filtered = existing.filter((r) => r.id !== id);
    lsSet("recurringIncomes", JSON.stringify(filtered));
    // Also remove all overrides for this income
    const overrides = this.loadRecurringIncomeOverrides().filter(
      (o) => o.recurringId !== id,
    );
    lsSet("recurringIncomeOverrides", JSON.stringify(overrides));
    this.notifyStorageUpdate();
  },

  // Recurring income override operations
  loadRecurringIncomeOverrides(): RecurringIncomeOverride[] {
    const stored = localStorage.getItem("recurringIncomeOverrides");
    return stored ? JSON.parse(stored) : [];
  },

  setRecurringIncomeOverride(
    recurringId: string,
    yearMonth: string,
    amount: string,
  ): void {
    const overrides = this.loadRecurringIncomeOverrides();
    const idx = overrides.findIndex(
      (o) => o.recurringId === recurringId && o.yearMonth === yearMonth,
    );
    if (idx >= 0) {
      overrides[idx]!.amount = amount;
    } else {
      overrides.push({ recurringId, yearMonth, amount });
    }
    lsSet("recurringIncomeOverrides", JSON.stringify(overrides));
    this.notifyStorageUpdate();
  },

  deleteRecurringIncomeOverride(recurringId: string, yearMonth: string): void {
    const overrides = this.loadRecurringIncomeOverrides().filter(
      (o) => !(o.recurringId === recurringId && o.yearMonth === yearMonth),
    );
    lsSet("recurringIncomeOverrides", JSON.stringify(overrides));
    this.notifyStorageUpdate();
  },

  // Balance update operations
  loadBalanceUpdates(): BalanceUpdate[] {
    const stored = localStorage.getItem("balanceUpdates");
    return stored ? JSON.parse(stored) : [];
  },

  saveBalanceUpdate(update: BalanceUpdate): void {
    const existing = this.loadBalanceUpdates();
    existing.push(update);
    existing.sort((a, b) => a.date.localeCompare(b.date));
    lsSet("balanceUpdates", JSON.stringify(existing));
    this.notifyStorageUpdate();
  },

  updateBalanceUpdate(id: string, data: Omit<BalanceUpdate, "id">): void {
    const existing = this.loadBalanceUpdates();
    const idx = existing.findIndex((u) => u.id === id);
    if (idx >= 0) {
      existing[idx] = { ...data, id };
      existing.sort((a, b) => a.date.localeCompare(b.date));
      lsSet("balanceUpdates", JSON.stringify(existing));
      this.notifyStorageUpdate();
    }
  },

  deleteBalanceUpdate(id: string): void {
    const existing = this.loadBalanceUpdates().filter((u) => u.id !== id);
    lsSet("balanceUpdates", JSON.stringify(existing));
    this.notifyStorageUpdate();
  },

  // Initial balance operations
  getInitialBalance(): number | null {
    const stored = localStorage.getItem("initialBalance");
    return stored ? parseFloat(stored) : null;
  },

  setInitialBalance(amount: number): void {
    // Clear all existing data when setting initial balance
    this.clearAll();
    lsSet("initialBalance", amount.toString());
    this.notifyStorageUpdate();
  },

  hasData(): boolean {
    return this.loadExpenses().length > 0 || this.loadIncomes().length > 0;
  },
  // Calculate recurring transactions for a specific month
  calculateRecurringExpensesForMonth(yearMonth: string): Expense[] {
    const recurring = this.loadRecurringExpenses();
    const parts = yearMonth.split("-").map(Number);
    const year = parts[0] as number;
    const month = parts[1] as number;
    const result: Expense[] = [];

    recurring.forEach((rec) => {
      const startDate = new Date(rec.startDate);
      const endDate = rec.endDate ? new Date(rec.endDate) : null;
      const monthStart = new Date(year, month - 1, 1);
      const monthEnd = new Date(year, month, 0);

      // Skip if recurring hasn't started yet or has ended
      if (startDate > monthEnd || (endDate && endDate < monthStart)) {
        return;
      }

      switch (rec.frequency) {
        case "daily":
          // Add daily expense for each day in the month
          for (let day = 1; day <= monthEnd.getDate(); day++) {
            const date = new Date(year, month - 1, day);
            if (date >= startDate && (!endDate || date <= endDate)) {
              result.push({
                amount: rec.amount,
                description: `${rec.description} (Recurring)`,
                date: date.toISOString().split("T")[0]!,
              });
            }
          }
          break;

        case "weekly":
          // Add weekly expense for each occurrence in the month
          for (let day = 1; day <= monthEnd.getDate(); day++) {
            const date = new Date(year, month - 1, day);
            if (
              date.getDay() === rec.dayOfWeek &&
              date >= startDate &&
              (!endDate || date <= endDate)
            ) {
              result.push({
                amount: rec.amount,
                description: `${rec.description} (Recurring)`,
                date: date.toISOString().split("T")[0]!,
              });
            }
          }
          break;

        case "monthly":
          // Add monthly expense once per month on specified day
          const dayOfMonth = rec.dayOfMonth || 1;
          const targetDay = Math.min(dayOfMonth, monthEnd.getDate());
          const date = new Date(year, month - 1, targetDay);
          if (date >= startDate && (!endDate || date <= endDate)) {
            result.push({
              amount: rec.amount,
              description: `${rec.description} (Recurring)`,
              date: date.toISOString().split("T")[0]!,
            });
          }
          break;

        case "yearly":
          // Add yearly expense if it falls in this month
          const recStartMonth = startDate.getMonth() + 1;
          const recStartDay = startDate.getDate();
          if (recStartMonth === month) {
            const date = new Date(year, month - 1, recStartDay);
            if (date >= startDate && (!endDate || date <= endDate)) {
              result.push({
                amount: rec.amount,
                description: `${rec.description} (Recurring)`,
                date: date.toISOString().split("T")[0]!,
              });
            }
          }
          break;
      }
    });

    return result;
  },

  calculateRecurringIncomesForMonth(yearMonth: string): Income[] {
    const recurring = this.loadRecurringIncomes();
    const overrides = this.loadRecurringIncomeOverrides();
    const parts2 = yearMonth.split("-").map(Number);
    const year = parts2[0] as number;
    const month = parts2[1] as number;
    const result: Income[] = [];

    recurring.forEach((rec) => {
      // Use the per-month override amount if one exists
      const override = overrides.find(
        (o) => o.recurringId === rec.id && o.yearMonth === yearMonth,
      );
      const effectiveAmount = override ? override.amount : rec.amount;
      const startDate = new Date(rec.startDate);
      const endDate = rec.endDate ? new Date(rec.endDate) : null;
      const monthStart = new Date(year, month - 1, 1);
      const monthEnd = new Date(year, month, 0);

      // Skip if recurring hasn't started yet or has ended
      if (startDate > monthEnd || (endDate && endDate < monthStart)) {
        return;
      }

      switch (rec.frequency) {
        case "daily":
          // Add daily income for each day in the month
          for (let day = 1; day <= monthEnd.getDate(); day++) {
            const date = new Date(year, month - 1, day);
            if (date >= startDate && (!endDate || date <= endDate)) {
              result.push({
                amount: effectiveAmount,
                description: `${rec.description} (Recurring)`,
                date: date.toISOString().split("T")[0]!,
              });
            }
          }
          break;

        case "weekly":
          // Add weekly income for each occurrence in the month
          for (let day = 1; day <= monthEnd.getDate(); day++) {
            const date = new Date(year, month - 1, day);
            if (
              date.getDay() === rec.dayOfWeek &&
              date >= startDate &&
              (!endDate || date <= endDate)
            ) {
              result.push({
                amount: effectiveAmount,
                description: `${rec.description} (Recurring)`,
                date: date.toISOString().split("T")[0]!,
              });
            }
          }
          break;

        case "monthly":
          // Add monthly income once per month on specified day
          const dayOfMonth = rec.dayOfMonth || 1;
          const targetDay = Math.min(dayOfMonth, monthEnd.getDate());
          const date = new Date(year, month - 1, targetDay);
          if (date >= startDate && (!endDate || date <= endDate)) {
            result.push({
              amount: effectiveAmount,
              description: `${rec.description} (Recurring)${override ? " ⚡" : ""}`,
              date: date.toISOString().split("T")[0]!,
            });
          }
          break;

        case "yearly":
          // Add yearly income if it falls in this month
          const recStartMonth = startDate.getMonth() + 1;
          const recStartDay = startDate.getDate();
          if (recStartMonth === month) {
            const date = new Date(year, month - 1, recStartDay);
            if (date >= startDate && (!endDate || date <= endDate)) {
              result.push({
                amount: effectiveAmount,
                description: `${rec.description} (Recurring)${override ? " ⚡" : ""}`,
                date: date.toISOString().split("T")[0]!,
              });
            }
          }
          break;
      }
    });

    return result;
  },

  // Clear all data (useful for testing or reset)
  clearAll(): void {
    lsClear("expenses", []);
    lsClear("incomes", []);
    lsClear("balanceUpdates", []);
    this.notifyStorageUpdate();
  },

  /** Wipe only one-off transactions (expenses + incomes). Recurring & balance kept. */
  resetTransactions(): void {
    lsClear("expenses", []);
    lsClear("incomes", []);
    this.notifyStorageUpdate();
  },

  /** Wipe all recurring rules and overrides. One-off transactions kept. */
  resetRecurring(): void {
    lsClear("recurringExpenses", []);
    lsClear("recurringIncomes", []);
    lsClear("recurringIncomeOverrides", []);
    this.notifyStorageUpdate();
  },

  /** Full factory reset — clears everything. */
  resetAllData(): void {
    lsClear("expenses", []);
    lsClear("incomes", []);
    lsClear("recurringExpenses", []);
    lsClear("recurringIncomes", []);
    lsClear("recurringIncomeOverrides", []);
    lsClear("balanceUpdates", []);
    lsClear("initialBalance", null);
    this.notifyStorageUpdate();
  },
};
