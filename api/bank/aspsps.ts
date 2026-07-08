import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleAspsps } from "../../server/lib/bankHandlers";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const country = typeof req.query.country === "string" ? req.query.country : undefined;
  const { status, body } = await handleAspsps({ country });
  res.status(status).json(body);
}
