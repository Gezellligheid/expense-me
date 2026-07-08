import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleExchange } from "../../server/lib/bankHandlers";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const { status, body } = await handleExchange(req.headers.authorization, req.body ?? {});
  res.status(status).json(body);
}
