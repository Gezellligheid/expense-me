<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import DateRangePicker from "../components/DateRangePicker.vue";
import {
  storageService,
  type Expense,
  type Income,
} from "../services/storageService";
import { testDataService } from "../services/testDataService";
import { useSettings } from "../composables/useSettings";
import { useSimulation } from "../composables/useSimulation";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
} from "chart.js";
import { Bar, Doughnut } from "vue-chartjs";
import * as XLSX from "xlsx";

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
);

const { formatCurrency: fmt, isTestMode } = useSettings();
const { isSimulating } = useSimulation();

// Use test data in dev test mode, real storage otherwise
const ds = computed(() =>
  isTestMode.value ? testDataService : storageService,
);

// True when simulation has introduced at least one change that affects the balance
// const balanceChanged = computed(() => {
//   if (!isSimulating.value) return false;
//   return (
//     expenses.value.some((e) => e._sim) ||
//     incomes.value.some((i) => i._sim) ||
//     storageService.loadRecurringExpenses().some((r) => r._sim) ||
//     storageService.loadRecurringIncomes().some((r) => r._sim)
//   );
// });

// True when simulation has introduced a change that affects the budget card month
const budgetChanged = computed(() => {
  if (!isSimulating.value) return false;
  const ym = budgetCardYM.value;
  return (
    expenses.value.some((e) => e._sim && e.date.startsWith(ym)) ||
    incomes.value.some((i) => i._sim && i.date.startsWith(ym)) ||
    storageService.loadRecurringExpenses().some((r) => r._sim) ||
    storageService.loadRecurringIncomes().some((r) => r._sim)
  );
});

const expenses = ref<Expense[]>([]);
const incomes = ref<Income[]>([]);
const rangeStart = ref("");
const rangeEnd = ref("");
const showInitialBalanceModal = ref(false);
const initialBalanceInput = ref("");
const initialBalance = ref<number | null>(null);

// ── Date-range helpers ─────────────────────────────────────────────
const getMonthsInRange = (start: string, end: string): string[] => {
  const months: string[] = [];
  if (!start || !end) return months;
  const cur = new Date(
    parseInt(start.slice(0, 4)),
    parseInt(start.slice(5, 7)) - 1,
    1,
  );
  const last = new Date(
    parseInt(end.slice(0, 4)),
    parseInt(end.slice(5, 7)) - 1,
    1,
  );
  while (cur <= last) {
    months.push(
      `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`,
    );
    cur.setMonth(cur.getMonth() + 1);
  }
  return months;
};

const setMonthRange = (year: number, month: number) => {
  const lastDay = new Date(year, month + 1, 0).getDate();
  rangeStart.value = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  rangeEnd.value = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
};

const selectThisMonth = () => {
  const d = new Date();
  setMonthRange(d.getFullYear(), d.getMonth());
};

const selectLastMonth = () => {
  const d = new Date();
  const prev = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  setMonthRange(prev.getFullYear(), prev.getMonth());
};

const selectLast3Months = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  rangeStart.value = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-01`;
  rangeEnd.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
};

const selectThisYear = () => {
  const y = new Date().getFullYear();
  rangeStart.value = `${y}-01-01`;
  rangeEnd.value = `${y}-12-31`;
};

// Shift the selected range by one month (only when a single-month range is active)
const shiftMonth = (delta: number) => {
  const base = rangeStart.value || new Date().toISOString().slice(0, 10);
  const d = new Date(base + "T00:00:00");
  d.setDate(1);
  d.setMonth(d.getMonth() + delta);
  setMonthRange(d.getFullYear(), d.getMonth());
};

const loadData = () => {
  expenses.value = ds.value.loadExpenses();
  incomes.value = ds.value.loadIncomes();
  initialBalance.value = ds.value.getInitialBalance() ?? null;
};

const handleStorageUpdate = () => {
  loadData();
};

onMounted(() => {
  loadData();
  // Always default to current month
  const today = new Date();
  setMonthRange(today.getFullYear(), today.getMonth());
  window.addEventListener("storage-updated", handleStorageUpdate);
});

onUnmounted(() => {
  window.removeEventListener("storage-updated", handleStorageUpdate);
});

// Get unique months from all transactions (kept for balance carry-forward calc)
const availableMonths = computed(() => {
  const allDates = [
    ...expenses.value.map((e) => e.date),
    ...incomes.value.map((i) => i.date),
  ];
  const months = new Set(allDates.map((date) => date.substring(0, 7)));

  // Always include the current and range boundary months
  const today = new Date();
  months.add(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`,
  );
  if (rangeStart.value) months.add(rangeStart.value.substring(0, 7));
  if (rangeEnd.value) months.add(rangeEnd.value.substring(0, 7));

  return Array.from(months).sort();
});

