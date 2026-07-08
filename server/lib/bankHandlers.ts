import {
  listAspsps,
  startAuth,
  exchangeCode,
  getTransactions,
  verifyState,
  deleteSession,
  type EbTransaction,
} from "./enableBanking";
import {
  verifyIdToken,
  getBankConnection,
  setBankConnection,
  deleteBankConnection,
  type BankConnection,
} from "./firebaseAdmin";

export interface HandlerResult {
  status: number;
  body: unknown;
}

function makeRateLimiter(max: number, windowMs: number) {
  const timestamps: number[] = [];
  return function checkRateLimit(): { allowed: boolean; retryAfter: number } {
    const now = Date.now();
    while (timestamps.length > 0 && timestamps[0]! < now - windowMs) {
      timestamps.shift();
    }
    if (timestamps.length >= max) {
      const retryAfter = Math.ceil(
        (timestamps[0]! + windowMs - now) / 1000,
      );
      return { allowed: false, retryAfter };
    }
    timestamps.push(now);
    return { allowed: true, retryAfter: 0 };
  };
}

const checkConnectRateLimit = makeRateLimiter(10, 60_000);
const checkSyncRateLimit = makeRateLimiter(10, 60_000);

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function requireUid(authHeader: string | undefined): Promise<string> {
  return verifyIdToken(authHeader);
}

export async function handleAspsps(query: {
  country?: string;
}): Promise<HandlerResult> {
  try {
    const aspsps = await listAspsps(query.country);
    return { status: 200, body: { aspsps } };
  } catch (err) {
    console.error("[bank] aspsps error:", err);
    return { status: 502, body: { error: "Failed to load bank list" } };
  }
}

export async function handleConnect(
  authHeader: string | undefined,
  body: { aspspName?: string; aspspCountry?: string },
): Promise<HandlerResult> {
  const rl = checkConnectRateLimit();
  if (!rl.allowed) {
    return {
      status: 429,
      body: { error: "Rate limit exceeded", retryAfter: rl.retryAfter },
    };
  }

  let uid: string;
  try {
    uid = await requireUid(authHeader);
  } catch {
    return { status: 401, body: { error: "Unauthorized" } };
  }

  if (!body.aspspName || !body.aspspCountry) {
    return { status: 400, body: { error: "aspspName and aspspCountry are required" } };
  }

  try {
    const result = await startAuth(uid, {
      name: body.aspspName,
      country: body.aspspCountry,
    });
    return { status: 200, body: { url: result.url } };
  } catch (err) {
    console.error("[bank] connect error:", err);
    return { status: 502, body: { error: "Failed to start bank authorization" } };
  }
}

export async function handleExchange(
  authHeader: string | undefined,
  body: { code?: string; state?: string },
): Promise<HandlerResult> {
  let uid: string;
  try {
    uid = await requireUid(authHeader);
  } catch {
    return { status: 401, body: { error: "Unauthorized" } };
  }

  if (!body.code || !body.state) {
    return { status: 400, body: { error: "code and state are required" } };
  }

  let stateUid: string;
  try {
    stateUid = verifyState(body.state);
  } catch {
    return { status: 400, body: { error: "Invalid or expired state" } };
  }

  if (stateUid !== uid) {
    return { status: 403, body: { error: "State does not match signed-in user" } };
  }

  try {
    const session = await exchangeCode(body.code);
    const connection: BankConnection = {
      sessionId: session.session_id,
      aspspName: session.aspsp.name,
      aspspCountry: session.aspsp.country,
      accounts: session.accounts.map((a) => ({
        uid: a.uid,
        name: a.name,
        iban: a.account_id?.iban,
        currency: a.currency,
      })),
      connectedAt: new Date().toISOString(),
    };
    await setBankConnection(uid, connection);
    return {
      status: 200,
      body: { aspspName: connection.aspspName, accounts: connection.accounts },
    };
  } catch (err) {
    console.error("[bank] exchange error:", err);
    return { status: 502, body: { error: "Failed to complete bank connection" } };
  }
}

