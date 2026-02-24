import { ref, readonly } from "vue";
import { simState } from "../services/simulationState";
import { pushToCloud } from "../services/cloudSyncService";

const SNAPSHOT_KEY = "_simSnapshot";

// Keys that hold list data (may contain _sim-flagged items)
const LIST_KEYS = [
  "expenses",
  "incomes",
  "recurringExpenses",
  "recurringIncomes",
  "recurringIncomeOverrides",
] as const;

// All keys persisted to Firestore
const ALL_KEYS = [
  "expenses",
  "incomes",
  "recurringExpenses",
  "recurringIncomes",
  "recurringIncomeOverrides",
  "initialBalance",
  "appSettings",
] as const;

// ── Singleton state ────────────────────────────────────────────────────────
const isSimulating = ref(false);

function saveSnapshot(): void {
  const snapshot: Record<string, string | null> = {};
  for (const key of ALL_KEYS) {
    snapshot[key] = localStorage.getItem(key);
  }
  localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
}

function restoreSnapshot(): void {
  const raw = localStorage.getItem(SNAPSHOT_KEY);
  if (!raw) return;
  const snapshot = JSON.parse(raw) as Record<string, string | null>;
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, value);
    }
  }
}

/**
 * Strip the `_sim` flag from every item in every list key and
 * push the cleaned data to Firestore.
 */
async function stripSimFlagsAndSync(): Promise<void> {
  for (const key of LIST_KEYS) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    let items: Array<Record<string, unknown>>;
    try {
      items = JSON.parse(raw) as Array<Record<string, unknown>>;
    } catch {
      continue;
    }
    const stripped = items.map(({ _sim: _removed, ...rest }) => rest);
    const serialized = JSON.stringify(stripped);
    localStorage.setItem(key, serialized);
    await pushToCloud(key, serialized);
  }
  // Push non-list keys too (initialBalance, appSettings) to make sure cloud is up to date
  for (const key of ["initialBalance", "appSettings"] as const) {
    const raw = localStorage.getItem(key);
    if (raw !== null) {
      await pushToCloud(key, raw);
    }
  }
}

// ── Public API ─────────────────────────────────────────────────────────────
export function useSimulation() {
  function startSimulation(): void {
    saveSnapshot();
    simState.active = true;
    isSimulating.value = true;
    document.body.classList.add("sim-mode");
  }

  async function acceptSimulation(): Promise<void> {
    simState.active = false;
    isSimulating.value = false;
    document.body.classList.remove("sim-mode");
    await stripSimFlagsAndSync();
    localStorage.removeItem(SNAPSHOT_KEY);
    window.dispatchEvent(new Event("storage-updated"));
  }

  function rejectSimulation(): void {
    simState.active = false;
    isSimulating.value = false;
    document.body.classList.remove("sim-mode");
    restoreSnapshot();
    localStorage.removeItem(SNAPSHOT_KEY);
    window.dispatchEvent(new Event("storage-updated"));
  }

  return {
    isSimulating: readonly(isSimulating),
    startSimulation,
    acceptSimulation,
    rejectSimulation,
  };
}
