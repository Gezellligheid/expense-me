<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import {
  useSettings,
  CURRENCIES,
  type Theme,
} from "../composables/useSettings";
import { storageService } from "../services/storageService";
import {
  loadUserDataForViewing,
  restoreMyData,
  isViewingOtherUser,
  initCloudSync,
  migrateLocalStorage,
} from "../services/cloudSyncService";
import { useAuth } from "../composables/useAuth";

const {
  currencyCode,
  theme,
  currencyInfo,
  setCurrency,
  setTheme,
  formatCurrency,
  isTestMode,
  setTestMode,
} = useSettings();

const isDev = import.meta.env.DEV;
const { user } = useAuth();

// ── Dev: View other user ──────────────────────────────────────────────────────
const myUidCopied = ref(false);
const copyMyUid = async () => {
  if (!user.value?.uid) return;
  await navigator.clipboard.writeText(user.value.uid);
  myUidCopied.value = true;
  setTimeout(() => (myUidCopied.value = false), 2000);
};
const viewUserId = ref("");
const viewUserStatus = ref<
  "idle" | "loading" | "loaded" | "restoring" | "error"
>("idle");
const viewUserError = ref("");
const viewUserLoaded = ref(0);
const viewUserMissing = ref<string[]>([]);
const isViewing = ref(isViewingOtherUser());

const loadOtherUser = async () => {
  const uid = viewUserId.value.trim();
  if (!uid) return;
  viewUserStatus.value = "loading";
  viewUserError.value = "";
  try {
    const result = await loadUserDataForViewing(uid);
    viewUserLoaded.value = result.loaded;
    viewUserMissing.value = result.missing;
    viewUserStatus.value = "loaded";
    isViewing.value = true;
    refreshStats();
  } catch (err: unknown) {
    viewUserStatus.value = "error";
    viewUserError.value = err instanceof Error ? err.message : String(err);
  }
};

const restoreOwnData = async () => {
  viewUserStatus.value = "restoring";
  await restoreMyData(async (uid) => {
    await migrateLocalStorage(uid);
    initCloudSync(uid);
  });
  viewUserStatus.value = "idle";
  viewUserId.value = "";
  viewUserLoaded.value = 0;
  viewUserMissing.value = [];
  isViewing.value = false;
  refreshStats();
};

// ── Currency ─────────────────────────────────────────────────────────────────
const currencySearch = ref("");
const filteredCurrencies = computed(() => {
  const q = currencySearch.value.toLowerCase().trim();
  if (!q) return CURRENCIES;
  return CURRENCIES.filter(
    (c) => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q),
  );
});
const currencyPreview = computed(() => formatCurrency(1234.56));

// ── Theme ─────────────────────────────────────────────────────────────────────
const themes: { value: Theme; label: string; icon: string; desc: string }[] = [
  { value: "light", label: "Light", icon: "☀️", desc: "Clean & bright" },
  { value: "dark", label: "Dark", icon: "🌙", desc: "Easy on the eyes" },
  { value: "system", label: "System", icon: "💻", desc: "Follows OS setting" },
];

// ── Data stats ────────────────────────────────────────────────────────────────
const stats = ref({
  expenses: 0,
  incomes: 0,
  recurringExpenses: 0,
  recurringIncomes: 0,
  overrides: 0,
  initialBalance: null as number | null,
});

const refreshStats = () => {
  stats.value = {
    expenses: storageService.loadExpenses().length,
    incomes: storageService.loadIncomes().length,
    recurringExpenses: storageService.loadRecurringExpenses().length,
    recurringIncomes: storageService.loadRecurringIncomes().length,
    overrides: storageService.loadRecurringIncomeOverrides().length,
    initialBalance: storageService.getInitialBalance(),
  };
};

onMounted(() => {
  refreshStats();
  window.addEventListener("storage-updated", refreshStats);
});

onUnmounted(() => {
  window.removeEventListener("storage-updated", refreshStats);
});

// ── Data Management ───────────────────────────────────────────────────────────
type ResetType = "transactions" | "recurring" | "all";

const showResetModal = ref(false);
const resetType = ref<ResetType | null>(null);

const resetConfigs: Record<
  ResetType,
  { label: string; desc: string; accent: string }
