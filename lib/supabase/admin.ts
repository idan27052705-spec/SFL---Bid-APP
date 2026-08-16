import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client. BYPASSES ROW LEVEL SECURITY.
 *
 * Server-side only, and only for the sub portal — subs have no Supabase
 * account, so portal routes authenticate the sub themselves (email +
 * access code) and then read/write on their behalf. Every portal route
 * MUST check that the record belongs to the signed-in sub before using
 * this client. Never import it into a client component.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
