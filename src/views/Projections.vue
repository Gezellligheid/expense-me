<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { Bar, Line } from "vue-chartjs";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  type ChartOptions,
  type ChartDataset,
} from "chart.js";
import {
  storageService,
  type Expense,
  type Income,
  type RecurringExpense,
  type RecurringIncome,
  type RecurringIncomeOverride,
} from "../services/storageService";
import { useSettings } from "../composables/useSettings";
import { useSimulation } from "../composables/useSimulation";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

// ── State ────────────────────────────────────────────────────────────────────
const currentYear = new Date().getFullYear();
const selectedYear = ref(currentYear);

const { formatCurrency: fmt } = useSettings();
const { isSimulating } = useSimulation();

// ── Snapshot helpers for baseline (pre-simulation) comparison ────────────────
const SNAPSHOT_KEY = "_simSnapshot";

function readSnapshotKey<T>(key: string): T[] {
  const raw = localStorage.getItem(SNAPSHOT_KEY);
  if (!raw) return [];
  const snap = JSON.parse(raw) as Record<string, string | null>;
  const val = snap[key];
  return val ? (JSON.parse(val) as T[]) : [];
}

/** Mirrors storageService.calculateRecurringExpensesForMonth but works on in-memory arrays. */
function calcSnapRecurringExpTotal(
  items: RecurringExpense[],
  yearMonth: string,
): number {
  const parts = yearMonth.split("-").map(Number);
  const year = parts[0] as number;
  const month = parts[1] as number;
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);
  let total = 0;
  for (const rec of items) {
    const startDate = new Date(rec.startDate);
    const endDate = rec.endDate ? new Date(rec.endDate) : null;
    if (startDate > monthEnd || (endDate && endDate < monthStart)) continue;
    switch (rec.frequency) {
      case "daily":
        for (let day = 1; day <= monthEnd.getDate(); day++) {
          const d = new Date(year, month - 1, day);
          if (d >= startDate && (!endDate || d <= endDate))
            total += parseFloat(rec.amount);
        }
        break;
      case "weekly":
        for (let day = 1; day <= monthEnd.getDate(); day++) {
          const d = new Date(year, month - 1, day);
          if (
            d.getDay() === rec.dayOfWeek &&
            d >= startDate &&
            (!endDate || d <= endDate)
          )
            total += parseFloat(rec.amount);
        }
        break;
      case "monthly": {
        const targetDay = Math.min(rec.dayOfMonth || 1, monthEnd.getDate());
        const d = new Date(year, month - 1, targetDay);
        if (d >= startDate && (!endDate || d <= endDate))
          total += parseFloat(rec.amount);
        break;
      }
      case "yearly": {
        if (startDate.getMonth() + 1 === month) {
          const d = new Date(year, month - 1, startDate.getDate());
          if (d >= startDate && (!endDate || d <= endDate))
            total += parseFloat(rec.amount);
        }
        break;
      }
    }
  }
  return total;
}

/** Mirrors storageService.calculateRecurringIncomesForMonth but works on in-memory arrays. */
function calcSnapRecurringIncTotal(
  items: RecurringIncome[],
  overrides: RecurringIncomeOverride[],
  yearMonth: string,
): number {
  const parts = yearMonth.split("-").map(Number);
  const year = parts[0] as number;
  const month = parts[1] as number;
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);
  let total = 0;
  for (const rec of items) {
    const override = overrides.find(
      (o) => o.recurringId === rec.id && o.yearMonth === yearMonth,
    );
    const amt = parseFloat(override ? override.amount : rec.amount);
    const startDate = new Date(rec.startDate);
    const endDate = rec.endDate ? new Date(rec.endDate) : null;
    if (startDate > monthEnd || (endDate && endDate < monthStart)) continue;
    switch (rec.frequency) {
      case "daily":
        for (let day = 1; day <= monthEnd.getDate(); day++) {
          const d = new Date(year, month - 1, day);
          if (d >= startDate && (!endDate || d <= endDate)) total += amt;
        }
        break;
      case "weekly":
        for (let day = 1; day <= monthEnd.getDate(); day++) {
          const d = new Date(year, month - 1, day);
          if (
            d.getDay() === rec.dayOfWeek &&
            d >= startDate &&
            (!endDate || d <= endDate)
          )
            total += amt;
        }
        break;
      case "monthly": {
        const targetDay = Math.min(rec.dayOfMonth || 1, monthEnd.getDate());
        const d = new Date(year, month - 1, targetDay);
        if (d >= startDate && (!endDate || d <= endDate)) total += amt;
        break;
      }
      case "yearly": {
        if (startDate.getMonth() + 1 === month) {
          const d = new Date(year, month - 1, startDate.getDate());
          if (d >= startDate && (!endDate || d <= endDate)) total += amt;
        }
        break;
      }
    }
  }
  return total;
}

