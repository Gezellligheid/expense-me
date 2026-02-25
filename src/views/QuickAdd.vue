<script setup lang="ts">
import { ref, computed, nextTick, watch, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { storageService } from "../services/storageService";
import { useSettings } from "../composables/useSettings";

const route = useRoute();
const router = useRouter();
const { formatCurrency: fmt } = useSettings();

// ── Tab state ─────────────────────────────────────────────────────────────────
type Tab = "expense" | "income";
const activeTab = ref<Tab>(
  route.query.type === "income" ? "income" : "expense",
);

// Auto-switch when the query param changes (e.g. from app shortcuts)
watch(
  () => route.query.type,
  (t) => {
    activeTab.value = t === "income" ? "income" : "expense";
  },
);

// ── Form state ────────────────────────────────────────────────────────────────
const amount = ref("");
const description = ref("");
const amountInput = ref<HTMLInputElement | null>(null);
const saving = ref(false);
const savedTab = ref<Tab | null>(null);

// Auto-focus amount on mount and on tab change
onMounted(() => amountInput.value?.focus());
watch(activeTab, () => nextTick(() => amountInput.value?.focus()));

// ── Month summary ─────────────────────────────────────────────────────────────
const now = new Date();
const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
const monthLabel = now.toLocaleString("default", {
  month: "long",
  year: "numeric",
});

function loadMonthTotals() {
  const exps = storageService
    .loadExpenses()
    .filter((e) => !e._sim && e.date.startsWith(yearMonth));
  const incs = storageService
    .loadIncomes()
    .filter((i) => !i._sim && i.date.startsWith(yearMonth));
  const rExp = storageService.calculateRecurringExpensesForMonth(yearMonth);
  const rInc = storageService.calculateRecurringIncomesForMonth(yearMonth);
  return {
    spent: [...exps, ...rExp].reduce(
      (s, e) => s + parseFloat(e.amount || "0"),
      0,
    ),
    earned: [...incs, ...rInc].reduce(
      (s, i) => s + parseFloat(i.amount || "0"),
      0,
    ),
  };
}

const totals = ref(loadMonthTotals());
const remaining = computed(() => totals.value.earned - totals.value.spent);
const spentPct = computed(() =>
  totals.value.earned > 0
    ? Math.min((totals.value.spent / totals.value.earned) * 100, 100)
    : 0,
);

// ── Save transaction ──────────────────────────────────────────────────────────
function save() {
  const num = parseFloat(amount.value);
  if (!num || isNaN(num)) return;
  saving.value = true;
  const today = storageService.getTodayDate();
  const entry = {
    amount: String(num),
    description: description.value.trim(),
    date: today,
  };
  if (activeTab.value === "expense") {
    storageService.saveExpenses([entry]);
    totals.value.spent += num;
  } else {
    storageService.saveIncomes([entry]);
    totals.value.earned += num;
  }
  savedTab.value = activeTab.value;
  amount.value = "";
  description.value = "";
  saving.value = false;
  setTimeout(() => (savedTab.value = null), 1800);
  nextTick(() => amountInput.value?.focus());
}

function handleKey(e: KeyboardEvent) {
  if (e.key === "Enter") save();
}
</script>

<template>
  <div class="quick-root">
    <!-- Header -->
    <header class="header">
      <button class="back-btn" @click="router.push('/')" aria-label="Dashboard">
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
            d="M15 19l-7-7 7-7"
          />
        </svg>
      </button>
      <span class="header-title">Quick Add</span>
      <span class="header-month">{{ monthLabel }}</span>
    </header>

    <!-- Month budget card -->
    <div class="budget-card">
      <div class="budget-row">
        <div class="budget-item">
          <span class="budget-label">Earned</span>
          <span class="budget-value earned">{{ fmt(totals.earned) }}</span>
        </div>
        <div class="budget-divider" />
        <div class="budget-item">
          <span class="budget-label">Spent</span>
          <span class="budget-value spent">{{ fmt(totals.spent) }}</span>
        </div>
        <div class="budget-divider" />
        <div class="budget-item">
          <span class="budget-label">Left</span>
          <span
            class="budget-value"
            :class="remaining >= 0 ? 'earned' : 'spent'"
          >
            {{ fmt(Math.abs(remaining)) }}
          </span>
        </div>
      </div>

      <!-- Progress bar -->
      <div class="progress-track">
        <div
          class="progress-fill"
          :class="
            spentPct >= 100 ? 'over-budget' : spentPct >= 80 ? 'warn' : 'ok'
          "
          :style="`width: ${spentPct}%`"
        />
      </div>
      <div class="progress-labels">
        <span>{{ spentPct.toFixed(0) }}% of income spent</span>
        <span v-if="remaining >= 0" class="text-emerald-400"
          >{{ fmt(remaining) }} remaining</span
        >
        <span v-else class="text-red-400"
          >{{ fmt(Math.abs(remaining)) }} over</span
        >
      </div>
    </div>

    <!-- Tab switcher -->
    <div class="tab-switcher">
      <button
        class="tab-btn"
        :class="activeTab === 'expense' ? 'active-expense' : ''"
        @click="activeTab = 'expense'"
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
            d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
        Expense
      </button>
      <button
        class="tab-btn"
        :class="activeTab === 'income' ? 'active-income' : ''"
        @click="activeTab = 'income'"
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
            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        Income
      </button>
    </div>

    <!-- Form -->
    <div
      class="form-card"
      :class="activeTab === 'expense' ? 'form-expense' : 'form-income'"
    >
      <!-- Success flash -->
      <Transition name="flash">
        <div
          v-if="savedTab"
          class="success-flash"
          :class="savedTab === 'expense' ? 'flash-expense' : 'flash-income'"
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
              stroke-width="2.5"
              d="M5 13l4 4L19 7"
            />
          </svg>
          {{ savedTab === "expense" ? "Expense saved!" : "Income saved!" }}
        </div>
      </Transition>

      <!-- Amount -->
      <div class="input-group">
        <label class="input-label">Amount</label>
        <div class="amount-wrap">
          <input
            ref="amountInput"
            v-model="amount"
            type="number"
            inputmode="decimal"
            min="0"
            step="0.01"
            placeholder="0.00"
            class="amount-input"
            :class="
              activeTab === 'expense' ? 'caret-red-400' : 'caret-emerald-400'
            "
            @keydown="handleKey"
          />
        </div>
      </div>

      <!-- Description -->
      <div class="input-group mt-3">
        <label class="input-label"
          >Description <span class="optional">(optional)</span></label
        >
        <input
          v-model="description"
          type="text"
          placeholder="e.g. Coffee, Salary…"
          class="desc-input"
          @keydown="handleKey"
        />
      </div>

      <!-- Save button -->
      <button
        class="save-btn"
        :class="activeTab === 'expense' ? 'save-expense' : 'save-income'"
        :disabled="!amount || saving"
        @click="save"
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
        Save {{ activeTab === "expense" ? "Expense" : "Income" }}
      </button>
    </div>

    <!-- Quick links -->
    <div class="quick-links">
      <router-link to="/" class="quick-link">Dashboard</router-link>
      <span class="quick-sep">·</span>
      <router-link to="/recurring" class="quick-link">Recurring</router-link>
      <span class="quick-sep">·</span>
      <router-link to="/projections" class="quick-link"
        >Projections</router-link
      >
    </div>
  </div>
</template>

<style scoped>
.quick-root {
  min-height: 100dvh;
  background: #030712;
  color: #f1f5f9;
  display: flex;
  flex-direction: column;
  padding: env(safe-area-inset-top, 16px) 16px env(safe-area-inset-bottom, 24px);
  gap: 16px;
  max-width: 480px;
  margin: 0 auto;
  font-family: inherit;
}

/* ── Header ─────────────────────────────────────────────────────────────────── */
.header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-top: 8px;
}
.back-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.07);
  color: #94a3b8;
  border: none;
  cursor: pointer;
  transition: background 0.15s;
}
.back-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
}
.header-title {
  font-size: 1.125rem;
  font-weight: 700;
  color: #fff;
}
.header-month {
  margin-left: auto;
  font-size: 0.8125rem;
  color: #64748b;
  font-weight: 500;
}

