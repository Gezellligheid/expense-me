<script setup lang="ts">
import { ref, watch } from "vue";
import { storageService, type Expense } from "../../services/storageService";

const props = defineProps<{
  isOpen: boolean;
  editExpense?: Expense | null;
}>();

const emit = defineEmits<{
  close: [];
}>();

// ── Add mode state ────────────────────────────────────────────────────────────
const expenses = ref<Expense[]>([
  { amount: "", description: "", date: storageService.getTodayDate(), excludeFromBudget: false },
]);

// ── Edit mode state ───────────────────────────────────────────────────────────
const editForm = ref<Expense>({
  amount: "",
  description: "",
  date: storageService.getTodayDate(),
  excludeFromBudget: false,
});

// Populate edit form when editExpense prop changes
watch(
  () => props.editExpense,
  (exp) => {
    if (exp) {
      editForm.value = {
        amount: exp.amount,
        description: exp.description,
        date: exp.date,
        excludeFromBudget: exp.excludeFromBudget ?? false,
        _sim: exp._sim,
      };
    }
  },
  { immediate: true },
);

const isEditMode = () => !!props.editExpense;

const handleExpenseInput = (index: number) => {
  const expense = expenses.value[index];
  if (index === expenses.value.length - 1 && expense?.amount) {
    expenses.value.push({
      amount: "",
      description: "",
      date: storageService.getTodayDate(),
      excludeFromBudget: false,
    });
  }
};

const removeExpense = (index: number) => {
  if (expenses.value.length > 1) {
    expenses.value.splice(index, 1);
  }
};

const closeModal = () => {
  expenses.value = [
    { amount: "", description: "", date: storageService.getTodayDate(), excludeFromBudget: false },
  ];
  emit("close");
};

const saveExpenses = () => {
  if (isEditMode()) {
    if (editForm.value.amount) {
      storageService.updateExpense(props.editExpense!, { ...editForm.value });
    }
  } else {
    const validExpenses = expenses.value.filter((exp) => exp.amount);
    if (validExpenses.length > 0) {
      storageService.saveExpenses(validExpenses);
    }
  }
  closeModal();
};
</script>

<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
    @click.self="closeModal"
  >
    <div
      class="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
    >
      <!-- Modal Header -->
      <div
        class="bg-gradient-to-r from-red-500 to-pink-500 px-6 py-4 flex justify-between items-center"
      >
        <h2 class="text-2xl font-bold text-white flex items-center gap-2">
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
              d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
          {{ isEditMode() ? "Edit Expense" : "Add Expenses" }}
        </h2>
        <button
          @click="closeModal"
          class="text-white hover:text-red-100 transition-colors"
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

      <!-- Modal Body -->
      <div class="flex-1 overflow-y-auto px-6 py-4">
        <!-- ── Edit mode: single row ─────────────────────────────────── -->
        <div v-if="isEditMode()" class="space-y-4">
          <div
            class="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 rounded-lg border border-red-200 bg-red-50/40"
          >
            <!-- Amount -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1"
                >Amount *</label
              >
              <div class="relative">
                <span
                  class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                  >$</span
                >
                <input
                  v-model="editForm.amount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  class="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                />
              </div>
            </div>
            <!-- Description -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1"
                >Description (optional)</label
              >
              <input
                v-model="editForm.description"
                type="text"
                placeholder="e.g., Groceries, Rent..."
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
              />
            </div>
            <!-- Date -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1"
                >Date</label
              >
              <input
                v-model="editForm.date"
                type="date"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
              />
            </div>
          </div>

          <!-- Exclude from budget toggle -->
          <div
            class="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-3"
          >
            <div>
              <p class="text-sm font-semibold text-gray-800">
                Exclude from monthly budget
              </p>
              <p class="text-xs text-gray-500 mt-0.5">
                This expense will still be recorded but won't count towards this
                month's budget.
              </p>
            </div>
            <button
              type="button"
              @click="editForm.excludeFromBudget = !editForm.excludeFromBudget"
              class="relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none ml-4 shrink-0"
              :class="
                editForm.excludeFromBudget ? 'bg-amber-500' : 'bg-gray-300'
              "
              :aria-checked="editForm.excludeFromBudget"
              role="switch"
            >
              <span
                class="inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform"
                :class="
                  editForm.excludeFromBudget ? 'translate-x-6' : 'translate-x-1'
                "
              />
            </button>
          </div>
        </div>

        <!-- ── Add mode: batch rows ────────────────────────────────────── -->
        <div v-else class="space-y-3">
          <div
            v-for="(expense, index) in expenses"
            :key="index"
            class="flex gap-3 items-start p-3 rounded-lg border border-gray-200 hover:border-red-300 transition-colors"
          >
            <div class="flex-1 flex flex-col gap-3">
              <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
              <!-- Amount Input -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  Amount *
                </label>
                <div class="relative">
                  <span
                    class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500"
                    >$</span
                  >
                  <input
                    v-model="expense.amount"
                    @input="handleExpenseInput(index)"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    class="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>

              <!-- Description Input -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  Description (optional)
                </label>
                <input
                  v-model="expense.description"
                  type="text"
                  placeholder="e.g., Groceries, Rent..."
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                />
              </div>

              <!-- Date Input -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  Date
                </label>
                <input
                  v-model="expense.date"
                  type="date"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                />
              </div>
              </div>

              <!-- Exclude from budget toggle -->
              <div class="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                <div>
                  <p class="text-sm font-semibold text-gray-800">Exclude from monthly budget</p>
                  <p class="text-xs text-gray-500 mt-0.5">Won't count towards this month's budget.</p>
                </div>
                <button
                  type="button"
                  @click="expense.excludeFromBudget = !expense.excludeFromBudget"
                  class="relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none ml-4 shrink-0"
                  :class="expense.excludeFromBudget ? 'bg-amber-500' : 'bg-gray-300'"
                  :aria-checked="expense.excludeFromBudget"
                  role="switch"
                >
                  <span
                    class="inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform"
                    :class="expense.excludeFromBudget ? 'translate-x-6' : 'translate-x-1'"
                  />
                </button>
              </div>
            </div>

            <!-- Remove Button -->
            <button
              v-if="expenses.length > 1 && expense.amount"
              @click="removeExpense(index)"
              class="mt-7 p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              title="Remove expense"
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

        <p
          v-if="!isEditMode()"
          class="text-sm text-gray-500 mt-4 flex items-center gap-2"
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
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          A new expense field will appear automatically when you fill in the
          amount
        </p>
      </div>
      <!-- end Modal Body -->

      <!-- Modal Footer -->
      <div
        class="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3"
      >
        <button
          @click="closeModal"
          class="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors font-medium"
        >
          Cancel
        </button>
        <button
          @click="saveExpenses"
          :disabled="
            isEditMode() ? !editForm.amount : !expenses.some((e) => e.amount)
          "
          class="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ isEditMode() ? "Save Changes" : "Save Expenses" }}
        </button>
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
