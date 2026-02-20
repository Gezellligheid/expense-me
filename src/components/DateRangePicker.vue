<script setup lang="ts">
import { ref, computed, watch } from "vue";

const props = defineProps<{
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
  expenseDates?: string[];
  incomeDates?: string[];
}>();

const emit = defineEmits<{
  "update:start": [v: string];
  "update:end": [v: string];
}>();

// ── Picker open/close ───────────────────────────────────────────────
const open = ref(false);
const pickerRef = ref<HTMLElement | null>(null);

const closePicker = (e: MouseEvent) => {
  if (pickerRef.value && !pickerRef.value.contains(e.target as Node)) {
    open.value = false;
    pendingStart.value = null;
  }
};

watch(open, (val) => {
  if (val) document.addEventListener("mousedown", closePicker);
  else document.removeEventListener("mousedown", closePicker);
});

// ── Calendar navigation ─────────────────────────────────────────────
const today = new Date();
// left calendar starts on the month of rangeStart, or current month
const leftYear = ref(today.getFullYear());
const leftMonth = ref(today.getMonth()); // 0-indexed

watch(
  () => props.start,
  (v) => {
    if (v) {
      leftYear.value = parseInt(v.slice(0, 4));
      leftMonth.value = parseInt(v.slice(5, 7)) - 1;
    }
  },
  { immediate: true },
);

const rightYear = computed(() => {
  if (leftMonth.value === 11) return leftYear.value + 1;
  return leftYear.value;
});
const rightMonth = computed(() => (leftMonth.value + 1) % 12);

const prevMonth = () => {
  if (leftMonth.value === 0) {
    leftMonth.value = 11;
    leftYear.value--;
  } else {
    leftMonth.value--;
  }
};
const nextMonth = () => {
  if (leftMonth.value === 11) {
    leftMonth.value = 0;
    leftYear.value++;
  } else {
    leftMonth.value++;
  }
};

// ── Selection state ─────────────────────────────────────────────────
// pendingStart = first click made, waiting for second (end) click
const pendingStart = ref<string | null>(null);
const hoverDate = ref<string | null>(null);

const isoDate = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

const onDayClick = (date: string) => {
  if (!pendingStart.value) {
    // First click → start selecting
    pendingStart.value = date;
    emit("update:start", date);
    emit("update:end", "");
  } else {
    // Second click → finalise range
    const [a, b] = [pendingStart.value, date].sort();
    emit("update:start", a!);
    emit("update:end", b!);
    pendingStart.value = null;
    open.value = false;
    hoverDate.value = null;
  }
};

// Effective range for highlighting (preview during hover)
const effectiveStart = computed(() =>
  pendingStart.value
    ? [pendingStart.value, hoverDate.value ?? pendingStart.value].sort()[0]!
    : props.start,
);
const effectiveEnd = computed(() =>
  pendingStart.value
    ? [pendingStart.value, hoverDate.value ?? pendingStart.value].sort()[1]!
    : props.end,
);

// ── Day cell state helpers ──────────────────────────────────────────
const isStart = (d: string) => d === effectiveStart.value;
const isEnd = (d: string) => d === effectiveEnd.value;
const isInRange = (d: string) =>
  effectiveStart.value &&
  effectiveEnd.value &&
  d > effectiveStart.value &&
  d < effectiveEnd.value;
const isToday = (d: string) =>
  d === isoDate(today.getFullYear(), today.getMonth(), today.getDate());
const isPreviewing = computed(() => pendingStart.value !== null);

// ── Build grid for a given month ────────────────────────────────────
const buildGrid = (year: number, month: number) => {
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  // Shift so week starts Monday (0=Mon…6=Sun)
  const offset = (firstDay + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<{ date: string; day: number } | null> = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++)
    cells.push({ date: isoDate(year, month, d), day: d });
  return cells;
};

const leftGrid = computed(() => buildGrid(leftYear.value, leftMonth.value));
const rightGrid = computed(() => buildGrid(rightYear.value, rightMonth.value));

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
const DAY_HEADERS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