const expenses = ref<Expense[]>([]);
const incomes = ref<Income[]>([]);
const initialBalance = ref<number | null>(null);

const loadData = () => {
  expenses.value = storageService.loadExpenses();
  incomes.value = storageService.loadIncomes();
  initialBalance.value = storageService.getInitialBalance();
};

onMounted(() => {
  loadData();
  window.addEventListener("storage-updated", loadData);
});

onUnmounted(() => {
  window.removeEventListener("storage-updated", loadData);
});

// ── Helpers ───────────────────────────────────────────────────────────────────
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** All months (YYYY-MM strings) from the very first data point up to (but
 *  excluding) the first month of `selectedYear`. */
const monthsBeforeYear = computed<string[]>(() => {
  const year = selectedYear.value;

  // Collect candidate start dates
  const candidates: string[] = [];
  expenses.value.forEach((e) => candidates.push(e.date.substring(0, 7)));
  incomes.value.forEach((i) => candidates.push(i.date.substring(0, 7)));
  storageService
    .loadRecurringExpenses()
    .forEach((r) => candidates.push(r.startDate.substring(0, 7)));
  storageService
    .loadRecurringIncomes()
    .forEach((r) => candidates.push(r.startDate.substring(0, 7)));

  if (candidates.length === 0) return [];

  const earliest = candidates.sort()[0] as string;
  const startYearMonth = `${year}-01`;
  if (earliest >= startYearMonth) return [];

  const result: string[] = [];
  let y = parseInt(earliest.split("-")[0] as string);
  let m = parseInt(earliest.split("-")[1] as string);
  while (true) {
    const ym = `${y}-${String(m).padStart(2, "0")}`;
    if (ym >= startYearMonth) break;
    result.push(ym);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return result;
});

/** Balance at the START of selectedYear (before any month of that year). */
const startingBalance = computed<number>(() => {
  let balance = initialBalance.value ?? 0;
  for (const ym of monthsBeforeYear.value) {
    const regularExp = expenses.value
      .filter((e) => e.date.startsWith(ym))
      .reduce((s, e) => s + parseFloat(e.amount || "0"), 0);
    const recurringExp = storageService
      .calculateRecurringExpensesForMonth(ym)
      .reduce((s, e) => s + parseFloat(e.amount || "0"), 0);
    const regularInc = incomes.value
      .filter((i) => i.date.startsWith(ym))
      .reduce((s, i) => s + parseFloat(i.amount || "0"), 0);
    const recurringInc = storageService
      .calculateRecurringIncomesForMonth(ym)
      .reduce((s, i) => s + parseFloat(i.amount || "0"), 0);
    balance += regularInc + recurringInc - (regularExp + recurringExp);
  }
  return balance;
});

// ── Per-month projections ─────────────────────────────────────────────────────
interface MonthData {
  month: string; // YYYY-MM
  label: string; // "January"
  income: number;
  expenses: number;
  net: number;
  runningBalance: number;
}

const monthlyData = computed<MonthData[]>(() => {
  const year = selectedYear.value;
  let running = startingBalance.value;
  return Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const ym = `${year}-${String(m).padStart(2, "0")}`;

    const regularExp = expenses.value
      .filter((e) => e.date.startsWith(ym))
      .reduce((s, e) => s + parseFloat(e.amount || "0"), 0);
    const recurringExp = storageService
      .calculateRecurringExpensesForMonth(ym)
      .reduce((s, e) => s + parseFloat(e.amount || "0"), 0);

    const regularInc = incomes.value
      .filter((inc) => inc.date.startsWith(ym))
      .reduce((s, inc) => s + parseFloat(inc.amount || "0"), 0);
    const recurringInc = storageService
      .calculateRecurringIncomesForMonth(ym)
      .reduce((s, inc) => s + parseFloat(inc.amount || "0"), 0);

    const income = regularInc + recurringInc;
    const exp = regularExp + recurringExp;
    const net = income - exp;
    running += net;

    return {
      month: ym,
      label: MONTH_NAMES[i] ?? "",
      income,
      expenses: exp,
      net,
      runningBalance: running,
    };
  });
});