> = {
  transactions: {
    label: "Reset Transactions",
    desc: "Deletes all expenses and incomes. Recurring rules, overrides, and initial balance are kept.",
    accent: "orange",
  },
  recurring: {
    label: "Reset Recurring",
    desc: "Deletes all recurring expenses, incomes, and their overrides. One-off transactions are kept.",
    accent: "orange",
  },
  all: {
    label: "Reset All Data",
    desc: "Completely wipes everything — transactions, recurring, overrides, and initial balance. Cannot be undone.",
    accent: "red",
  },
};

const openReset = (type: ResetType) => {
  resetType.value = type;
  showResetModal.value = true;
};

const confirmReset = () => {
  if (!resetType.value) return;
  if (resetType.value === "transactions") storageService.resetTransactions();
  else if (resetType.value === "recurring") storageService.resetRecurring();
  else storageService.resetAllData();
  showResetModal.value = false;
  resetType.value = null;
  refreshStats();
};

// ── Export ────────────────────────────────────────────────────────────────────
const exportAll = () => {
  const data = {
    exportedAt: new Date().toISOString(),
    settings: { currency: currencyCode.value, theme: theme.value },
    expenses: storageService.loadExpenses(),
    incomes: storageService.loadIncomes(),
    recurringExpenses: storageService.loadRecurringExpenses(),
    recurringIncomes: storageService.loadRecurringIncomes(),
    recurringIncomeOverrides: storageService.loadRecurringIncomeOverrides(),
    initialBalance: storageService.getInitialBalance(),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `expense-me-backup-${new Date().toISOString().split("T")[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
};
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="bg-white rounded-lg shadow-md p-6">
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
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
        Settings
      </h2>
      <p class="text-sm text-gray-500 mt-1">
        Manage your preferences and application data
      </p>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- ── Currency ─────────────────────────────────────────────────── -->
      <div class="bg-white rounded-lg shadow-md p-6">
        <h3
          class="text-lg font-bold text-gray-800 mb-1 flex items-center gap-2"
        >
          <span class="text-xl">💱</span>
          Currency
        </h3>
        <p class="text-sm text-gray-500 mb-4">
          Selected:
          <span class="font-semibold text-indigo-600">
            {{ currencyInfo.flag }} {{ currencyInfo.code }} —
            {{ currencyInfo.name }}
          </span>
          <span class="ml-2 text-gray-400 text-xs"
            >e.g. {{ currencyPreview }}</span
          >
        </p>

        <!-- Search -->
        <div class="relative mb-3">
          <svg
            class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            v-model="currencySearch"
            type="text"
            placeholder="Search currency…"
            class="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm"
          />
        </div>

        <!-- Currency list -->
        <div class="max-h-72 overflow-y-auto space-y-0.5 pr-1">
          <button
            v-for="c in filteredCurrencies"
            :key="c.code"
            @click="setCurrency(c.code)"
            class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors text-sm"
            :class="
              currencyCode === c.code
                ? 'bg-indigo-100 text-indigo-800 font-semibold ring-1 ring-indigo-300'
                : 'hover:bg-gray-50 text-gray-700'
            "
          >
            <span class="text-lg leading-none">{{ c.flag }}</span>
            <span class="font-mono text-xs w-8 shrink-0 text-gray-400">{{
              c.code
            }}</span>
            <span class="flex-1">{{ c.name }}</span>
            <span class="text-gray-400 text-xs shrink-0">{{ c.symbol }}</span>
            <svg
              v-if="currencyCode === c.code"
              class="w-4 h-4 text-indigo-600 shrink-0"
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
          </button>
          <p
            v-if="filteredCurrencies.length === 0"
            class="text-center text-gray-400 py-6 text-sm"
          >
            No currencies match "{{ currencySearch }}"
          </p>
        </div>
      </div>

      <!-- Right column -->
      <div class="space-y-6">
        <!-- ── Appearance ───────────────────────────────────────────── -->
        <div class="bg-white rounded-lg shadow-md p-6">
          <h3
            class="text-lg font-bold text-gray-800 mb-1 flex items-center gap-2"
          >
            <span class="text-xl">🎨</span>
            Appearance
          </h3>
          <p class="text-sm text-gray-500 mb-4">Choose how the app looks</p>
          <div class="grid grid-cols-3 gap-3">
            <button
              v-for="t in themes"
              :key="t.value"
              @click="setTheme(t.value)"
              class="flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all"
              :class="
                theme === t.value
                  ? 'border-indigo-500 bg-indigo-50 shadow-sm'
                  : 'border-gray-200 hover:border-indigo-200 hover:bg-gray-50'
              "
            >
              <span class="text-3xl">{{ t.icon }}</span>
              <span class="text-sm font-semibold text-gray-800">{{
                t.label
              }}</span>
              <span class="text-xs text-gray-500 text-center">{{
                t.desc
              }}</span>
              <div
                v-if="theme === t.value"
                class="w-2 h-2 rounded-full bg-indigo-500 mt-0.5"
              ></div>
            </button>
          </div>
        </div>

        <!-- ── Data Overview ────────────────────────────────────────── -->
        <div class="bg-white rounded-lg shadow-md p-6">
          <h3
            class="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"
          >
            <span class="text-xl">📊</span>
            Data Overview
          </h3>
          <div class="grid grid-cols-2 gap-2 text-sm">
            <div class="flex justify-between bg-gray-50 px-3 py-2 rounded-lg">
              <span class="text-gray-600">Expenses</span>
              <span class="font-semibold text-gray-800">{{
                stats.expenses
              }}</span>
            </div>
            <div class="flex justify-between bg-gray-50 px-3 py-2 rounded-lg">
              <span class="text-gray-600">Incomes</span>
              <span class="font-semibold text-gray-800">{{
                stats.incomes
              }}</span>
            </div>
            <div class="flex justify-between bg-gray-50 px-3 py-2 rounded-lg">
              <span class="text-gray-600">Recurring exp.</span>
              <span class="font-semibold text-gray-800">{{
                stats.recurringExpenses
              }}</span>
            </div>
            <div class="flex justify-between bg-gray-50 px-3 py-2 rounded-lg">
              <span class="text-gray-600">Recurring inc.</span>
              <span class="font-semibold text-gray-800">{{
                stats.recurringIncomes
              }}</span>
            </div>
            <div
              class="flex justify-between bg-gray-50 px-3 py-2 rounded-lg col-span-2"
            >
              <span class="text-gray-600">Income overrides</span>
              <span class="font-semibold text-gray-800">{{
                stats.overrides
              }}</span>
            </div>
          </div>
          <div
            v-if="stats.initialBalance !== null"
            class="mt-3 flex justify-between items-center text-sm bg-blue-50 border border-blue-100 px-3 py-2 rounded-lg"
          >
            <span class="text-blue-700">Initial balance</span>
            <span class="font-bold text-blue-800">{{
              formatCurrency(stats.initialBalance)
            }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Developer: View Another User ─────────────────────────────────── -->
    <div
      v-if="isDev"
      class="bg-purple-50 border-2 rounded-lg shadow-md p-6"
      :class="isViewing ? 'border-purple-500' : 'border-purple-300'"
    >
      <h3
        class="text-lg font-bold text-purple-800 mb-1 flex items-center gap-2"
      >
        <span class="text-xl">🕵️</span>
        Developer — View Another User
        <span
          class="ml-2 text-xs font-normal bg-purple-200 text-purple-700 px-2 py-0.5 rounded-full"
          >DEV ONLY</span
        >
        <span
          v-if="isViewing"
          class="ml-1 text-xs font-semibold bg-purple-600 text-white px-2 py-0.5 rounded-full animate-pulse"
          >VIEWING OTHER USER</span
        >
      </h3>
      <p class="text-sm text-purple-700 mb-4">
        Load any user's Firestore data into the app for inspection.
        <strong
          >Your own data is backed up and fully restored when you exit.</strong
        >
        Cloud sync is paused while viewing.
      </p>

      <!-- Your UID + rules hint -->
      <div
        class="mb-4 bg-white border border-purple-200 rounded-xl px-4 py-3 text-sm"
      >
        <p class="text-purple-800 font-semibold mb-1">Your Firebase UID</p>
        <div class="flex items-center gap-2">
          <code
            class="flex-1 bg-purple-50 text-purple-900 px-2 py-1 rounded text-xs font-mono break-all select-all"
            >{{ user?.uid ?? "not signed in" }}</code
          >
          <button
            @click="copyMyUid"
            :disabled="!user?.uid"
            class="shrink-0 px-3 py-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            {{ myUidCopied ? "Copied!" : "Copy" }}
          </button>
        </div>
        <p class="text-xs text-purple-600 mt-2">
          Add this UID to the
          <code class="bg-purple-100 px-1 rounded">firestore.rules</code>
          allowlist, then run
          <code class="bg-purple-100 px-1 rounded"
            >firebase deploy --only firestore:rules</code
          >
          to gain read access.
        </p>
      </div>

      <!-- Restore banner -->
      <div
        v-if="isViewing"
        class="mb-4 flex items-center justify-between bg-purple-100 border border-purple-400 rounded-xl px-4 py-3"
      >
        <div>
          <p class="font-semibold text-purple-900 text-sm">
            Viewing: <span class="font-mono">{{ viewUserId || "…" }}</span>
          </p>
          <p class="text-xs text-purple-700 mt-0.5">
            {{ viewUserLoaded }} keys loaded{{
              viewUserMissing.length
                ? `, ${viewUserMissing.length} missing (${viewUserMissing.join(", ")})`
                : ""
            }}
          </p>
        </div>
        <button
          @click="restoreOwnData"
          :disabled="viewUserStatus === 'restoring'"
          class="ml-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          {{
            viewUserStatus === "restoring" ? "Restoring…" : "⬅ Restore My Data"
          }}
        </button>
      </div>

      <!-- Input row -->
      <div class="flex gap-3" v-if="!isViewing">
        <input
          v-model="viewUserId"
          type="text"
          placeholder="Enter userId (Firebase UID)…"
          class="flex-1 px-3 py-2 border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-sm bg-white"
          @keydown.enter="loadOtherUser"
          :disabled="viewUserStatus === 'loading'"
        />
        <button
          @click="loadOtherUser"
          :disabled="!viewUserId.trim() || viewUserStatus === 'loading'"
          class="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap"
        >
          {{ viewUserStatus === "loading" ? "Loading…" : "Load User" }}
        </button>
      </div>

      <!-- Error -->
      <p
        v-if="viewUserStatus === 'error'"
        class="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2"
      >
        ⚠️ {{ viewUserError }}
      </p>
    </div>

    <!-- ── Developer: Test Mode ──────────────────────────────────────────── -->
    <div
      v-if="isDev"
      class="bg-amber-50 border-2 border-amber-300 rounded-lg shadow-md p-6"
    >
      <h3 class="text-lg font-bold text-amber-800 mb-1 flex items-center gap-2">
        <span class="text-xl">🧪</span>
        Developer — Test Mode
        <span
          class="ml-2 text-xs font-normal bg-amber-200 text-amber-700 px-2 py-0.5 rounded-full"
          >DEV ONLY</span
        >
      </h3>
      <p class="text-sm text-amber-700 mb-4">
        When enabled, the app displays synthetic test data (1&nbsp;year history
        + 3&nbsp;months future).
        <strong>No real data is read, nothing is saved to the cloud.</strong>
      </p>

      <!-- Toggle -->
      <div
        class="flex items-center justify-between bg-white border border-amber-200 rounded-xl px-4 py-3"
      >
        <div>
          <p class="font-semibold text-gray-800 text-sm">Enable Test Mode</p>
          <p class="text-xs text-gray-500 mt-0.5">
            {{
              isTestMode
                ? "Active — showing synthetic data"
                : "Inactive — showing real data"
            }}
          </p>
        </div>
        <button
          @click="setTestMode(!isTestMode)"
          class="relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none"
          :class="isTestMode ? 'bg-amber-500' : 'bg-gray-300'"
          :aria-checked="isTestMode"
          role="switch"
        >
          <span
            class="inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform"
            :class="isTestMode ? 'translate-x-6' : 'translate-x-1'"
          />
        </button>
      </div>

      <!-- What's included -->
      <div
        v-if="isTestMode"
        class="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs"
      >
        <div class="bg-white border border-amber-200 rounded-lg px-3 py-2">
          <p class="text-amber-700 font-semibold">Recurring Expenses</p>
          <p class="text-gray-600 mt-0.5">
            Rent, Netflix, Phone, Gym, Internet, Spotify, Cloud
          </p>
        </div>
        <div class="bg-white border border-amber-200 rounded-lg px-3 py-2">
          <p class="text-amber-700 font-semibold">Recurring Income</p>
          <p class="text-gray-600 mt-0.5">Monthly Salary, Freelance Work</p>
        </div>
        <div class="bg-white border border-amber-200 rounded-lg px-3 py-2">
          <p class="text-amber-700 font-semibold">Transactions</p>
          <p class="text-gray-600 mt-0.5">
            13 months history + 3 months future
          </p>
        </div>
        <div class="bg-white border border-amber-200 rounded-lg px-3 py-2">
          <p class="text-amber-700 font-semibold">Initial Balance</p>
          <p class="text-gray-600 mt-0.5">€5,000.00</p>
        </div>
        <div
          class="bg-white border border-amber-200 rounded-lg px-3 py-2 col-span-2"
        >
          <p class="text-amber-700 font-semibold">Cloud Sync</p>
          <p class="text-gray-600 mt-0.5">
            Disabled — test data is never stored or uploaded
          </p>
        </div>
      </div>
    </div>

    <!-- ── Data Management ───────────────────────────────────────────────── -->
    <div class="bg-white rounded-lg shadow-md p-6">
      <h3 class="text-lg font-bold text-gray-800 mb-1 flex items-center gap-2">
        <span class="text-xl">🗄️</span>
        Data Management
      </h3>
      <p class="text-sm text-gray-500 mb-5">
        Export a backup or selectively clear stored data. Resets cannot be
        undone.
      </p>

      <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <!-- Export -->
        <button
          @click="exportAll"
          class="flex items-center gap-3 p-4 bg-indigo-50 border-2 border-indigo-200 rounded-xl hover:bg-indigo-100 transition-colors text-left group"
        >
          <div
            class="w-10 h-10 rounded-lg bg-indigo-100 group-hover:bg-indigo-200 flex items-center justify-center text-xl shrink-0"
          >
            📥
          </div>
          <div>
            <p class="font-semibold text-indigo-800 text-sm">Export Backup</p>
            <p class="text-xs text-indigo-600 mt-0.5">
              Download all data as JSON
            </p>
          </div>
        </button>

        <!-- Reset Transactions -->
        <button
          @click="openReset('transactions')"
          class="flex items-center gap-3 p-4 bg-orange-50 border-2 border-orange-200 rounded-xl hover:bg-orange-100 transition-colors text-left group"
        >
          <div
            class="w-10 h-10 rounded-lg bg-orange-100 group-hover:bg-orange-200 flex items-center justify-center text-xl shrink-0"
          >
            🧹
          </div>
          <div>
            <p class="font-semibold text-orange-800 text-sm">
              Reset Transactions
            </p>
            <p class="text-xs text-orange-600 mt-0.5">
              Wipe all expenses &amp; incomes
            </p>
          </div>
        </button>

        <!-- Reset Recurring -->
        <button
          @click="openReset('recurring')"
          class="flex items-center gap-3 p-4 bg-orange-50 border-2 border-orange-200 rounded-xl hover:bg-orange-100 transition-colors text-left group"
        >
          <div
            class="w-10 h-10 rounded-lg bg-orange-100 group-hover:bg-orange-200 flex items-center justify-center text-xl shrink-0"
          >
            🔄
          </div>
          <div>
            <p class="font-semibold text-orange-800 text-sm">Reset Recurring</p>
            <p class="text-xs text-orange-600 mt-0.5">
              Wipe recurring rules &amp; overrides
            </p>
          </div>
        </button>

        <!-- Reset All -->
        <button
          @click="openReset('all')"
          class="flex items-center gap-3 p-4 bg-red-50 border-2 border-red-200 rounded-xl hover:bg-red-100 transition-colors text-left group"
        >
          <div
            class="w-10 h-10 rounded-lg bg-red-100 group-hover:bg-red-200 flex items-center justify-center text-xl shrink-0"
          >
            💣
          </div>
          <div>
            <p class="font-semibold text-red-800 text-sm">Reset All Data</p>
            <p class="text-xs text-red-600 mt-0.5">Complete wipe, no undo</p>
          </div>
        </button>
      </div>
    </div>
  </div>

  <!-- ── Reset Confirmation Modal ─────────────────────────────────────────── -->
  <div
    v-if="showResetModal && resetType"
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
    @click.self="showResetModal = false"
  >
    <div class="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
      <div class="text-center mb-5">
        <div class="text-5xl mb-3">
          {{ resetType === "all" ? "💣" : "⚠️" }}
        </div>
        <h3 class="text-xl font-bold text-gray-800">
          {{ resetConfigs[resetType].label }}
        </h3>
        <p class="text-sm text-gray-600 mt-2 leading-relaxed">
          {{ resetConfigs[resetType].desc }}
        </p>
      </div>
      <div class="flex gap-3 mt-6">
        <button
          @click="showResetModal = false"
          class="flex-1 py-2.5 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors font-medium"
        >
          Cancel
        </button>
        <button
          @click="confirmReset"
          class="flex-1 py-2.5 text-white rounded-lg transition-colors font-medium"
          :class="
            resetType === 'all'
              ? 'bg-red-500 hover:bg-red-600'
              : 'bg-orange-500 hover:bg-orange-600'
          "
        >
          Yes, Reset
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped></style>
