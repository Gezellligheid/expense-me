import {
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebaseService";

// All localStorage keys that get synced to Firestore
const SYNC_KEYS = [
  "expenses",
  "incomes",
  "recurringExpenses",
  "recurringIncomes",
  "recurringIncomeOverrides",
  "initialBalance",
  "appSettings",
] as const;

type SyncKey = (typeof SYNC_KEYS)[number];

let currentUid: string | null = null;
const unsubscribes: Unsubscribe[] = [];

function notify() {
  window.dispatchEvent(new Event("storage-updated"));
}

function userDoc(uid: string, key: SyncKey) {
  return doc(db, "users", uid, "data", key);
}

/**
 * Called once when the user signs in.
 *
 * Strategy:
 *  - For each key, if Firestore already has data → write it to localStorage (cloud wins).
 *  - If Firestore is empty but localStorage has data → upload localStorage (migration).
 *  - If both are empty → do nothing.
 *
 * After this runs, initCloudSync() keeps both sides in sync in real time.
 */
export async function migrateLocalStorage(uid: string): Promise<void> {
  for (const key of SYNC_KEYS) {
    const ref = userDoc(uid, key);
    const snap = await getDoc(ref);

    if (snap.exists()) {
      // Cloud has data → restore it locally
      const value = snap.data()["value"];
      if (value !== undefined && value !== null) {
        const serialized =
          typeof value === "string" ? value : JSON.stringify(value);
        localStorage.setItem(key, serialized);
      }
    } else {
      // Cloud is empty → migrate local data up
      const local = localStorage.getItem(key);
      if (local !== null) {
        let value: unknown;
        try {
          value = JSON.parse(local);
        } catch {
          value = local;
        }
        await setDoc(ref, { value });
      }
    }
  }
  notify();
}

/**
 * Start real-time Firestore → localStorage listeners.
 * Any write from another device will land here, update localStorage, and
 * fire `storage-updated` so all Vue components refresh automatically.
 */
export function initCloudSync(uid: string): void {
  stopCloudSync();
  currentUid = uid;

  for (const key of SYNC_KEYS) {
    const ref = userDoc(uid, key);
    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) return;
      const value = snap.data()["value"];
      if (value === undefined || value === null) return;

      const serialized =
        typeof value === "string" ? value : JSON.stringify(value);
      const current = localStorage.getItem(key);

      // Only update (and notify) when the value actually changed
      if (current !== serialized) {
        localStorage.setItem(key, serialized);
        notify();
      }
    });
    unsubscribes.push(unsub);
  }
}

/**
 * Mirror a localStorage write to Firestore.
 * Call this after every localStorage.setItem().
 */
export async function pushToCloud(
  key: string,
  rawValue: string | null,
): Promise<void> {
  if (!currentUid || rawValue === null) return;
  let value: unknown;
  try {
    value = JSON.parse(rawValue);
  } catch {
    value = rawValue;
  }
  await setDoc(userDoc(currentUid, key as SyncKey), { value });
}

/**
 * Push an explicit value (used for delete / clear operations where we
 * want to store an empty array rather than the old localStorage value).
 */
export async function pushValueToCloud(
  key: string,
  value: unknown,
): Promise<void> {
  if (!currentUid) return;
  await setDoc(userDoc(currentUid, key as SyncKey), { value });
}

/** Tear down all listeners and forget the current user. */
export function stopCloudSync(): void {
  unsubscribes.forEach((u) => u());
  unsubscribes.length = 0;
  currentUid = null;
}

export function isCloudSyncActive(): boolean {
  return currentUid !== null;
}
