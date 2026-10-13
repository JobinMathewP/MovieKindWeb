import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: "pkce",
        },
      })
    : null;

export function isGuestUser(user: User | null | undefined): boolean {
  if (!user) return false;
  const linked = user.identities?.some((identity) => identity.provider === "google");
  if (linked) return false;
  return user.is_anonymous === true || user.user_metadata?.guest === true;
}

export async function currentIsGuest(): Promise<boolean> {
  if (!supabase) return false;
  const { data } = await supabase.auth.getSession();
  return isGuestUser(data.session?.user);
}

export async function linkGoogle(): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.auth.linkIdentity({
    provider: "google",
    options: { redirectTo: window.location.origin },
  });
  if (error) throw error;
}

export function suggestedDisplayName(user: User | null | undefined): string {
  const sources: unknown[] = [user?.user_metadata, ...(user?.identities ?? []).map((identity) => identity.identity_data)];
  for (const source of sources) {
    if (!source || typeof source !== "object") continue;
    const record = source as Record<string, unknown>;
    const full = text(record.full_name) || text(record.name);
    if (full) return full.slice(0, 80);
    const joined = [text(record.given_name), text(record.family_name)].filter(Boolean).join(" ");
    if (joined) return joined.slice(0, 80);
  }
  return "";
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