export async function handleStatus(
  authHeader: string | undefined,
): Promise<HandlerResult> {
  let uid: string;
  try {
    uid = await requireUid(authHeader);
  } catch {
    return { status: 401, body: { error: "Unauthorized" } };
  }

  const connection = await getBankConnection(uid);
  if (!connection) {
    return { status: 200, body: { connected: false } };
  }
  return {
    status: 200,
    body: {
      connected: true,
      aspspName: connection.aspspName,
      aspspCountry: connection.aspspCountry,
      accounts: connection.accounts,
      connectedAt: connection.connectedAt,
    },
  };
}

interface NormalizedTx {
  amount: string;
  description: string;
  date: string;
  externalId: string;
  source: "bank";
}

function normalizeTransactions(
  accountUid: string,
  transactions: EbTransaction[],
): { expenses: NormalizedTx[]; incomes: NormalizedTx[] } {
  const expenses: NormalizedTx[] = [];
  const incomes: NormalizedTx[] = [];

  for (const tx of transactions) {
    const date = tx.booking_date ?? tx.value_date ?? tx.transaction_date;
    if (!date) continue;

    const amount = tx.transaction_amount?.amount ?? "0";
    const description =
      tx.remittance_information?.filter(Boolean).join(" ") ||
      tx.creditor?.name ||
      tx.debtor?.name ||
      "Bank transaction";
    const externalId =
      tx.entry_reference ?? tx.transaction_id ?? `${accountUid}:${date}:${amount}:${description}`;

    const item: NormalizedTx = {
      amount,
      description,
      date,
      externalId,
      source: "bank",
    };

    if (tx.credit_debit_indicator === "CRDT") incomes.push(item);
    else expenses.push(item);
  }

  return { expenses, incomes };
}

export async function handleSync(
  authHeader: string | undefined,
): Promise<HandlerResult> {
  const rl = checkSyncRateLimit();
  if (!rl.allowed) {
    return {
      status: 429,
      body: { error: "Rate limit exceeded", retryAfter: rl.retryAfter },
    };
  }

  let uid: string;
  try {
    uid = await requireUid(authHeader);
  } catch {
    return { status: 401, body: { error: "Unauthorized" } };
  }

  const connection = await getBankConnection(uid);
  if (!connection) {
    return { status: 404, body: { error: "No bank connection" } };
  }

  try {
    const expenses: NormalizedTx[] = [];
    const incomes: NormalizedTx[] = [];

    for (const account of connection.accounts) {
      const transactions = await getTransactions(account.uid);
      const normalized = normalizeTransactions(account.uid, transactions);
      expenses.push(...normalized.expenses);
      incomes.push(...normalized.incomes);
    }

    return { status: 200, body: { expenses, incomes } };
  } catch (err) {
    const message = errorMessage(err);
    // EB returns 401/403 once the underlying bank consent has expired or
    // been revoked — treat that as "needs reconnect" rather than a hard error.
    if (message.includes("API 401 ") || message.includes("API 403 ")) {
      await deleteBankConnection(uid);
      return { status: 410, body: { error: "Bank session expired, please reconnect" } };
    }
    console.error("[bank] sync error:", err);
    return { status: 500, body: { error: "Failed to sync bank transactions" } };
  }
}

export async function handleDisconnect(
  authHeader: string | undefined,
): Promise<HandlerResult> {
  let uid: string;
  try {
    uid = await requireUid(authHeader);
  } catch {
    return { status: 401, body: { error: "Unauthorized" } };
  }

  const connection = await getBankConnection(uid);
  if (connection) {
    try {
      await deleteSession(connection.sessionId);
    } catch (err) {
      // Revoking upstream is best-effort — still remove our own record.
      console.warn("[bank] failed to revoke EB session:", errorMessage(err));
    }
  }
  await deleteBankConnection(uid);
  return { status: 200, body: { connected: false } };
}