// Filter data by selected date range
const filteredExpenses = computed(() => {
  const regular = expenses.value.filter(
    (exp) => exp.date >= rangeStart.value && exp.date <= rangeEnd.value,
  );
  const months = getMonthsInRange(rangeStart.value, rangeEnd.value);
  const recurring = months.flatMap((ym) =>
    ds.value
      .calculateRecurringExpensesForMonth(ym)
      .filter((e) => e.date >= rangeStart.value && e.date <= rangeEnd.value),
  );
  return [...regular, ...recurring];
});

const filteredIncomes = computed(() => {
  const regular = incomes.value.filter(
    (inc) => inc.date >= rangeStart.value && inc.date <= rangeEnd.value,
  );
  const months = getMonthsInRange(rangeStart.value, rangeEnd.value);
  const recurring = months.flatMap((ym) =>
    ds.value
      .calculateRecurringIncomesForMonth(ym)
      .filter((i) => i.date >= rangeStart.value && i.date <= rangeEnd.value),
  );
  return [...regular, ...recurring];
});

// ── Date-dot sets for DateRangePicker indicator circles ────────────────────
const calendarMonthsForDots = computed(() => {
  const now = new Date();
  const months = new Set(availableMonths.value);
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    months.add(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    );
  }
  return Array.from(months);
});

const allExpenseDates = computed(() => {
  const dates = new Set(expenses.value.map((e) => e.date));
  calendarMonthsForDots.value.forEach((ym) =>
    ds.value
      .calculateRecurringExpensesForMonth(ym)
      .forEach((e) => dates.add(e.date)),
  );
  return Array.from(dates);
});

const allIncomeDates = computed(() => {
  const dates = new Set(incomes.value.map((i) => i.date));
  calendarMonthsForDots.value.forEach((ym) =>
    ds.value
      .calculateRecurringIncomesForMonth(ym)
      .forEach((inc) => dates.add(inc.date)),
  );
  return Array.from(dates);
});

// Calculate totals
const totalExpenses = computed(() => {
  return filteredExpenses.value.reduce(
    (sum, exp) => sum + parseFloat(exp.amount || "0"),
    0,
  );
});

const totalIncome = computed(() => {
  return filteredIncomes.value.reduce(
    (sum, inc) => sum + parseFloat(inc.amount || "0"),
    0,
  );
});

// Calculate balance from all months prior to rangeStart
const getPreviousMonthsBalance = computed(() => {
  if (!rangeStart.value) return 0;

  const rangeStartMonth = rangeStart.value.substring(0, 7);
  let cumulativeBalance = initialBalance.value || 0;

  // Build the earliest month to start from: the smallest of all one-off
  // transaction dates AND all recurring rule startDates, so months that
  // contain ONLY recurring transactions are never skipped.
  const allStartDates = [
    ...expenses.value.map((e) => e.date.substring(0, 7)),
    ...incomes.value.map((i) => i.date.substring(0, 7)),
    ...storageService
      .loadRecurringExpenses()
      .map((r) => r.startDate.substring(0, 7)),
    ...storageService
      .loadRecurringIncomes()
      .map((r) => r.startDate.substring(0, 7)),
  ];
  if (allStartDates.length === 0) return cumulativeBalance;

  const earliestMonth = allStartDates.sort()[0]!;
  if (earliestMonth >= rangeStartMonth) return cumulativeBalance;

  // Walk every calendar month from earliest up to (but not including) rangeStart
  const [ey, em] = earliestMonth.split("-").map(Number) as [number, number];
  const [ry, rm] = rangeStartMonth.split("-").map(Number) as [number, number];
  let year = ey;
  let month = em; // 1-indexed

  while (year < ry || (year === ry && month < rm)) {
    const ym = `${year}-${String(month).padStart(2, "0")}`;

    const regularExpenses = expenses.value
      .filter((exp) => exp.date.startsWith(ym))
      .reduce((sum, exp) => sum + parseFloat(exp.amount || "0"), 0);
    const recurringExpenses = storageService
      .calculateRecurringExpensesForMonth(ym)
      .reduce((sum, exp) => sum + parseFloat(exp.amount || "0"), 0);

    const regularIncome = incomes.value
      .filter((inc) => inc.date.startsWith(ym))
      .reduce((sum, inc) => sum + parseFloat(inc.amount || "0"), 0);
    const recurringIncome = storageService
      .calculateRecurringIncomesForMonth(ym)
      .reduce((sum, inc) => sum + parseFloat(inc.amount || "0"), 0);

    cumulativeBalance +=
      regularIncome + recurringIncome - (regularExpenses + recurringExpenses);

    if (month === 12) {
      month = 1;
      year++;
    } else {
      month++;
    }
  }

  return cumulativeBalance;
});

const balance = computed(() => {
  const currentMonthBalance = totalIncome.value - totalExpenses.value;
  return getPreviousMonthsBalance.value + currentMonthBalance;
});