/* ── Budget card ─────────────────────────────────────────────────────────────── */
.budget-card {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 18px;
  padding: 18px 20px 14px;
}
.budget-row {
  display: flex;
  align-items: center;
  gap: 0;
  justify-content: space-around;
  margin-bottom: 14px;
}
.budget-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
.budget-label {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #64748b;
  font-weight: 600;
}
.budget-value {
  font-size: 1.05rem;
  font-weight: 700;
  color: #f1f5f9;
}
.budget-value.earned {
  color: #34d399;
}
.budget-value.spent {
  color: #f87171;
}
.budget-divider {
  width: 1px;
  height: 32px;
  background: rgba(255, 255, 255, 0.08);
}

/* Progress bar */
.progress-track {
  height: 6px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.4s ease;
}
.progress-fill.ok {
  background: linear-gradient(90deg, #10b981, #34d399);
}
.progress-fill.warn {
  background: linear-gradient(90deg, #f59e0b, #fbbf24);
}
.progress-fill.over-budget {
  background: linear-gradient(90deg, #ef4444, #f87171);
}

.progress-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 6px;
  font-size: 0.7rem;
  color: #64748b;
}

/* ── Tabs ────────────────────────────────────────────────────────────────────── */
.tab-switcher {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.tab-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 12px;
  border-radius: 14px;
  border: 1.5px solid rgba(255, 255, 255, 0.07);
  background: rgba(255, 255, 255, 0.04);
  color: #64748b;
  font-size: 0.9375rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}
.tab-btn:hover {
  color: #94a3b8;
  background: rgba(255, 255, 255, 0.07);
}
.tab-btn.active-expense {
  background: rgba(239, 68, 68, 0.12);
  border-color: rgba(239, 68, 68, 0.35);
  color: #f87171;
}
.tab-btn.active-income {
  background: rgba(16, 185, 129, 0.12);
  border-color: rgba(16, 185, 129, 0.35);
  color: #34d399;
}

/* ── Form card ────────────────────────────────────────────────────────────────── */
.form-card {
  background: rgba(255, 255, 255, 0.04);
  border: 1.5px solid rgba(255, 255, 255, 0.07);
  border-radius: 18px;
  padding: 20px;
  position: relative;
  overflow: hidden;
  transition: border-color 0.2s;
}
.form-expense {
  border-color: rgba(239, 68, 68, 0.2);
}
.form-income {
  border-color: rgba(16, 185, 129, 0.2);
}

/* Success flash */
.success-flash {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 0.9rem;
  font-weight: 600;
  margin-bottom: 14px;
}
.flash-expense {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
}
.flash-income {
  background: rgba(16, 185, 129, 0.15);
  color: #34d399;
}

.flash-enter-active,
.flash-leave-active {
  transition:
    opacity 0.3s,
    transform 0.3s;
}
.flash-enter-from {
  opacity: 0;
  transform: translateY(-8px);
}
.flash-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.input-label {
  font-size: 0.78rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #64748b;
}
.optional {
  font-weight: 400;
  text-transform: none;
  color: #475569;
}

.amount-wrap {
  position: relative;
}
.amount-input {
  width: 100%;
  background: rgba(255, 255, 255, 0.06);
  border: 1.5px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 14px 16px;
  font-size: 1.75rem;
  font-weight: 700;
  color: #f1f5f9;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.15s;
  appearance: textfield;
  -moz-appearance: textfield;
}
.amount-input::-webkit-outer-spin-button,
.amount-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
}
.amount-input:focus {
  border-color: rgba(255, 255, 255, 0.25);
}

.desc-input {
  width: 100%;
  background: rgba(255, 255, 255, 0.06);
  border: 1.5px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 12px 16px;
  font-size: 1rem;
  color: #f1f5f9;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.15s;
}
.desc-input::placeholder {
  color: #475569;
}
.desc-input:focus {
  border-color: rgba(255, 255, 255, 0.25);
}

.save-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 15px;
  border: none;
  border-radius: 14px;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  margin-top: 18px;
  transition:
    opacity 0.15s,
    transform 0.1s;
}
.save-btn:active {
  transform: scale(0.98);
}
.save-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.save-expense {
  background: linear-gradient(135deg, #ef4444, #ec4899);
  color: #fff;
}
.save-income {
  background: linear-gradient(135deg, #10b981, #06b6d4);
  color: #fff;
}

/* ── Quick links ─────────────────────────────────────────────────────────────── */
.quick-links {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
  padding-bottom: 4px;
  margin-top: auto;
}
.quick-link {
  font-size: 0.8125rem;
  color: #475569;
  text-decoration: none;
  transition: color 0.15s;
}
.quick-link:hover {
  color: #94a3b8;
}
.quick-sep {
  color: #334155;
  font-size: 0.75rem;
}
</style>
