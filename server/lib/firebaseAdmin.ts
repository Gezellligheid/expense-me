import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function loadServiceAccount() {
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (!b64) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_BASE64 not configured");
  }
  return JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
}

function getAdminApp(): App {
  const existing = getApps();
  if (existing.length > 0) return existing[0]!;
  return initializeApp({ credential: cert(loadServiceAccount()) });
}

/** Verifies the `Authorization: Bearer <Firebase ID token>` header and returns the caller's uid. */
export async function verifyIdToken(
  authHeader: string | undefined,
): Promise<string> {
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Missing Authorization header");
  }
  const idToken = authHeader.slice("Bearer ".length);
  const decoded = await getAuth(getAdminApp()).verifyIdToken(idToken);
  return decoded.uid;
}

export interface StoredBankAccount {
  uid: string;
  name?: string;
  iban?: string;
  currency?: string;
}

export interface BankConnection {
  sessionId: string;
  aspspName: string;
  aspspCountry: string;
  accounts: StoredBankAccount[];
  connectedAt: string;
}

// Deliberately NOT under `users/{uid}/data/*` — that path is client-writable
// per firestore.rules. Bank session tokens are a live credential and must
// only ever be touched by the Admin SDK (server-side, trusted code).
function bankDoc(uid: string) {
  return getFirestore(getAdminApp()).collection("bankConnections").doc(uid);
}

export async function getBankConnection(
  uid: string,
): Promise<BankConnection | null> {
  const snap = await bankDoc(uid).get();
  return snap.exists ? (snap.data() as BankConnection) : null;
}

export async function setBankConnection(
  uid: string,
  data: BankConnection,
): Promise<void> {
  await bankDoc(uid).set(data);
}

export async function deleteBankConnection(uid: string): Promise<void> {
  await bankDoc(uid).delete();
}