// ── Yearly summary ────────────────────────────────────────────────────────────
const yearlyTotals = computed(() => {
  const totalIncome = monthlyData.value.reduce((s, m) => s + m.income, 0);
  const totalExpenses = monthlyData.value.reduce((s, m) => s + m.expenses, 0);
  return {
    income: totalIncome,
    expenses: totalExpenses,
    net: totalIncome - totalExpenses,
    endBalance: monthlyData.value[11]?.runningBalance ?? 0,
    savingsRate:
      totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0,
  };
});

// ── Active recurring transactions this year ───────────────────────────────────
const activeRecurringExpenses = computed(() =>
  storageService.loadRecurringExpenses().filter((r) => {
    const start = r.startDate.substring(0, 7);
    const end = r.endDate ? r.endDate.substring(0, 7) : "9999-12";
    const yearStr = String(selectedYear.value);
    return start <= `${yearStr}-12` && end >= `${yearStr}-01`;
  }),
);

const activeRecurringIncomes = computed(() =>
  storageService.loadRecurringIncomes().filter((r) => {
    const start = r.startDate.substring(0, 7);
    const end = r.endDate ? r.endDate.substring(0, 7) : "9999-12";
    const yearStr = String(selectedYear.value);
    return start <= `${yearStr}-12` && end >= `${yearStr}-01`;
  }),
);

// ── Chart data ────────────────────────────────────────────────────────────────
const barChartData = computed(() => ({
  labels: MONTH_SHORT,
  datasets: [
    {
      label: "Income",
      data: monthlyData.value.map((m) => m.income),
      backgroundColor: "rgba(16, 185, 129, 0.75)",
      borderColor: "rgba(5, 150, 105, 1)",
      borderWidth: 1.5,
      borderRadius: 4,
    },
    {
      label: "Expenses",
      data: monthlyData.value.map((m) => m.expenses),
      backgroundColor: "rgba(239, 68, 68, 0.75)",
      borderColor: "rgba(220, 38, 38, 1)",
      borderWidth: 1.5,
      borderRadius: 4,
    },
  ],
}));

const lineChartData = computed(() => {
  const datasets: ChartDataset<"line">[] = [
    {
      label: "Running Balance",
      data: monthlyData.value.map((m) => m.runningBalance),
      borderColor: hasProjectionChanges.value
        ? "rgba(245, 158, 11, 1)"
        : "rgba(99, 102, 241, 1)",
      backgroundColor: hasProjectionChanges.value
        ? "rgba(245, 158, 11, 0.10)"
        : "rgba(99, 102, 241, 0.12)",
      pointBackgroundColor: monthlyData.value.map((m) =>
        m.runningBalance >= 0
          ? hasProjectionChanges.value
            ? "rgba(245, 158, 11, 1)"
            : "rgba(99, 102, 241, 1)"
          : "rgba(239, 68, 68, 1)",
      ),
      pointBorderColor: "#fff",
      pointRadius: 5,
      pointHoverRadius: 7,
      fill: true,
      tension: 0.4,
      order: 1,
    },
  ];

  if (hasProjectionChanges.value && baselineMonthlyData.value.length === 12) {
    datasets.push({
      label: "Balance (Before)",
      data: baselineMonthlyData.value.map((m) => m.runningBalance),
      borderColor: "rgba(148, 163, 184, 0.8)",
      backgroundColor: "transparent",
      pointBackgroundColor: "rgba(148, 163, 184, 0.8)",
      pointBorderColor: "#fff",
      pointRadius: 3,
      pointHoverRadius: 5,
      fill: false,
      tension: 0.4,
      borderDash: [6, 3],
      order: 2,
    });
  }

  return { labels: MONTH_SHORT, datasets };
});

