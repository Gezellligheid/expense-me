import jwt from "jsonwebtoken";

const EB_BASE_URL = "https://api.enablebanking.com";

export interface Aspsp {
  name: string;
  country: string;
  bic?: string;
  logo?: string;
  psu_types?: string[];
  maximum_consent_validity?: number;
}

export interface EbAccount {
  uid: string;
  name?: string;
  currency?: string;
  account_id?: { iban?: string };
}

export interface EbSession {
  session_id: string;
  accounts: EbAccount[];
  aspsp: { name: string; country: string };
}

export interface EbAmount {
  currency: string;
  amount: string;
}

export interface EbTransaction {
  entry_reference?: string;
  transaction_id?: string;
  transaction_amount: EbAmount;
  credit_debit_indicator: "CRDT" | "DBIT";
  booking_date?: string;
  value_date?: string;
  transaction_date?: string;
  creditor?: { name?: string };
  debtor?: { name?: string };
  remittance_information?: string[];
}

/**
 * ENABLEBANKING_PEM is stored with no newlines at all (not even between the
 * header and the base64 body), which OpenSSL's PEM parser rejects. Rebuild a
 * structurally valid PEM from whatever whitespace/newline state it's in.
 */
export function normalizePem(raw: string): string {
  const match = raw
    .trim()
    .match(/-----BEGIN ([A-Z ]+)-----([\s\S]*?)-----END \1-----/);
  if (!match) {
    throw new Error("ENABLEBANKING_PEM is not a valid PEM-encoded key");
  }
  const [, label, rawBody] = match as [string, string, string];
  const body = rawBody.replace(/\s+/g, "");
  const lines = body.match(/.{1,64}/g) ?? [];
  return `-----BEGIN ${label}-----\n${lines.join("\n")}\n-----END ${label}-----\n`;
}

function signApplicationJwt(): string {
  const appId = process.env.ENABLEBANKING_ID;
  const pem = process.env.ENABLEBANKING_PEM;
  if (!appId || !pem) {
    throw new Error("ENABLEBANKING_ID / ENABLEBANKING_PEM not configured");
  }
  return jwt.sign({}, normalizePem(pem), {
    algorithm: "RS256",
    issuer: "enablebanking.com",
    audience: "api.enablebanking.com",
    expiresIn: 3600,
    keyid: appId,
  });
}

async function ebFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = signApplicationJwt();
  const res = await fetch(`${EB_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Enable Banking API ${res.status} on ${path}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function listAspsps(country?: string): Promise<Aspsp[]> {
  const qs = country ? `?country=${encodeURIComponent(country)}` : "";
  const data = await ebFetch<{ aspsps: Aspsp[] }>(`/aspsps${qs}`);
  return data.aspsps;
}

/** Signs a short-lived state token binding this OAuth attempt to a Firebase uid. */
export function signState(uid: string): string {
  const secret = process.env.BANK_STATE_SECRET;
  if (!secret) throw new Error("BANK_STATE_SECRET not configured");
  return jwt.sign({ uid }, secret, { expiresIn: "10m" });
}

/** Verifies a state token from the bank redirect and returns the bound uid. */
export function verifyState(state: string): string {
  const secret = process.env.BANK_STATE_SECRET;
  if (!secret) throw new Error("BANK_STATE_SECRET not configured");
  const decoded = jwt.verify(state, secret) as { uid?: string };
  if (!decoded.uid) throw new Error("Invalid state token");
  return decoded.uid;
}

export async function startAuth(
  uid: string,
  aspsp: { name: string; country: string },
): Promise<{ url: string; authorization_id: string }> {
  const redirectUrl = process.env.ENABLEBANKING_REDIRECT_URL;
  if (!redirectUrl) throw new Error("ENABLEBANKING_REDIRECT_URL not configured");

  const validUntil = new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString();
  return ebFetch<{ url: string; authorization_id: string }>("/auth", {
    method: "POST",
    body: JSON.stringify({
      access: { valid_until: validUntil },
      aspsp,
      state: signState(uid),
      redirect_url: redirectUrl,
      psu_type: "personal",
    }),
  });
}

export async function exchangeCode(code: string): Promise<EbSession> {
  return ebFetch<EbSession>("/sessions", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

export async function getBalances(
  accountUid: string,
): Promise<{ balance_amount: EbAmount; balance_type: string }[]> {
  const data = await ebFetch<{
    balances: { balance_amount: EbAmount; balance_type: string }[];
  }>(`/accounts/${accountUid}/balances`);
  return data.balances;
}

export async function getTransactions(
  accountUid: string,
  dateFrom?: string,
): Promise<EbTransaction[]> {
  const results: EbTransaction[] = [];
  let continuationKey: string | undefined;

  do {
    const params = new URLSearchParams();
    if (dateFrom) params.set("date_from", dateFrom);
    if (continuationKey) params.set("continuation_key", continuationKey);
    const qs = params.toString();

    const data: { transactions: EbTransaction[]; continuation_key?: string } =
      await ebFetch(`/accounts/${accountUid}/transactions${qs ? `?${qs}` : ""}`);

    results.push(...data.transactions);
    continuationKey = data.continuation_key;
  } while (continuationKey);

  return results;
}

export async function deleteSession(sessionId: string): Promise<void> {
  await ebFetch(`/sessions/${sessionId}`, { method: "DELETE" });
}
