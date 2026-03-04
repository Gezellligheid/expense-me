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

    // Build a YYYY-MM-DD string from numeric parts — avoids UTC/local timezone shift
    const ymd = (y: number, mo: number, d: number): string =>
      `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

    const daysInMonth = new Date(year, month, 0).getDate();
    const monthStartStr = ymd(year, month, 1);
    const monthEndStr = ymd(year, month, daysInMonth);

    recurring.forEach((rec) => {
      const startStr = rec.startDate;
      const endStr = rec.endDate ?? null;

      // Skip if recurring hasn't started yet or has ended
      if (startStr > monthEndStr || (endStr && endStr < monthStartStr)) {
        return;
      }

      switch (rec.frequency) {
        case "daily":
          for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = ymd(year, month, day);
            if (dateStr >= startStr && (!endStr || dateStr <= endStr)) {
              result.push({
                amount: rec.amount,
                description: `${rec.description} (Recurring)`,
                date: dateStr,
              });
            }
          }
          break;

        case "weekly": {
          for (let day = 1; day <= daysInMonth; day++) {
            const dow = new Date(year, month - 1, day).getDay();
            const dateStr = ymd(year, month, day);
            if (
              dow === rec.dayOfWeek &&
              dateStr >= startStr &&
              (!endStr || dateStr <= endStr)
            ) {
              result.push({
                amount: rec.amount,
                description: `${rec.description} (Recurring)`,
                date: dateStr,
              });
            }
          }
          break;
        }

        case "monthly": {
          const targetDay = Math.min(rec.dayOfMonth || 1, daysInMonth);
          const dateStr = ymd(year, month, targetDay);
          if (dateStr >= startStr && (!endStr || dateStr <= endStr)) {
            result.push({
              amount: rec.amount,
              description: `${rec.description} (Recurring)`,
              date: dateStr,
            });
          }
          break;
        }

        case "yearly": {
          // Parse start month/day directly from the string to avoid UTC shift
          const [, startMoStr, startDayStr] = startStr.split("-");
          const startMo = parseInt(startMoStr!);
          const startDay = parseInt(startDayStr!);
          if (startMo === month) {
            const dateStr = ymd(year, month, startDay);
            if (dateStr >= startStr && (!endStr || dateStr <= endStr)) {
              result.push({
                amount: rec.amount,
                description: `${rec.description} (Recurring)`,
                date: dateStr,
              });
            }
          }
          break;
        }
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

    // Build a YYYY-MM-DD string from numeric parts — avoids UTC/local timezone shift
    const ymd = (y: number, mo: number, d: number): string =>
      `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

    const daysInMonth = new Date(year, month, 0).getDate();
    const monthStartStr = ymd(year, month, 1);
    const monthEndStr = ymd(year, month, daysInMonth);

    recurring.forEach((rec) => {
      // Use the per-month override amount if one exists
      const override = overrides.find(
        (o) => o.recurringId === rec.id && o.yearMonth === yearMonth,
      );
      const effectiveAmount = override ? override.amount : rec.amount;
      const startStr = rec.startDate;
      const endStr = rec.endDate ?? null;

      // Skip if recurring hasn't started yet or has ended
      if (startStr > monthEndStr || (endStr && endStr < monthStartStr)) {
        return;
      }

      switch (rec.frequency) {
        case "daily":
          for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = ymd(year, month, day);
            if (dateStr >= startStr && (!endStr || dateStr <= endStr)) {
              result.push({
                amount: effectiveAmount,
                description: `${rec.description} (Recurring)`,
                date: dateStr,
              });
            }
          }
          break;

        case "weekly": {
          for (let day = 1; day <= daysInMonth; day++) {
            const dow = new Date(year, month - 1, day).getDay();
            const dateStr = ymd(year, month, day);
            if (
              dow === rec.dayOfWeek &&
              dateStr >= startStr &&
              (!endStr || dateStr <= endStr)
            ) {
              result.push({
                amount: effectiveAmount,
                description: `${rec.description} (Recurring)`,
                date: dateStr,
              });
            }
          }
          break;
        }

        case "monthly": {
          const targetDay = Math.min(rec.dayOfMonth || 1, daysInMonth);
          const dateStr = ymd(year, month, targetDay);
          if (dateStr >= startStr && (!endStr || dateStr <= endStr)) {
            result.push({
              amount: effectiveAmount,
              description: `${rec.description} (Recurring)${override ? " ⚡" : ""}`,
              date: dateStr,
            });
          }
          break;
        }

        case "yearly": {
          // Parse start month/day directly from the string to avoid UTC shift
          const [, startMoStr, startDayStr] = startStr.split("-");
          const startMo = parseInt(startMoStr!);
          const startDay = parseInt(startDayStr!);
          if (startMo === month) {
            const dateStr = ymd(year, month, startDay);
            if (dateStr >= startStr && (!endStr || dateStr <= endStr)) {
              result.push({
                amount: effectiveAmount,
                description: `${rec.description} (Recurring)${override ? " ⚡" : ""}`,
                date: dateStr,
              });
            }
          }
          break;
        }
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