const barOptions: ChartOptions<"bar"> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: "top" },
    tooltip: {
      callbacks: {
        label: (ctx) => ` ${ctx.dataset.label}: ${fmt(ctx.parsed.y ?? 0)}`,
      },
    },
  },
  scales: {
    x: { grid: { display: false } },
    y: {
      beginAtZero: true,
      ticks: {
        callback: (v) => `$${Number(v).toLocaleString()}`,
      },
    },
  },
};

const lineOptions: ChartOptions<"line"> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: "top" },
    tooltip: {
      callbacks: {
        label: (ctx) => ` ${ctx.dataset.label}: ${fmt(ctx.parsed.y ?? 0)}`,
      },
    },
  },
  scales: {
    x: { grid: { display: false } },
    y: {
      ticks: {
        callback: (v) => `$${Number(v).toLocaleString()}`,
      },
    },
  },
};

// ── Year navigation ───────────────────────────────────────────────────────────
const prevYear = () => selectedYear.value--;
const nextYear = () => selectedYear.value++;

// True when at least one simulated month differs from the baseline
const hasProjectionChanges = computed(() => {
  if (!isSimulating.value || baselineMonthlyData.value.length !== 12)
    return false;
  return monthlyData.value.some(
    (m, i) =>
      Math.abs(
        m.runningBalance - (baselineMonthlyData.value[i]?.runningBalance ?? 0),
      ) > 0.001,
  );
});

// ── Baseline monthly data (snapshot before simulation started) ────────────────
const baselineMonthlyData = computed<MonthData[]>(() => {
  if (!isSimulating.value) return [];
  const year = selectedYear.value;

  const snapExp = readSnapshotKey<Expense>("expenses");
  const snapInc = readSnapshotKey<Income>("incomes");
  const snapRecExp = readSnapshotKey<RecurringExpense>("recurringExpenses");
  const snapRecInc = readSnapshotKey<RecurringIncome>("recurringIncomes");
  const snapOvr = readSnapshotKey<RecurringIncomeOverride>(
    "recurringIncomeOverrides",
  );
  const snapInitBal = (() => {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return initialBalance.value ?? 0;
    const snap = JSON.parse(raw) as Record<string, string | null>;
    return snap["initialBalance"] ? parseFloat(snap["initialBalance"]) : 0;
  })();

  // Compute all months before selected year from snapshot
  const candidates = [
    ...snapExp.map((e) => e.date.substring(0, 7)),
    ...snapInc.map((i) => i.date.substring(0, 7)),
    ...snapRecExp.map((r) => r.startDate.substring(0, 7)),
    ...snapRecInc.map((r) => r.startDate.substring(0, 7)),
  ];
  const startYM = `${year}-01`;
  let running = snapInitBal;
  if (candidates.length > 0) {
    const earliest = candidates.sort()[0] as string;
    let y2 = parseInt(earliest.split("-")[0] as string);
    let m2 = parseInt(earliest.split("-")[1] as string);
    while (true) {
      const ym2 = `${y2}-${String(m2).padStart(2, "0")}`;
      if (ym2 >= startYM) break;
      const rExp = snapExp
        .filter((e) => e.date.startsWith(ym2))
        .reduce((s, e) => s + parseFloat(e.amount || "0"), 0);
      const rInc = snapInc
        .filter((i) => i.date.startsWith(ym2))
        .reduce((s, i) => s + parseFloat(i.amount || "0"), 0);
      running +=
        rInc +
        calcSnapRecurringIncTotal(snapRecInc, snapOvr, ym2) -
        rExp -
        calcSnapRecurringExpTotal(snapRecExp, ym2);
      m2++;
      if (m2 > 12) {
        m2 = 1;
        y2++;
      }
    }
  }

  return Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const ym = `${year}-${String(m).padStart(2, "0")}`;
    const regExp = snapExp
      .filter((e) => e.date.startsWith(ym))
      .reduce((s, e) => s + parseFloat(e.amount || "0"), 0);
    const regInc = snapInc
      .filter((inc) => inc.date.startsWith(ym))
      .reduce((s, inc) => s + parseFloat(inc.amount || "0"), 0);
    const recExp = calcSnapRecurringExpTotal(snapRecExp, ym);
    const recInc = calcSnapRecurringIncTotal(snapRecInc, snapOvr, ym);
    const income = regInc + recInc;
    const expenses = regExp + recExp;
    const net = income - expenses;
    running += net;
    return {
      month: ym,
      label: MONTH_NAMES[i] ?? "",
      income,
      expenses,
      net,
      runningBalance: running,
    };
  });
});
</script>