// ── Dot indicators ───────────────────────────────────────────────────
const expenseDateSet = computed(() => new Set(props.expenseDates ?? []));
const incomeDateSet = computed(() => new Set(props.incomeDates ?? []));
const hasExpense = (d: string) => expenseDateSet.value.has(d);
const hasIncome = (d: string) => incomeDateSet.value.has(d);

// ── Quick-select helpers ───────────────────────────────────────────
const selectMonth = (year: number, month: number) => {
  const lastDay = new Date(year, month + 1, 0).getDate();
  const start = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const end = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  emit("update:start", start);
  emit("update:end", end);
  pendingStart.value = null;
  open.value = false;
};

const quickPrevMonth = () => {
  const d = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  selectMonth(d.getFullYear(), d.getMonth());
};
const quickThisMonth = () => selectMonth(today.getFullYear(), today.getMonth());
const quickNextMonth = () => {
  const d = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  selectMonth(d.getFullYear(), d.getMonth());
};
const quickThisYear = () => {
  emit("update:start", `${today.getFullYear()}-01-01`);
  emit("update:end", `${today.getFullYear()}-12-31`);
  pendingStart.value = null;
  open.value = false;
};

// ── Trigger label ───────────────────────────────────────────────────
const triggerLabel = computed(() => {
  if (!props.start && !props.end) return "Select date range";
  const fmt = (d: string) => {
    const dt = new Date(d + "T00:00:00");
    return dt.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };
  if (props.start && props.end && props.start !== props.end)
    return `${fmt(props.start)} – ${fmt(props.end)}`;
  if (props.start) return fmt(props.start);
  return "Select date range";
});
</script>

