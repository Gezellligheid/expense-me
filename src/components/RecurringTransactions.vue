<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import {
  storageService,
  type RecurringExpense,
  type RecurringIncome,
  type RecurringIncomeOverride,
} from "../services/storageService";

const recurringExpenses = ref<RecurringExpense[]>([]);
const recurringIncomes = ref<RecurringIncome[]>([]);
const incomeOverrides = ref<RecurringIncomeOverride[]>([]);
const showExpenseModal = ref(false);
const showIncomeModal = ref(false);
const editingExpenseId = ref<string | null>(null);
const editingIncomeId = ref<string | null>(null);

// ── Override modal state ────────────────────────────────────────────
const showOverrideModal = ref(false);
const overrideTarget = ref<RecurringIncome | null>(null);
const overrideMonth = ref("");
const overrideAmount = ref("");

// Form data
const expenseForm = ref({
  amount: "",
  description: "",
  frequency: "monthly" as "daily" | "weekly" | "monthly" | "yearly",
  startDate: storageService.getTodayDate(),
  endDate: "",
  dayOfMonth: new Date().getDate(),
  dayOfWeek: new Date().getDay(),
});

const incomeForm = ref({
  amount: "",
  description: "",
  frequency: "monthly" as "daily" | "weekly" | "monthly" | "yearly",
  startDate: storageService.getTodayDate(),
  endDate: "",
  dayOfMonth: new Date().getDate(),
  dayOfWeek: new Date().getDay(),
});

const loadData = () => {
  recurringExpenses.value = storageService.loadRecurringExpenses();
  recurringIncomes.value = storageService.loadRecurringIncomes();
  incomeOverrides.value = storageService.loadRecurringIncomeOverrides();
};

const handleStorageUpdate = () => {
  loadData();
};

onMounted(() => {
  loadData();
  window.addEventListener("storage-updated", handleStorageUpdate);
});

onUnmounted(() => {
  window.removeEventListener("storage-updated", handleStorageUpdate);
});

const openExpenseModal = (expense?: RecurringExpense) => {
  editingExpenseId.value = expense?.id ?? null;
  expenseForm.value = {
    amount: expense?.amount ?? "",
    description: expense?.description ?? "",
    frequency: expense?.frequency ?? "monthly",
    startDate: expense?.startDate ?? storageService.getTodayDate(),
    endDate: expense?.endDate ?? "",
    dayOfMonth: expense?.dayOfMonth ?? new Date().getDate(),
    dayOfWeek: expense?.dayOfWeek ?? new Date().getDay(),
  };
  showExpenseModal.value = true;
};

const openIncomeModal = (income?: RecurringIncome) => {
  editingIncomeId.value = income?.id ?? null;
  incomeForm.value = {
    amount: income?.amount ?? "",
    description: income?.description ?? "",
    frequency: income?.frequency ?? "monthly",
    startDate: income?.startDate ?? storageService.getTodayDate(),
    endDate: income?.endDate ?? "",
    dayOfMonth: income?.dayOfMonth ?? new Date().getDate(),
    dayOfWeek: income?.dayOfWeek ?? new Date().getDay(),
  };
  showIncomeModal.value = true;
};

const saveRecurringExpense = () => {
  if (!expenseForm.value.amount || !expenseForm.value.description) return;

  const data: Omit<RecurringExpense, "id"> = {
    amount: expenseForm.value.amount,
    description: expenseForm.value.description,
    frequency: expenseForm.value.frequency,
    startDate: expenseForm.value.startDate,
    endDate: expenseForm.value.endDate || undefined,
    dayOfMonth:
      expenseForm.value.frequency === "monthly"
        ? expenseForm.value.dayOfMonth
        : undefined,
    dayOfWeek:
      expenseForm.value.frequency === "weekly"
        ? expenseForm.value.dayOfWeek
        : undefined,
  };

  if (editingExpenseId.value) {
    storageService.updateRecurringExpense(editingExpenseId.value, data);
  } else {
    storageService.saveRecurringExpense({ ...data, id: Date.now().toString() });
  }
  editingExpenseId.value = null;
  showExpenseModal.value = false;
  loadData();
};