<template>
  <div class="space-y-6">
    <!-- ── Header / Year Selector ─────────────────────────────────────── -->
    <div class="bg-white rounded-lg shadow-md p-6">
      <div class="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 class="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <svg
              class="w-7 h-7 text-indigo-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
              />
            </svg>
            Financial Projections
          </h2>
          <p class="text-sm text-gray-500 mt-1">
            12-month income &amp; expense forecast — recurring payments included
          </p>
        </div>

        <!-- Year picker -->
        <div class="flex items-center gap-3">
          <button
            @click="prevYear"
            class="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-300 hover:bg-gray-100 transition-colors text-gray-600"
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
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <span
            class="text-2xl font-bold text-indigo-600 min-w-[5rem] text-center select-none"
          >
            {{ selectedYear }}
          </span>
          <button
            @click="nextYear"
            class="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-300 hover:bg-gray-100 transition-colors text-gray-600"
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
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
          <span
            v-if="selectedYear === currentYear"
            class="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium"
            >Current</span
          >
        </div>
      </div>
    </div>

    <!-- ── Summary Cards ──────────────────────────────────────────────── -->
    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
      <!-- Starting Balance -->
      <div class="bg-white rounded-lg shadow-md p-5 border-t-4 border-gray-400">
        <p class="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Starting Balance
        </p>
        <p
          class="text-2xl font-bold mt-1"
          :class="startingBalance >= 0 ? 'text-gray-800' : 'text-red-600'"
        >
          {{ fmt(startingBalance) }}
        </p>
        <p class="text-xs text-gray-400 mt-1">Jan 1, {{ selectedYear }}</p>
      </div>

      <!-- Projected Income -->
      <div
        class="bg-white rounded-lg shadow-md p-5 border-t-4 border-emerald-500"
      >
        <p
          class="text-xs font-semibold uppercase tracking-wide text-emerald-600"
        >
          Projected Income
        </p>
        <p class="text-2xl font-bold text-emerald-700 mt-1">
          {{ fmt(yearlyTotals.income) }}
        </p>
        <p class="text-xs text-gray-400 mt-1">Full-year total</p>
      </div>

      <!-- Projected Expenses -->
      <div class="bg-white rounded-lg shadow-md p-5 border-t-4 border-red-500">
        <p class="text-xs font-semibold uppercase tracking-wide text-red-600">
          Projected Expenses
        </p>
        <p class="text-2xl font-bold text-red-700 mt-1">
          {{ fmt(yearlyTotals.expenses) }}
        </p>
        <p class="text-xs text-gray-400 mt-1">Full-year total</p>
      </div>

      <!-- Net Savings -->
      <div
        class="bg-white rounded-lg shadow-md p-5 border-t-4"
        :class="yearlyTotals.net >= 0 ? 'border-blue-500' : 'border-orange-500'"
      >
        <p
          class="text-xs font-semibold uppercase tracking-wide"
          :class="yearlyTotals.net >= 0 ? 'text-blue-600' : 'text-orange-600'"
        >
          Net Savings
        </p>
        <p
          class="text-2xl font-bold mt-1"
          :class="yearlyTotals.net >= 0 ? 'text-blue-700' : 'text-orange-700'"
        >
          {{ fmt(yearlyTotals.net) }}
        </p>
        <p class="text-xs text-gray-400 mt-1">
          {{ yearlyTotals.savingsRate.toFixed(1) }}% savings rate
        </p>
      </div>

      <!-- Year-End Balance -->
      <div
        class="bg-white rounded-lg shadow-md p-5 border-t-4"
        :class="
          yearlyTotals.endBalance >= 0 ? 'border-indigo-500' : 'border-red-600'
        "
      >
        <p
          class="text-xs font-semibold uppercase tracking-wide"
          :class="
            yearlyTotals.endBalance >= 0 ? 'text-indigo-600' : 'text-red-600'
          "
        >
          Year-End Balance
        </p>
        <p
          class="text-2xl font-bold mt-1"
          :class="
            yearlyTotals.endBalance >= 0 ? 'text-indigo-700' : 'text-red-700'
          "
        >
          {{ fmt(yearlyTotals.endBalance) }}
        </p>
        <p class="text-xs text-gray-400 mt-1">Dec 31, {{ selectedYear }}</p>
      </div>
    </div>

    <!-- ── Charts ─────────────────────────────────────────────────────── -->
    <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <!-- Income vs Expenses Bar Chart -->
      <div class="bg-white rounded-lg shadow-md p-6">
        <h3
          class="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"
        >
          <svg
            class="w-5 h-5 text-emerald-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          Monthly Income vs Expenses
        </h3>
        <div class="h-72">
          <Bar :data="barChartData" :options="barOptions" />
        </div>
      </div>

      <!-- Running Balance Line Chart -->
      <div class="bg-white rounded-lg shadow-md p-6">
        <h3
          class="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"
        >
          <svg
            class="w-5 h-5 text-indigo-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
            />
          </svg>
          Projected Running Balance
        </h3>
        <div class="h-72">
          <Line :data="lineChartData" :options="lineOptions" />
        </div>
      </div>
    </div>

    <!-- ── Monthly Breakdown Table ────────────────────────────────────── -->
    <div class="bg-white rounded-lg shadow-md p-6">
      <h3 class="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
        <svg
          class="w-5 h-5 text-gray-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M3 10h18M3 14h18M10 4v16M6 4h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2z"
          />
        </svg>
        Monthly Breakdown — {{ selectedYear }}
      </h3>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left border-b-2 border-gray-200">
              <th class="pb-3 text-gray-500 font-semibold">Month</th>
              <th class="pb-3 text-emerald-600 font-semibold text-right">
                Income
              </th>
              <th class="pb-3 text-red-600 font-semibold text-right">
                Expenses
              </th>
              <th class="pb-3 text-gray-700 font-semibold text-right">Net</th>
              <th class="pb-3 text-indigo-600 font-semibold text-right">
                Balance
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in monthlyData"
              :key="row.month"
              class="border-b border-gray-100 hover:bg-gray-50 transition-colors"
              :class="{
                'bg-indigo-50/40':
                  row.month ===
                    `${selectedYear}-${String(new Date().getMonth() + 1).padStart(2, '0')}` &&
                  selectedYear === currentYear,
              }"
            >
              <td
                class="py-3 font-medium text-gray-800 flex items-center gap-2"
              >
                <span
                  v-if="
                    row.month ===
                      `${selectedYear}-${String(new Date().getMonth() + 1).padStart(2, '0')}` &&
                    selectedYear === currentYear
                  "
                  class="inline-block w-2 h-2 rounded-full bg-indigo-500"
                ></span>
                {{ row.label }}
              </td>
              <td class="py-3 text-right text-emerald-700 font-medium">
                {{ row.income > 0 ? fmt(row.income) : "—" }}
              </td>
              <td class="py-3 text-right text-red-700 font-medium">
                {{ row.expenses > 0 ? fmt(row.expenses) : "—" }}
              </td>
              <td
                class="py-3 text-right font-semibold"
                :class="row.net >= 0 ? 'text-emerald-600' : 'text-red-600'"
              >
                {{
                  row.net !== 0 ? (row.net > 0 ? "+" : "") + fmt(row.net) : "—"
                }}
              </td>
              <td
                class="py-3 text-right font-bold"
                :class="
                  row.runningBalance >= 0 ? 'text-indigo-700' : 'text-red-700'
                "
              >
                {{ fmt(row.runningBalance) }}
              </td>
            </tr>
          </tbody>
          <!-- Totals row -->
          <tfoot>
            <tr class="border-t-2 border-gray-300 bg-gray-50">
              <td class="py-3 font-bold text-gray-800">Yearly Total</td>
              <td class="py-3 text-right font-bold text-emerald-700">
                {{ fmt(yearlyTotals.income) }}
              </td>
              <td class="py-3 text-right font-bold text-red-700">
                {{ fmt(yearlyTotals.expenses) }}
              </td>
              <td
                class="py-3 text-right font-bold"
                :class="
                  yearlyTotals.net >= 0 ? 'text-emerald-600' : 'text-red-600'
                "
              >
                {{ (yearlyTotals.net > 0 ? "+" : "") + fmt(yearlyTotals.net) }}
              </td>
              <td
                class="py-3 text-right font-bold"
                :class="
                  yearlyTotals.endBalance >= 0
                    ? 'text-indigo-700'
                    : 'text-red-700'
                "
              >
                {{ fmt(yearlyTotals.endBalance) }}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>

    <!-- ── Active Recurring Transactions ─────────────────────────────── -->
    <div
      v-if="
        activeRecurringExpenses.length > 0 || activeRecurringIncomes.length > 0
      "
      class="grid grid-cols-1 lg:grid-cols-2 gap-6"
    >
      <!-- Recurring Expenses -->
      <div
        v-if="activeRecurringExpenses.length > 0"
        class="bg-white rounded-lg shadow-md p-6"
      >
        <h3
          class="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"
        >
          <svg
            class="w-5 h-5 text-red-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Recurring Expenses active in {{ selectedYear }}
        </h3>
        <div class="space-y-2">
          <div
            v-for="rec in activeRecurringExpenses"
            :key="rec.id"
            class="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100"
          >
            <div class="min-w-0">
              <p class="font-medium text-gray-800 truncate">
                {{ rec.description }}
              </p>
              <p class="text-xs text-gray-500 capitalize">
                {{ rec.frequency }}
              </p>
            </div>
            <div class="text-right ml-4 shrink-0">
              <p class="font-bold text-red-700">
                {{ fmt(parseFloat(rec.amount)) }}
              </p>
              <p class="text-xs text-gray-500">per occurrence</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Recurring Incomes -->
      <div
        v-if="activeRecurringIncomes.length > 0"
        class="bg-white rounded-lg shadow-md p-6"
      >
        <h3
          class="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"
        >
          <svg
            class="w-5 h-5 text-emerald-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Recurring Income active in {{ selectedYear }}
        </h3>
        <div class="space-y-2">
          <div
            v-for="rec in activeRecurringIncomes"
            :key="rec.id"
            class="flex items-center justify-between p-3 bg-emerald-50 rounded-lg border border-emerald-100"
          >
            <div class="min-w-0">
              <p class="font-medium text-gray-800 truncate">
                {{ rec.description }}
              </p>
              <p class="text-xs text-gray-500 capitalize">
                {{ rec.frequency }}
              </p>
            </div>
            <div class="text-right ml-4 shrink-0">
              <p class="font-bold text-emerald-700">
                {{ fmt(parseFloat(rec.amount)) }}
              </p>
              <p class="text-xs text-gray-500">per occurrence</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty state when no recurring at all -->
      <div
        v-if="
          activeRecurringExpenses.length === 0 &&
          activeRecurringIncomes.length === 0
        "
        class="col-span-2 bg-white rounded-lg shadow-md p-8 text-center text-gray-400"
      >
        <p>No recurring transactions active in {{ selectedYear }}.</p>
        <router-link
          to="/recurring"
          class="text-indigo-500 hover:underline text-sm mt-1 inline-block"
        >
          Add recurring transactions →
        </router-link>
      </div>
    </div>

    <!-- Empty state when there is zero recurring data -->
    <div
      v-if="
        activeRecurringExpenses.length === 0 &&
        activeRecurringIncomes.length === 0
      "
      class="bg-white rounded-lg shadow-md p-8 text-center"
    >
      <svg
        class="w-12 h-12 text-gray-300 mx-auto mb-3"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="1.5"
          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
        />
      </svg>
      <p class="text-gray-500 font-medium">
        No recurring transactions active in {{ selectedYear }}
      </p>
      <p class="text-gray-400 text-sm mt-1">
        Add recurring payments to make projections more accurate.
      </p>
      <router-link
        to="/recurring"
        class="mt-3 inline-block px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors text-sm font-medium"
      >
        Manage Recurring →
      </router-link>
    </div>
  </div>
</template>

<style scoped></style>
