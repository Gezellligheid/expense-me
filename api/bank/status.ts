import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleStatus } from "../../server/lib/bankHandlers";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { status, body } = await handleStatus(req.headers.authorization);
  res.status(status).json(body);
}