const saveRecurringIncome = () => {
  if (!incomeForm.value.amount || !incomeForm.value.description) return;

  const data: Omit<RecurringIncome, "id"> = {
    amount: incomeForm.value.amount,
    description: incomeForm.value.description,
    frequency: incomeForm.value.frequency,
    startDate: incomeForm.value.startDate,
    endDate: incomeForm.value.endDate || undefined,
    dayOfMonth:
      incomeForm.value.frequency === "monthly"
        ? incomeForm.value.dayOfMonth
        : undefined,
    dayOfWeek:
      incomeForm.value.frequency === "weekly"
        ? incomeForm.value.dayOfWeek
        : undefined,
  };

  if (editingIncomeId.value) {
    // updateRecurringIncome preserves existing overrides
    storageService.updateRecurringIncome(editingIncomeId.value, data);
  } else {
    storageService.saveRecurringIncome({ ...data, id: Date.now().toString() });
  }
  editingIncomeId.value = null;
  showIncomeModal.value = false;
  loadData();
};

const deleteExpense = (id: string) => {
  if (confirm("Delete this recurring expense?")) {
    storageService.deleteRecurringExpense(id);
    loadData();
  }
};

const deleteIncome = (id: string) => {
  if (confirm("Delete this recurring income?")) {
    storageService.deleteRecurringIncome(id);
    loadData();
  }
};

// ── Override helpers ────────────────────────────────────────────────
/** Overrides belonging to a specific recurring income, sorted by month. */
const overridesForIncome = computed(
  () => (id: string) =>
    incomeOverrides.value
      .filter((o) => o.recurringId === id)
      .sort((a, b) => a.yearMonth.localeCompare(b.yearMonth)),
);

const openOverrideModal = (income: RecurringIncome) => {
  overrideTarget.value = income;
  // Default to current month
  const now = new Date();
  overrideMonth.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  overrideAmount.value = income.amount;
  showOverrideModal.value = true;
};

const closeOverrideModal = () => {
  showOverrideModal.value = false;
  overrideTarget.value = null;
  overrideAmount.value = "";
};

const saveOverride = () => {
  if (!overrideTarget.value || !overrideAmount.value || !overrideMonth.value)
    return;
  storageService.setRecurringIncomeOverride(
    overrideTarget.value.id,
    overrideMonth.value,
    overrideAmount.value,
  );
  loadData();
  // Reset form but keep modal open so multiple months can be set quickly
  overrideAmount.value = overrideTarget.value.amount;
};

const removeOverride = (recurringId: string, yearMonth: string) => {
  storageService.deleteRecurringIncomeOverride(recurringId, yearMonth);
  loadData();
};