// ── Budget card ───────────────────────────────────────────────
const todayYM = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
})();

const nextMonthYM = (() => {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
})();

// Follow the selected range when it covers exactly one month; else today.
const budgetCardYM = computed(() => {
  if (
    rangeStart.value &&
    rangeEnd.value &&
    rangeStart.value.slice(0, 7) === rangeEnd.value.slice(0, 7)
  ) {
    return rangeStart.value.slice(0, 7);
  }
  return todayYM;
});

const MONTH_NAMES_FULL = [
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

const budgetCardLabel = computed(() => {
  const ym = budgetCardYM.value;
  if (ym === todayYM) return "This Month Left";
  if (ym === nextMonthYM) return "Next Month's Budget";
  const month = parseInt(ym.slice(5, 7)) - 1;
  return `${MONTH_NAMES_FULL[month]}'s Budget`;
});

const thisMonthIncome = computed(() => {
  const regular = incomes.value
    .filter((i) => i.date.startsWith(budgetCardYM.value))
    .reduce((s, i) => s + parseFloat(i.amount || "0"), 0);
  const recurring = storageService
    .calculateRecurringIncomesForMonth(budgetCardYM.value)
    .reduce((s, i) => s + parseFloat(i.amount || "0"), 0);
  return regular + recurring;
});

const thisMonthExpenses = computed(() => {
  const regular = expenses.value
    .filter((e) => e.date.startsWith(budgetCardYM.value))
    .reduce((s, e) => s + parseFloat(e.amount || "0"), 0);
  const recurring = storageService
    .calculateRecurringExpensesForMonth(budgetCardYM.value)
    .reduce((s, e) => s + parseFloat(e.amount || "0"), 0);
  return regular + recurring;
});

const thisMonthLeft = computed(
  () => thisMonthIncome.value - thisMonthExpenses.value,
);
const thisMonthSpendPct = computed(() =>
  thisMonthIncome.value > 0
    ? Math.min(100, (thisMonthExpenses.value / thisMonthIncome.value) * 100)
    : 0,
);

const openInitialBalanceModal = () => {
  initialBalanceInput.value = initialBalance.value?.toString() || "";
  showInitialBalanceModal.value = true;
};

const closeInitialBalanceModal = () => {
  showInitialBalanceModal.value = false;
  initialBalanceInput.value = "";
};

const saveInitialBalance = () => {
  const amount = parseFloat(initialBalanceInput.value);
  if (isNaN(amount)) return;

  if (storageService.hasData()) {
    if (
      !confirm(
        "Setting an initial balance will reset all existing expenses and incomes. Continue?",
      )
    ) {
      return;
    }
  }

  storageService.setInitialBalance(amount);
  initialBalance.value = amount;
  loadData();
  closeInitialBalanceModal();
};

// Range display label
const selectedRangeLabel = computed(() => {
  if (!rangeStart.value || !rangeEnd.value) return "";
  const s = new Date(rangeStart.value + "T00:00:00");
  const e = new Date(rangeEnd.value + "T00:00:00");
  if (s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth()) {
    return s.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }
  return `${s.toLocaleDateString("en-US", { month: "short", year: "numeric" })} – ${e.toLocaleDateString("en-US", { month: "short", year: "numeric" })}`;
});

// ── Transaction history (manual only) ──────────────────────────────────
const manualExpenses = computed(() =>
  expenses.value
    .filter((e) => e.date >= rangeStart.value && e.date <= rangeEnd.value)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date)),
);

const manualIncomes = computed(() =>
  incomes.value
    .filter((i) => i.date >= rangeStart.value && i.date <= rangeEnd.value)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date)),
);

const historyTab = ref<"expenses" | "incomes">("expenses");

const removeExpense = (exp: Expense) => {
  storageService.deleteExpense(exp);
  loadData();
};

const removeIncome = (inc: Income) => {
  storageService.deleteIncome(inc);
  loadData();
};

// Category breakdown for expenses
const expensesByCategory = computed(() => {
  const categories: Record<string, number> = {};
  filteredExpenses.value.forEach((exp) => {
    const category = exp.description || "Uncategorized";
    categories[category] = (categories[category] || 0) + parseFloat(exp.amount);
  });
  return categories;
});

// Monthly insights
// Days in the selected range
const daysInRange = computed(() => {
  if (!rangeStart.value || !rangeEnd.value) return 30;
  const s = new Date(rangeStart.value + "T00:00:00");
  const e = new Date(rangeEnd.value + "T00:00:00");
  return Math.max(1, Math.round((e.getTime() - s.getTime()) / 86_400_000) + 1);
});

const averageDailySpending = computed(() => {
  return totalExpenses.value / daysInRange.value;
});

