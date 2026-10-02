/**
 * Cron authorization. When CRON_SECRET is set, Vercel Cron sends
 * `Authorization: Bearer <CRON_SECRET>`; we require an exact match.
 * When CRON_SECRET is unset (local dev), all requests are allowed.
 */
export function checkCronAuth(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const header = req.headers.get("authorization") || "";
  return header === `Bearer ${secret}`;
}

export function unauthorized(): Response {
  return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
}

export function notConfigured(): Response {
  return Response.json(
    { ok: false, error: "Supabase is not configured (missing env vars)" },
    { status: 503 }
  );
}
