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
  "balanceUpdates",
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
    try {
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
        // Cloud is empty → migrate local data up (new users with no local data skip this)
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
        // If both cloud and local are empty, nothing to do — this is a brand new user
      }
    } catch (err) {
      // A single key failing (e.g. permission denied) should not abort all others
      console.warn(
        `[cloudSync] migrateLocalStorage failed for key "${key}":`,
        err,
      );
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

// ── Dev-only: view another user's data ───────────────────────────────────────
const BACKUP_PREFIX = "__devbackup__";
let backupUid: string | null = null;

/**
 * DEV ONLY — Load a target user's Firestore data into localStorage so the
 * full app renders with their data.
 *
 * Your own data is first snapshotted to sessionStorage.
 * Cloud sync is paused so no live listener overwrites the viewed data.
 *
 * Returns an object describing how many keys were found.
 */
export async function loadUserDataForViewing(
  targetUid: string,
): Promise<{ loaded: number; missing: string[] }> {
  // 1. Snapshot current localStorage data to sessionStorage
  backupUid = currentUid;
  for (const key of SYNC_KEYS) {
    const val = localStorage.getItem(key);
    sessionStorage.setItem(
      BACKUP_PREFIX + key,
      val !== null ? val : "__undefined__",
    );
  }

  // 2. Stop live sync so nothing overwrites the viewed data
  stopCloudSync();

  // 3. Fetch and apply each key from Firestore
  let loaded = 0;
  const missing: string[] = [];

  for (const key of SYNC_KEYS) {
    try {
      const ref = doc(db, "users", targetUid, "data", key);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const value = snap.data()["value"];
        if (value !== undefined && value !== null) {
          const serialized =
            typeof value === "string" ? value : JSON.stringify(value);
          localStorage.setItem(key, serialized);
          loaded++;
        } else {
          localStorage.removeItem(key);
          missing.push(key);
        }
      } else {
        localStorage.removeItem(key);
        missing.push(key);
      }
    } catch (err) {
      console.warn(
        `[cloudSync] loadUserDataForViewing failed for "${key}":`,
        err,
      );
      missing.push(key);
    }
  }

  notify();
  return { loaded, missing };
}

/**
 * DEV ONLY — Restore the data that was backed up before loadUserDataForViewing.
 * Re-attaches cloud sync for the original user.
 */
export async function restoreMyData(
  reinitFn?: (uid: string) => Promise<void>,
): Promise<void> {
  for (const key of SYNC_KEYS) {
    const val = sessionStorage.getItem(BACKUP_PREFIX + key);
    if (val === null) continue;
    if (val === "__undefined__") {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, val);
    }
    sessionStorage.removeItem(BACKUP_PREFIX + key);
  }

  if (backupUid) {
    if (reinitFn) {
      await reinitFn(backupUid);
    } else {
      initCloudSync(backupUid);
    }
  }

  backupUid = null;
  notify();
}

/** Whether the app is currently showing another user's data. */
export function isViewingOtherUser(): boolean {
  return sessionStorage.getItem(BACKUP_PREFIX + "expenses") !== null;
}