const biggestExpense = computed(() => {
  if (filteredExpenses.value.length === 0) return null;
  return filteredExpenses.value.reduce((max, exp) =>
    parseFloat(exp.amount) > parseFloat(max.amount) ? exp : max,
  );
});

const savingsRate = computed(() => {
  if (totalIncome.value === 0) return 0;
  return ((totalIncome.value - totalExpenses.value) / totalIncome.value) * 100;
});

// Previous period comparison (month before rangeStart)
const previousMonthData = computed(() => {
  if (!rangeStart.value) return null;
  const rangeStartMonth = rangeStart.value.substring(0, 7);
  const allMonths = availableMonths.value;
  const currentIndex = allMonths.indexOf(rangeStartMonth);

  if (currentIndex <= 0) return null;

  const prevMonth = allMonths[currentIndex - 1];
  const prevRegularExpenses = expenses.value
    .filter((exp) => exp.date.startsWith(prevMonth as string))
    .reduce((sum, exp) => sum + parseFloat(exp.amount || "0"), 0);

  const prevRecurringExpenses = storageService
    .calculateRecurringExpensesForMonth(prevMonth as string)
    .reduce((sum, exp) => sum + parseFloat(exp.amount || "0"), 0);

  const prevExpenses = prevRegularExpenses + prevRecurringExpenses;

  return {
    month: prevMonth,
    expenses: prevExpenses,
    change: totalExpenses.value - prevExpenses,
    changePercent:
      prevExpenses > 0
        ? ((totalExpenses.value - prevExpenses) / prevExpenses) * 100
        : 0,
  };
});

// Chart colors palette
const CHART_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#6366f1",
  "#84cc16",
  "#06b6d4",
  "#a855f7",
  "#f43f5e",
  "#10b981",
  "#0ea5e9",
];

// Doughnut chart — expenses by category
const doughnutChartData = computed(() => {
  const labels = Object.keys(expensesByCategory.value);
  const data = Object.values(expensesByCategory.value);
  return {
    labels,
    datasets: [
      {
        data,
        backgroundColor: CHART_COLORS.slice(0, labels.length),
        borderWidth: 2,
        borderColor: "#ffffff",
        hoverBorderWidth: 3,
      },
    ],
  };
});

const doughnutChartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: "right" as const,
      labels: { padding: 16, usePointStyle: true, pointStyleWidth: 10 },
    },
    tooltip: {
      callbacks: {
        label: (ctx: { label: string; parsed: number }) =>
          ` ${ctx.label}: ${fmt(ctx.parsed)}`,
      },
    },
  },
}));

// Bar chart — income vs expenses
const barChartData = computed(() => ({
  labels: ["Income", "Expenses"],
  datasets: [
    {
      label: selectedRangeLabel.value,
      data: [totalIncome.value, totalExpenses.value],
      backgroundColor: ["rgba(34, 197, 94, 0.75)", "rgba(239, 68, 68, 0.75)"],
      borderColor: ["rgb(22, 163, 74)", "rgb(220, 38, 38)"],
      borderWidth: 2,
      borderRadius: 8,
      borderSkipped: false,
    },
  ],
}));

const barChartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (ctx: { parsed: { y: number | null } }) =>
          fmt(ctx.parsed.y ?? 0),
      },
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      ticks: {
        callback: (val: number | string) =>
          typeof val === "number" ? fmt(val) : val,
      },
      grid: { color: "rgba(0,0,0,0.06)" },
    },
    x: { grid: { display: false } },
  },
}));