<template>
  <div class="relative" ref="pickerRef">
    <!-- Trigger button -->
    <button
      type="button"
      @click="open = !open"
      class="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl shadow-sm hover:border-blue-400 hover:shadow-md transition-all text-sm font-medium text-gray-700 dark:text-gray-200 w-[260px] justify-between"
      :class="
        open ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800' : ''
      "
    >
      <span class="flex items-center gap-2">
        <svg
          class="w-4 h-4 text-blue-500 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        {{ triggerLabel }}
      </span>
      <svg
        class="w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200"
        :class="open ? 'rotate-180' : ''"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M19 9l-7 7-7-7"
        />
      </svg>
    </button>

    <!-- Dropdown panel -->
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 scale-95 -translate-y-1"
      enter-to-class="opacity-100 scale-100 translate-y-0"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100 scale-100 translate-y-0"
      leave-to-class="opacity-0 scale-95 -translate-y-1"
    >
      <div
        v-if="open"
        class="absolute right-0 top-full mt-2 z-50 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 p-5 select-none"
        style="min-width: 620px"
      >
        <!-- Hint -->
        <p
          class="text-xs text-center text-gray-400 dark:text-gray-500 mb-4 font-medium"
        >
          {{
            isPreviewing
              ? "Click an end date to complete the range"
              : "Click a start date"
          }}
        </p>

        <!-- Two calendars -->
        <div class="flex gap-6">
          <div
            v-for="(cal, ci) in [
              { year: leftYear, month: leftMonth, grid: leftGrid },
              { year: rightYear, month: rightMonth, grid: rightGrid },
            ]"
            :key="ci"
            class="flex-1"
          >
            <!-- Month header -->
            <div class="flex items-center justify-between mb-3">
              <button
                v-if="ci === 0"
                @click="prevMonth"
                class="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-100"
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
              <span v-else class="w-7" />
              <span
                class="text-sm font-semibold text-gray-800 dark:text-gray-100"
              >
                {{ MONTH_NAMES[cal.month] }} {{ cal.year }}
              </span>
              <button
                v-if="ci === 1"
                @click="nextMonth"
                class="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-100"
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
              <span v-else class="w-7" />
            </div>

            <!-- Day headers -->
            <div class="grid grid-cols-7 mb-1">
              <div
                v-for="h in DAY_HEADERS"
                :key="h"
                class="text-center text-xs font-semibold text-gray-400 dark:text-gray-500 py-1"
              >
                {{ h }}
              </div>
            </div>

            <!-- Day grid -->
            <div class="grid grid-cols-7">
              <div
                v-for="(cell, idx) in cal.grid"
                :key="idx"
                class="relative h-9 flex items-center justify-center"
                :class="{
                  // Range fill (strip between start and end)
                  'bg-blue-100 dark:bg-blue-900/40':
                    cell && isInRange(cell.date),
                  // Start: round left side of strip
                  'rounded-l-full bg-blue-100 dark:bg-blue-900/40':
                    cell && isStart(cell.date) && isEnd(cell.date),
                  'rounded-l-full':
                    cell && isStart(cell.date) && !isEnd(cell.date),
                  // End: round right side of strip
                  'rounded-r-full':
                    cell && isEnd(cell.date) && !isStart(cell.date),
                }"
                @mouseenter="cell && isPreviewing && (hoverDate = cell.date)"
                @mouseleave="cell && isPreviewing && (hoverDate = null)"
              >
                <!-- invisible left half bg for range strip on start day -->
                <div
                  v-if="cell && isStart(cell.date) && !isEnd(cell.date)"
                  class="absolute right-0 w-1/2 h-full bg-blue-100 dark:bg-blue-900/40"
                />
                <!-- invisible right half bg for range strip on end day -->
                <div
                  v-if="cell && isEnd(cell.date) && !isStart(cell.date)"
                  class="absolute left-0 w-1/2 h-full bg-blue-100 dark:bg-blue-900/40"
                />

                <button
                  v-if="cell"
                  type="button"
                  @click="onDayClick(cell.date)"
                  class="relative z-10 w-8 h-8 rounded-full flex flex-col items-center justify-center text-sm transition-colors"
                  :class="{
                    'bg-blue-600 text-white font-bold shadow-md hover:bg-blue-700':
                      isStart(cell.date) || isEnd(cell.date),
                    'text-gray-700 dark:text-gray-200 hover:bg-blue-100 dark:hover:bg-blue-900/50':
                      !isStart(cell.date) && !isEnd(cell.date),
                    'font-semibold text-blue-600 dark:text-blue-400 ring-1 ring-blue-400 dark:ring-blue-500':
                      isToday(cell.date) &&
                      !isStart(cell.date) &&
                      !isEnd(cell.date),
                  }"
                >
                  <span
                    class="leading-none"
                    :class="
                      hasExpense(cell.date) || hasIncome(cell.date)
                        ? 'text-xs'
                        : 'text-sm'
                    "
                    >{{ cell.day }}</span
                  >
                  <span
                    v-if="hasExpense(cell.date) || hasIncome(cell.date)"
                    class="flex gap-0.5 mt-px"
                  >
                    <span
                      v-if="hasExpense(cell.date)"
                      class="w-1 h-1 rounded-full bg-red-400"
                      :class="
                        isStart(cell.date) || isEnd(cell.date)
                          ? 'bg-red-300'
                          : 'bg-red-500'
                      "
                    />
                    <span
                      v-if="hasIncome(cell.date)"
                      class="w-1 h-1 rounded-full"
                      :class="
                        isStart(cell.date) || isEnd(cell.date)
                          ? 'bg-green-300'
                          : 'bg-green-500'
                      "
                    />
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer: quick selects + clear -->
        <div
          class="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700 space-y-3"
        >
          <!-- Quick-select buttons -->
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="q in [
                { label: 'Prev Month', fn: quickPrevMonth },
                { label: 'This Month', fn: quickThisMonth },
                { label: 'Next Month', fn: quickNextMonth },
                { label: 'This Year', fn: quickThisYear },
              ]"
              :key="q.label"
              type="button"
              @click="q.fn()"
              class="px-2.5 py-1 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/40 hover:border-blue-300 dark:hover:border-blue-600 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              {{ q.label }}
            </button>
          </div>
          <!-- Clear / days selected -->
          <div class="flex justify-between items-center">
            <button
              type="button"
              @click="
                emit('update:start', '');
                emit('update:end', '');
                pendingStart = null;
              "
              class="text-xs text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
            >
              Clear
            </button>
            <span
              v-if="start && end"
              class="text-xs text-gray-500 dark:text-gray-400"
            >
              {{
                Math.round(
                  (new Date(end + "T00:00:00").getTime() -
                    new Date(start + "T00:00:00").getTime()) /
                    86400000,
                ) + 1
              }}
              days selected
            </span>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>