const fmtMonth = (ym: string) => {
  const [y, m] = ym.split("-");
  return new Date(parseInt(y!), parseInt(m!) - 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
};

const getFrequencyLabel = (frequency: string) => {
  return frequency.charAt(0).toUpperCase() + frequency.slice(1);
};
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="bg-white rounded-lg shadow-md p-4 sm:p-6">
      <div
        class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h2 class="text-xl sm:text-2xl font-bold text-gray-800">
            Recurring Transactions
          </h2>
          <p class="text-sm text-gray-600 mt-1">
            Set up automatic expenses and income
          </p>
        </div>
        <div class="flex flex-col xs:flex-row gap-2 sm:flex-row sm:shrink-0">
          <button
            @click="() => openExpenseModal()"
            class="w-full sm:w-auto px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
          >
            <svg
              class="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 4v16m8-8H4"
              />
            </svg>
            Recurring Expense
          </button>
          <button
            @click="() => openIncomeModal()"
            class="w-full sm:w-auto px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
          >
            <svg
              class="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 4v16m8-8H4"
              />
            </svg>
            Recurring Income
          </button>
        </div>
      </div>
    </div>

    <!-- Lists -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Recurring Expenses -->
      <div class="bg-white rounded-lg shadow-md p-6">
        <h3
          class="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"
        >
          <div class="w-3 h-3 bg-red-500 rounded-full"></div>
          Recurring Expenses
        </h3>
        <div v-if="recurringExpenses.length > 0" class="space-y-3">
          <div
            v-for="expense in recurringExpenses"
            :key="expense.id"
            class="p-4 bg-red-50 rounded-lg border border-red-100 flex justify-between items-start"
          >
            <div class="flex-1">
              <p class="font-semibold text-gray-800">
                {{ expense.description }}
              </p>
              <p class="text-sm text-gray-600 mt-1">
                ${{ parseFloat(expense.amount).toFixed(2) }}
              </p>
              <div class="flex items-center gap-2 mt-2 flex-wrap">
                <span class="text-xs px-2 py-1 bg-red-100 text-red-700 rounded">
                  {{ getFrequencyLabel(expense.frequency) }}
                </span>
                <span v-if="expense.dayOfMonth" class="text-xs text-gray-500">
                  Day {{ expense.dayOfMonth }} of month
                </span>
                <span
                  v-if="expense.endDate"
                  class="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded"
                >
                  ends
                  {{
                    new Date(expense.endDate + "T00:00:00").toLocaleDateString(
                      "en-US",
                      { month: "short", day: "numeric", year: "numeric" },
                    )
                  }}
                </span>
              </div>
            </div>
            <div class="flex items-center gap-1 ml-3 shrink-0">
              <button
                @click="openExpenseModal(expense)"
                class="p-2 text-blue-500 hover:bg-blue-100 rounded-lg transition-colors"
                title="Edit this expense"
              >
                <svg
                  class="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
              </button>
              <button
                @click="deleteExpense(expense.id)"
                class="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
              >
                <svg
                  class="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
        <p v-else class="text-gray-500 text-center py-8">
          No recurring expenses yet
        </p>
      </div>

      <!-- Recurring Incomes -->
      <div class="bg-white rounded-lg shadow-md p-6">
        <h3
          class="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"
        >
          <div class="w-3 h-3 bg-green-500 rounded-full"></div>
          Recurring Income
        </h3>
        <div v-if="recurringIncomes.length > 0" class="space-y-3">
          <div
            v-for="income in recurringIncomes"
            :key="income.id"
            class="p-4 bg-green-50 rounded-lg border border-green-100 flex justify-between items-start"
          >
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <p class="font-semibold text-gray-800">
                  {{ income.description }}
                </p>
                <span
                  v-if="overridesForIncome(income.id).length > 0"
                  class="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium"
                >
                  ⚡ {{ overridesForIncome(income.id).length }} override{{
                    overridesForIncome(income.id).length !== 1 ? "s" : ""
                  }}
                </span>
              </div>
              <p class="text-sm text-gray-600 mt-1">
                ${{ parseFloat(income.amount).toFixed(2) }} (default)
              </p>
              <div class="flex items-center gap-2 mt-2 flex-wrap">
                <span
                  class="text-xs px-2 py-1 bg-green-100 text-green-700 rounded"
                >
                  {{ getFrequencyLabel(income.frequency) }}
                </span>
                <span v-if="income.dayOfMonth" class="text-xs text-gray-500">
                  Day {{ income.dayOfMonth }} of month
                </span>
                <span
                  v-if="income.endDate"
                  class="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded"
                >
                  ends
                  {{
                    new Date(income.endDate + "T00:00:00").toLocaleDateString(
                      "en-US",
                      { month: "short", day: "numeric", year: "numeric" },
                    )
                  }}
                </span>
              </div>
            </div>
            <div class="flex items-center gap-1 ml-3 shrink-0">
              <button
                @click="openOverrideModal(income)"
                class="p-2 text-amber-600 hover:bg-amber-100 rounded-lg transition-colors"
                title="Override amount for a specific month"
              >
                <svg
                  class="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
              </button>
              <button
                @click="openIncomeModal(income)"
                class="p-2 text-blue-500 hover:bg-blue-100 rounded-lg transition-colors"
                title="Edit this income"
              >
                <svg
                  class="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                  />
                </svg>
              </button>
              <button
                @click="deleteIncome(income.id)"
                class="p-2 text-green-600 hover:bg-green-100 rounded-lg transition-colors"
              >
                <svg
                  class="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
        <p v-else class="text-gray-500 text-center py-8">
          No recurring income yet
        </p>
      </div>
    </div>

    <!-- Expense Modal -->
    <div
      v-if="showExpenseModal"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      @click.self="
        showExpenseModal = false;
        editingExpenseId = null;
      "
    >
      <div class="bg-white rounded-lg shadow-2xl max-w-md w-full">
        <div
          class="bg-gradient-to-r from-red-500 to-pink-500 px-6 py-4 flex justify-between items-center"
        >
          <h2 class="text-xl font-bold text-white">
            {{
              editingExpenseId
                ? "Edit Recurring Expense"
                : "Add Recurring Expense"
            }}
          </h2>
          <button
            @click="
              showExpenseModal = false;
              editingExpenseId = null;
            "
            class="text-white hover:text-red-100"
          >
            <svg
              class="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <div class="p-6 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1"
              >Description *</label
            >
            <input
              v-model="expenseForm.description"
              type="text"
              placeholder="e.g., Rent, Netflix"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1"
              >Amount *</label
            >
            <div class="relative">
              <span
                class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500"
                >$</span
              >
              <input
                v-model="expenseForm.amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                class="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
              />
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1"
              >Frequency *</label
            >
            <select
              v-model="expenseForm.frequency"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
          <div v-if="expenseForm.frequency === 'monthly'">
            <label class="block text-sm font-medium text-gray-700 mb-1"
              >Day of Month</label
            >
            <input
              v-model.number="expenseForm.dayOfMonth"
              type="number"
              min="1"
              max="31"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
            />
          </div>
          <div v-if="expenseForm.frequency === 'weekly'">
            <label class="block text-sm font-medium text-gray-700 mb-1"
              >Day of Week</label
            >
            <select
              v-model.number="expenseForm.dayOfWeek"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
            >
              <option :value="0">Sunday</option>
              <option :value="1">Monday</option>
              <option :value="2">Tuesday</option>
              <option :value="3">Wednesday</option>
              <option :value="4">Thursday</option>
              <option :value="5">Friday</option>
              <option :value="6">Saturday</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1"
              >End Date
              <span class="text-gray-400 font-normal"
                >(optional — leave blank to repeat forever)</span
              ></label
            >
            <div class="flex items-center gap-2">
              <input
                v-model="expenseForm.endDate"
                type="date"
                :min="expenseForm.startDate"
                class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
              />
              <button
                v-if="expenseForm.endDate"
                type="button"
                @click="expenseForm.endDate = ''"
                class="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                title="Remove end date"
              >
                <svg
                  class="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <p v-if="expenseForm.endDate" class="mt-1 text-xs text-red-600">
              Recurring will stop after
              {{
                new Date(expenseForm.endDate + "T00:00:00").toLocaleDateString(
                  "en-US",
                  { month: "short", day: "numeric", year: "numeric" },
                )
              }}
            </p>
          </div>
        </div>
        <div class="px-6 py-4 bg-gray-50 border-t flex justify-end gap-3">
          <button
            @click="
              showExpenseModal = false;
              editingExpenseId = null;
            "
            class="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            @click="saveRecurringExpense"
            :disabled="!expenseForm.amount || !expenseForm.description"
            class="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
          >
            {{ editingExpenseId ? "Update" : "Save" }}
          </button>
        </div>
      </div>
    </div>

    <!-- Income Modal -->
    <div
      v-if="showIncomeModal"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      @click.self="
        showIncomeModal = false;
        editingIncomeId = null;
      "
    >
      <div class="bg-white rounded-lg shadow-2xl max-w-md w-full">
        <div
          class="bg-gradient-to-r from-green-500 to-emerald-500 px-6 py-4 flex justify-between items-center"
        >
          <h2 class="text-xl font-bold text-white">
            {{
              editingIncomeId ? "Edit Recurring Income" : "Add Recurring Income"
            }}
          </h2>
          <button
            @click="
              showIncomeModal = false;
              editingIncomeId = null;
            "
            class="text-white hover:text-green-100"
          >
            <svg
              class="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <div class="p-6 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1"
              >Description *</label
            >
            <input
              v-model="incomeForm.description"
              type="text"
              placeholder="e.g., Salary, Freelance"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1"
              >Amount *</label
            >
            <div class="relative">
              <span
                class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500"
                >$</span
              >
              <input
                v-model="incomeForm.amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                class="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              />
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1"
              >Frequency *</label
            >
            <select
              v-model="incomeForm.frequency"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
          <div v-if="incomeForm.frequency === 'monthly'">
            <label class="block text-sm font-medium text-gray-700 mb-1"
              >Day of Month</label
            >
            <input
              v-model.number="incomeForm.dayOfMonth"
              type="number"
              min="1"
              max="31"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
            />
          </div>
          <div v-if="incomeForm.frequency === 'weekly'">
            <label class="block text-sm font-medium text-gray-700 mb-1"
              >Day of Week</label
            >
            <select
              v-model.number="incomeForm.dayOfWeek"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
            >
              <option :value="0">Sunday</option>
              <option :value="1">Monday</option>
              <option :value="2">Tuesday</option>
              <option :value="3">Wednesday</option>
              <option :value="4">Thursday</option>
              <option :value="5">Friday</option>
              <option :value="6">Saturday</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1"
              >End Date
              <span class="text-gray-400 font-normal"
                >(optional — leave blank to repeat forever)</span
              ></label
            >
            <div class="flex items-center gap-2">
              <input
                v-model="incomeForm.endDate"
                type="date"
                :min="incomeForm.startDate"
                class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              />
              <button
                v-if="incomeForm.endDate"
                type="button"
                @click="incomeForm.endDate = ''"
                class="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                title="Remove end date"
              >
                <svg
                  class="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <p v-if="incomeForm.endDate" class="mt-1 text-xs text-green-700">
              Recurring will stop after
              {{
                new Date(incomeForm.endDate + "T00:00:00").toLocaleDateString(
                  "en-US",
                  { month: "short", day: "numeric", year: "numeric" },
                )
              }}
            </p>
          </div>
        </div>
        <div class="px-6 py-4 bg-gray-50 border-t flex justify-end gap-3">
          <button
            @click="
              showIncomeModal = false;
              editingIncomeId = null;
            "
            class="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            @click="saveRecurringIncome"
            :disabled="!incomeForm.amount || !incomeForm.description"
            class="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50"
          >
            {{ editingIncomeId ? "Update" : "Save" }}
          </button>
        </div>
      </div>
    </div>
    <!-- Override Modal -->
    <div
      v-if="showOverrideModal && overrideTarget"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      @click.self="closeOverrideModal"
    >
      <div
        class="bg-white rounded-lg shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col"
      >
        <!-- Header -->
        <div
          class="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4 flex justify-between items-center rounded-t-lg shrink-0"
        >
          <div>
            <h2 class="text-xl font-bold text-white">Override Income Amount</h2>
            <p class="text-amber-100 text-sm mt-0.5">
              {{ overrideTarget.description }}
            </p>
          </div>
          <button
            @click="closeOverrideModal"
            class="text-white hover:text-amber-100"
          >
            <svg
              class="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <!-- Body -->
        <div class="p-6 overflow-y-auto flex-1 space-y-6">
          <!-- Add / update override form -->
          <div
            class="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-4"
          >
            <h3
              class="text-sm font-semibold text-amber-800 uppercase tracking-wide"
            >
              Set Override for a Month
            </h3>
            <p class="text-xs text-amber-700">
              Default amount:
              <span class="font-bold"
                >${{ parseFloat(overrideTarget.amount).toFixed(2) }}</span
              >
            </p>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1"
                  >Month</label
                >
                <input
                  v-model="overrideMonth"
                  type="month"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none text-sm"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1"
                  >Amount for that month</label
                >
                <div class="relative">
                  <span
                    class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm"
                    >$</span
                  >
                  <input
                    v-model="overrideAmount"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    class="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none text-sm"
                    @keyup.enter="saveOverride"
                  />
                </div>
              </div>
            </div>
            <button
              @click="saveOverride"
              :disabled="!overrideAmount || !overrideMonth"
              class="w-full py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save Override
            </button>
          </div>

          <!-- Existing overrides list -->
          <div v-if="overridesForIncome(overrideTarget.id).length > 0">
            <h3
              class="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3"
            >
              Existing Overrides
            </h3>
            <div class="space-y-2">
              <div
                v-for="ov in overridesForIncome(overrideTarget.id)"
                :key="ov.yearMonth"
                class="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
              >
                <div>
                  <p class="text-sm font-medium text-gray-800">
                    {{ fmtMonth(ov.yearMonth) }}
                  </p>
                  <p class="text-xs text-gray-500 mt-0.5">
                    Default: ${{ parseFloat(overrideTarget.amount).toFixed(2) }}
                    <span class="mx-1 text-gray-300">→</span>
                    <span class="font-semibold text-amber-700"
                      >${{ parseFloat(ov.amount).toFixed(2) }}</span
                    >
                    <span
                      v-if="
                        parseFloat(ov.amount) >
                        parseFloat(overrideTarget.amount)
                      "
                      class="ml-1 text-emerald-600"
                      >▲ +${{
                        (
                          parseFloat(ov.amount) -
                          parseFloat(overrideTarget.amount)
                        ).toFixed(2)
                      }}</span
                    >
                    <span
                      v-else-if="
                        parseFloat(ov.amount) <
                        parseFloat(overrideTarget.amount)
                      "
                      class="ml-1 text-red-500"
                      >▼ -${{
                        (
                          parseFloat(overrideTarget.amount) -
                          parseFloat(ov.amount)
                        ).toFixed(2)
                      }}</span
                    >
                  </p>
                </div>
                <div class="flex gap-2 ml-4 shrink-0">
                  <!-- Quick-edit: click to load into form -->
                  <button
                    @click="
                      overrideMonth = ov.yearMonth;
                      overrideAmount = ov.amount;
                    "
                    class="p-1.5 text-blue-500 hover:bg-blue-50 rounded transition-colors"
                    title="Edit this override"
                  >
                    <svg
                      class="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                  </button>
                  <button
                    @click="removeOverride(overrideTarget!.id, ov.yearMonth)"
                    class="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors"
                    title="Remove override"
                  >
                    <svg
                      class="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <p v-else class="text-sm text-gray-400 text-center py-2">
            No overrides set yet. Add one above.
          </p>
        </div>

        <!-- Footer -->
        <div
          class="px-6 py-4 bg-gray-50 border-t rounded-b-lg shrink-0 flex justify-end"
        >
          <button
            @click="closeOverrideModal"
            class="px-5 py-2 bg-gray-200 text-gray-700 hover:bg-gray-300 rounded-lg transition-colors font-medium text-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Hide number input spinners */
input[type="number"]::-webkit-inner-spin-button,
input[type="number"]::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
input[type="number"] {
  -moz-appearance: textfield;
  appearance: textfield;
}
</style>