// Export to Excel
const exportExcel = () => {
  const wb = XLSX.utils.book_new();

  // Summary sheet
  const summaryRows = [
    ["Financial Summary", selectedRangeLabel.value],
    [],
    ["Metric", "Value"],
    ["Total Income", totalIncome.value],
    ["Total Expenses", totalExpenses.value],
    ["Balance", balance.value],
    ["Savings Rate", `${savingsRate.value.toFixed(1)}%`],
    ["Avg. Daily Spending", averageDailySpending.value],
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
  summarySheet["!cols"] = [{ wch: 22 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, summarySheet, "Summary");

  // Expenses sheet
  const expenseRows = filteredExpenses.value.map((e) => ({
    Date: e.date,
    Description: e.description || "Uncategorized",
    Amount: parseFloat(e.amount),
  }));
  if (expenseRows.length > 0) {
    const expSheet = XLSX.utils.json_to_sheet(expenseRows);
    expSheet["!cols"] = [{ wch: 14 }, { wch: 30 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, expSheet, "Expenses");
  }

  // Income sheet
  const incomeRows = filteredIncomes.value.map((i) => ({
    Date: i.date,
    Description: i.description || "Uncategorized",
    Amount: parseFloat(i.amount),
  }));
  if (incomeRows.length > 0) {
    const incSheet = XLSX.utils.json_to_sheet(incomeRows);
    incSheet["!cols"] = [{ wch: 14 }, { wch: 30 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, incSheet, "Income");
  }

  XLSX.writeFile(wb, `expenses-${rangeStart.value}-${rangeEnd.value}.xlsx`);
};

// Keep CSV export as an option
const exportCSV = () => {
  let csv = "Type,Date,Description,Amount\n";
  filteredExpenses.value.forEach((exp) => {
    csv += `Expense,${exp.date},"${exp.description}",${exp.amount}\n`;
  });
  filteredIncomes.value.forEach((inc) => {
    csv += `Income,${inc.date},"${inc.description}",${inc.amount}\n`;
  });
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `expenses-${rangeStart.value}-${rangeEnd.value}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};
</script>

<template>
  <div class="space-y-6">
    <!-- Month Selector and Initial Balance -->
    <div class="bg-white rounded-lg shadow-md p-4 sm:p-6">
      <div class="flex flex-col gap-4">
        <!-- Row 1: title + initial balance -->
        <div class="flex items-center justify-between gap-3 flex-wrap">
          <h2 class="text-xl sm:text-2xl font-bold text-gray-800">
            Financial Overview
          </h2>
          <button
            @click="openInitialBalanceModal"
            class="text-sm px-3 py-1 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
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
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
            {{ initialBalance !== null ? "Edit" : "Set" }} Initial Balance
          </button>
        </div>
        <!-- Row 2: exports + date range -->
        <div class="flex flex-col sm:flex-row sm:items-end gap-3">
          <!-- Export buttons -->
          <div class="flex items-center gap-2">
            <button
              @click="exportExcel"
              class="text-sm px-3 py-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors flex items-center gap-2"
              title="Export as Excel (.xlsx)"
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
                  d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Excel
            </button>
            <button
              @click="exportCSV"
              class="text-sm px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
              title="Export as CSV"
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
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              CSV
            </button>
          </div>
          <!-- Date range section -->
          <label class="text-sm font-medium text-gray-700 sr-only"
            >Date range</label
          >
          <div class="flex flex-col gap-2 sm:ml-auto">
            <!-- Quick-select pills -->
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="text-xs font-medium text-gray-500 mr-0.5"
                >Quick:</span
              >
              <button
                @click="selectThisMonth"
                class="text-xs px-2.5 py-1 rounded-full border border-blue-300 text-blue-700 hover:bg-blue-500 hover:text-white transition-colors"
              >
                This Month
              </button>
              <button
                @click="selectLastMonth"
                class="text-xs px-2.5 py-1 rounded-full border border-gray-300 text-gray-600 hover:bg-gray-500 hover:text-white transition-colors"
              >
                Last Month
              </button>
              <button
                @click="selectLast3Months"
                class="text-xs px-2.5 py-1 rounded-full border border-gray-300 text-gray-600 hover:bg-gray-500 hover:text-white transition-colors"
              >
                Last 3 Months
              </button>
              <button
                @click="selectThisYear"
                class="text-xs px-2.5 py-1 rounded-full border border-gray-300 text-gray-600 hover:bg-gray-500 hover:text-white transition-colors"
              >
                This Year
              </button>
            </div>
            <!-- Custom date range picker -->
            <div class="flex items-center gap-1">
              <button
                @click="shiftMonth(-1)"
                title="Previous month"
                class="p-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-100 transition-colors"
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
              <DateRangePicker
                :start="rangeStart"
                :end="rangeEnd"
                :expense-dates="allExpenseDates"
                :income-dates="allIncomeDates"
                @update:start="rangeStart = $event"
                @update:end="rangeEnd = $event"
              />
              <button
                @click="shiftMonth(1)"
                title="Next month"
                class="p-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-100 transition-colors"
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
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Summary Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      <!-- Income Card -->
      <div
        class="bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg shadow-lg p-6 text-white"
      >
        <div class="flex items-center justify-between">
          <div>
            <p class="text-green-100 text-sm font-medium">Total Income</p>
            <p class="text-3xl font-bold mt-2">{{ fmt(totalIncome) }}</p>
            <p class="text-green-100 text-xs mt-1">
              {{ filteredIncomes.length }} transactions
            </p>
          </div>
          <svg
            class="w-12 h-12 text-green-200"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M7 11l5-5m0 0l5 5m-5-5v12"
            />
          </svg>
        </div>
      </div>

      <!-- Expenses Card -->
      <div
        class="bg-gradient-to-br from-red-500 to-pink-600 rounded-lg shadow-lg p-6 text-white"
      >
        <div class="flex items-center justify-between">
          <div>
            <p class="text-red-100 text-sm font-medium">Total Expenses</p>
            <p class="text-3xl font-bold mt-2">
              {{ fmt(totalExpenses) }}
            </p>
            <p class="text-red-100 text-xs mt-1">
              {{ filteredExpenses.length }} transactions
            </p>
          </div>
          <svg
            class="w-12 h-12 text-red-200"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M17 13l-5 5m0 0l-5-5m5 5V6"
            />
          </svg>
        </div>
      </div>

      <!-- Balance Card -->
      <div
        :class="[
          'rounded-lg shadow-lg p-6 text-white',
          balance >= 0
            ? 'bg-gradient-to-br from-blue-500 to-purple-600'
            : 'bg-gradient-to-br from-orange-500 to-red-600',
          isSimulating ? 'sim-entry' : '',
        ]"
      >
        <div class="flex items-center justify-between">
          <div>
            <p class="text-white text-opacity-90 text-sm font-medium">
              Balance
            </p>
            <p class="text-3xl font-bold mt-2">
              {{ fmt(Math.abs(balance)) }}
            </p>
            <p class="text-white text-opacity-90 text-xs mt-1">
              {{ balance >= 0 ? "Surplus" : "Deficit" }}
            </p>
          </div>
          <svg
            class="w-12 h-12 text-white text-opacity-70"
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
        </div>
      </div>

      <!-- This Month Budget Card -->
      <div
        :class="[
          'rounded-lg shadow-lg p-6 text-white',
          thisMonthLeft >= 0
            ? 'bg-gradient-to-br from-teal-500 to-cyan-600'
            : 'bg-gradient-to-br from-rose-500 to-red-600',
          budgetChanged ? 'sim-entry' : '',
        ]"
      >
        <div class="flex items-center justify-between mb-3">
          <div>
            <p class="text-white/90 text-sm font-medium">
              {{ budgetCardLabel }}
            </p>
            <p class="text-3xl font-bold mt-1">
              {{ fmt(Math.abs(thisMonthLeft)) }}
            </p>
            <p class="text-white/80 text-xs mt-1">
              {{ thisMonthLeft >= 0 ? "under budget" : "over budget" }}
            </p>
          </div>
          <svg
            class="w-12 h-12 text-white/70"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        </div>
        <!-- Spend progress bar -->
        <div class="mt-2">
          <div class="flex justify-between text-xs text-white/75 mb-1">
            <span>{{ fmt(thisMonthExpenses) }} spent</span>
            <span>of {{ fmt(thisMonthIncome) }}</span>
          </div>
          <div class="w-full bg-white/20 rounded-full h-1.5">
            <div
              class="h-1.5 rounded-full transition-all duration-500"
              :class="thisMonthSpendPct >= 100 ? 'bg-red-300' : 'bg-white/80'"
              :style="{ width: thisMonthSpendPct + '%' }"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Monthly Insights -->
    <div class="bg-white rounded-lg shadow-md p-6">
      <h3 class="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
        <svg
          class="w-6 h-6 text-blue-500"
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
        Monthly Insights
      </h3>
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <!-- Average Daily Spending -->
        <div
          class="p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg border border-purple-100"
        >
          <p class="text-sm text-purple-600 font-medium">Avg. Daily Spending</p>
          <p class="text-2xl font-bold text-purple-700 mt-1">
            {{ fmt(averageDailySpending) }}
          </p>
          <p class="text-xs text-purple-500 mt-1">Per day this month</p>
        </div>

        <!-- Biggest Expense -->
        <div
          class="p-4 bg-gradient-to-br from-orange-50 to-red-50 rounded-lg border border-orange-100"
        >
          <p class="text-sm text-orange-600 font-medium">Biggest Expense</p>
          <p class="text-2xl font-bold text-orange-700 mt-1">
            {{
              biggestExpense ? fmt(parseFloat(biggestExpense.amount)) : fmt(0)
            }}
          </p>
          <p class="text-xs text-orange-500 mt-1 truncate">
            {{ biggestExpense?.description || "No expenses yet" }}
          </p>
        </div>

        <!-- Savings Rate -->
        <div
          class="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-green-100"
        >
          <p class="text-sm text-green-600 font-medium">Savings Rate</p>
          <p class="text-2xl font-bold text-green-700 mt-1">
            {{ savingsRate.toFixed(1) }}%
          </p>
          <p class="text-xs text-green-500 mt-1">
            {{ savingsRate >= 0 ? "Saving money" : "Spending more" }}
          </p>
        </div>

        <!-- Month Comparison -->
        <div
          v-if="previousMonthData"
          class="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-100"
        >
          <p class="text-sm text-blue-600 font-medium">vs Last Month</p>
          <p
            class="text-2xl font-bold mt-1"
            :class="
              previousMonthData.change > 0 ? 'text-red-700' : 'text-green-700'
            "
          >
            {{ previousMonthData.change > 0 ? "+" : ""
            }}{{ fmt(Math.abs(previousMonthData.change)) }}
          </p>
          <p
            class="text-xs mt-1"
            :class="
              previousMonthData.change > 0 ? 'text-red-500' : 'text-green-500'
            "
          >
            {{ previousMonthData.change > 0 ? "↑" : "↓" }}
            {{ Math.abs(previousMonthData.changePercent).toFixed(1) }}% spending
          </p>
        </div>
        <div
          v-else
          class="p-4 bg-gradient-to-br from-gray-50 to-slate-50 rounded-lg border border-gray-100"
        >
          <p class="text-sm text-gray-600 font-medium">vs Last Month</p>
          <p class="text-2xl font-bold text-gray-700 mt-1">—</p>
          <p class="text-xs text-gray-500 mt-1">First month</p>
        </div>
      </div>
    </div>

    <!-- Expenses Breakdown Chart -->
    <div
      v-if="Object.keys(expensesByCategory).length > 0"
      class="bg-white rounded-lg shadow-md p-6"
    >
      <h3 class="text-xl font-bold text-gray-800 mb-6">Expenses by Category</h3>
      <div class="relative h-72">
        <Doughnut :data="doughnutChartData" :options="doughnutChartOptions" />
      </div>
    </div>

    <!-- Income vs Expenses Chart -->
    <div class="bg-white rounded-lg shadow-md p-6">
      <h3 class="text-xl font-bold text-gray-800 mb-6">Income vs Expenses</h3>
      <div class="relative h-64">
        <Bar :data="barChartData" :options="barChartOptions" />
      </div>
    </div>

    <!-- Transaction History -->
    <div
      id="history"
      class="bg-white dark:bg-gray-900 rounded-lg shadow-md p-6"
    >
      <div class="flex items-center justify-between mb-5">
        <h3 class="text-xl font-bold text-gray-800 dark:text-gray-100">
          Transaction History
        </h3>
        <span class="text-xs text-gray-400 dark:text-gray-500"
          >Manual transactions only</span
        >
      </div>

      <!-- Summary mini-cards -->
      <div class="grid grid-cols-2 gap-3 mb-5">
        <div
          class="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 flex items-center gap-3"
        >
          <div
            class="w-8 h-8 rounded-full bg-red-100 dark:bg-red-800 flex items-center justify-center shrink-0"
          >
            <svg
              class="w-4 h-4 text-red-600 dark:text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M17 13l-5 5m0 0l-5-5m5 5V6"
              />
            </svg>
          </div>
          <div>
            <p class="text-xs text-red-500 dark:text-red-400 font-medium">
              {{ manualExpenses.length }} Expenses
            </p>
            <p class="text-base font-bold text-red-700 dark:text-red-300">
              {{
                fmt(
                  manualExpenses.reduce(
                    (s, e) => s + parseFloat(e.amount || "0"),
                    0,
                  ),
                )
              }}
            </p>
          </div>
        </div>
        <div
          class="p-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 flex items-center gap-3"
        >
          <div
            class="w-8 h-8 rounded-full bg-green-100 dark:bg-green-800 flex items-center justify-center shrink-0"
          >
            <svg
              class="w-4 h-4 text-green-600 dark:text-green-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M7 11l5-5m0 0l5 5m-5-5v12"
              />
            </svg>
          </div>
          <div>
            <p class="text-xs text-green-500 dark:text-green-400 font-medium">
              {{ manualIncomes.length }} Incomes
            </p>
            <p class="text-base font-bold text-green-700 dark:text-green-300">
              {{
                fmt(
                  manualIncomes.reduce(
                    (s, i) => s + parseFloat(i.amount || "0"),
                    0,
                  ),
                )
              }}
            </p>
          </div>
        </div>
      </div>

      <!-- Tabs -->
      <div
        class="flex gap-1 mb-4 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit"
      >
        <button
          @click="historyTab = 'expenses'"
          :class="
            historyTab === 'expenses'
              ? 'bg-white dark:bg-gray-700 text-red-600 dark:text-red-400 shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
          "
          class="px-4 py-1.5 rounded-md text-sm font-medium transition-all"
        >
          Expenses
        </button>
        <button
          @click="historyTab = 'incomes'"
          :class="
            historyTab === 'incomes'
              ? 'bg-white dark:bg-gray-700 text-green-600 dark:text-green-400 shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
          "
          class="px-4 py-1.5 rounded-md text-sm font-medium transition-all"
        >
          Incomes
        </button>
      </div>

      <!-- Expense rows -->
      <div v-if="historyTab === 'expenses'">
        <div v-if="manualExpenses.length > 0" class="space-y-2">
          <div
            v-for="(exp, idx) in manualExpenses"
            :key="idx"
            :class="[
              'sim-list-item flex items-center justify-between px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/40 rounded-xl group',
              exp._sim ? 'sim-entry' : '',
            ]"
          >
            <div class="flex items-center gap-3 min-w-0">
              <div
                class="w-8 h-8 rounded-full bg-red-100 dark:bg-red-800 flex items-center justify-center shrink-0 text-red-500 dark:text-red-300 text-sm font-bold"
              >
                {{ exp.description ? exp.description[0]!.toUpperCase() : "?" }}
              </div>
              <div class="min-w-0">
                <p
                  class="font-medium text-gray-800 dark:text-gray-100 truncate"
                >
                  {{ exp.description || "Uncategorized" }}
                </p>
                <p class="text-xs text-gray-400 dark:text-gray-500">
                  {{
                    new Date(exp.date + "T00:00:00").toLocaleDateString(
                      "en-US",
                      { weekday: "short", month: "short", day: "numeric" },
                    )
                  }}
                </p>
              </div>
            </div>
            <div class="flex items-center gap-3 shrink-0 ml-3">
              <span class="font-bold text-red-600 dark:text-red-400">{{
                fmt(parseFloat(exp.amount))
              }}</span>
              <button
                @click="removeExpense(exp)"
                class="opacity-0 group-hover:opacity-100 p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg transition-all"
                title="Remove"
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
        <p
          v-else
          class="text-center text-gray-400 dark:text-gray-500 py-10 text-sm"
        >
          No manual expenses in this range
        </p>
      </div>

      <!-- Income rows -->
      <div v-if="historyTab === 'incomes'">
        <div v-if="manualIncomes.length > 0" class="space-y-2">
          <div
            v-for="(inc, idx) in manualIncomes"
            :key="idx"
            :class="[
              'sim-list-item flex items-center justify-between px-4 py-3 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800/40 rounded-xl group',
              inc._sim ? 'sim-entry' : '',
            ]"
          >
            <div class="flex items-center gap-3 min-w-0">
              <div
                class="w-8 h-8 rounded-full bg-green-100 dark:bg-green-800 flex items-center justify-center shrink-0 text-green-500 dark:text-green-300 text-sm font-bold"
              >
                {{ inc.description ? inc.description[0]!.toUpperCase() : "?" }}
              </div>
              <div class="min-w-0">
                <p
                  class="font-medium text-gray-800 dark:text-gray-100 truncate"
                >
                  {{ inc.description || "Uncategorized" }}
                </p>
                <p class="text-xs text-gray-400 dark:text-gray-500">
                  {{
                    new Date(inc.date + "T00:00:00").toLocaleDateString(
                      "en-US",
                      { weekday: "short", month: "short", day: "numeric" },
                    )
                  }}
                </p>
              </div>
            </div>
            <div class="flex items-center gap-3 shrink-0 ml-3">
              <span class="font-bold text-green-600 dark:text-green-400">{{
                fmt(parseFloat(inc.amount))
              }}</span>
              <button
                @click="removeIncome(inc)"
                class="opacity-0 group-hover:opacity-100 p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg transition-all"
                title="Remove"
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
        <p
          v-else
          class="text-center text-gray-400 dark:text-gray-500 py-10 text-sm"
        >
          No manual income in this range
        </p>
      </div>
    </div>
  </div>

  <!-- Initial Balance Modal -->
  <div
    v-if="showInitialBalanceModal"
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
    @click.self="closeInitialBalanceModal"
  >
    <div class="bg-white rounded-lg shadow-2xl max-w-md w-full">
      <!-- Modal Header -->
      <div
        class="bg-gradient-to-r from-blue-500 to-indigo-500 px-6 py-4 flex justify-between items-center"
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
              d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          Set Initial Balance
        </h2>
        <button
          @click="closeInitialBalanceModal"
          class="text-white hover:text-blue-100 transition-colors"
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
      <div class="px-6 py-6">
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Initial Balance Amount
          </label>
          <div class="relative">
            <span
              class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-lg"
              >$</span
            >
            <input
              v-model="initialBalanceInput"
              type="number"
              step="0.01"
              placeholder="0.00"
              class="w-full pl-8 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-lg"
              @keyup.enter="saveInitialBalance"
            />
          </div>
        </div>

        <div
          v-if="storageService.hasData()"
          class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4"
        >
          <div class="flex gap-2">
            <svg
              class="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div>
              <p class="text-sm font-semibold text-yellow-800">Warning!</p>
              <p class="text-sm text-yellow-700">
                Setting an initial balance will reset all your existing expenses
                and incomes.
              </p>
            </div>
          </div>
        </div>

        <p class="text-sm text-gray-600">
          This is your starting balance before tracking expenses and income. It
          helps you see your overall financial position.
        </p>
      </div>

      <!-- Modal Footer -->
      <div
        class="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3"
      >
        <button
          @click="closeInitialBalanceModal"
          class="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors font-medium"
        >
          Cancel
        </button>
        <button
          @click="saveInitialBalance"
          :disabled="!initialBalanceInput"
          class="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Save Balance
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Custom styles if needed */
</style>
