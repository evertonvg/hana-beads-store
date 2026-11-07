import type { InboxMessage } from "../contract/auth.contract";

/** Mailpit, the test inbox `supabase start` runs (`npx supabase status` → MAILPIT_URL). */
const MAILPIT = "http://127.0.0.1:54324";

type Summary = { ID: string; Created: string; To: { Address: string }[] };

async function mailpit<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${MAILPIT}${path}`, init);
  if (!res.ok) throw new Error(`Mailpit ${path}: HTTP ${res.status}`);
  return (init?.method === "DELETE" ? undefined : await res.json()) as T;
}

/**
 * The app link an auth e-mail points to, as path + query of `/auth/confirm`. Our templates link
 * there directly; GoTrue's default template links to `/auth/v1/verify?token=…&type=…`, whose token
 * is the same hash, so it is rewritten to the link our template would have produced.
 */
export function toConfirmLink(href: string): string | null {
  const url = new URL(href);
  if (url.pathname === "/auth/confirm") return `${url.pathname}${url.search}`;
  if (!url.pathname.endsWith("/auth/v1/verify")) return null;
  const token = url.searchParams.get("token");
  if (!token) return null;
  const query = new URLSearchParams({
    token_hash: token,
    type: url.searchParams.get("type") === "recovery" ? "recovery" : "email",
  });
  const redirect = url.searchParams.get("redirect_to");
  const next = redirect ? new URL(redirect).searchParams.get("next") : null;
  if (next) query.set("next", next);
  return `/auth/confirm?${query.toString()}`;
}

function toInboxMessage(html: string): InboxMessage | null {
  for (const [, raw] of html.matchAll(/href="([^"]+)"/g)) {
    const link = toConfirmLink(raw.replaceAll("&amp;", "&"));
    if (!link) continue;
    const type = new URL(link, "http://x.invalid").searchParams.get("type");
    return { kind: type === "recovery" ? "recuperacao" : "confirmacao", link };
  }
  return null;
}

async function fetchInbox(email: string): Promise<InboxMessage[]> {
  const to = email.trim().toLowerCase();
  const { messages } = await mailpit<{ messages: Summary[] }>(
    `/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}&limit=50`,
  );
  const mine = messages
    .filter((m) => m.To.some((t) => t.Address.toLowerCase() === to))
    .sort((a, b) => a.Created.localeCompare(b.Created));
  const out: InboxMessage[] = [];
  for (const m of mine) {
    const { HTML } = await mailpit<{ HTML: string }>(`/api/v1/message/${m.ID}`);
    const msg = toInboxMessage(HTML);
    if (msg) out.push(msg);
  }
  return out;
}

/** Auth e-mails sent to `email`, oldest first (waits briefly for delivery when there is none). */
export async function readInbox(email: string): Promise<InboxMessage[]> {
  for (let attempt = 0; ; attempt++) {
    const inbox = await fetchInbox(email);
    if (inbox.length > 0 || attempt >= 10) return inbox;
    await new Promise((r) => setTimeout(r, 100));
  }
}

/** The `/auth/confirm` link (path + query) of the most recent auth e-mail sent to `email`. */
export async function latestLink(email: string): Promise<string> {
  const last = (await readInbox(email)).at(-1);
  if (!last) throw new Error(`no auth e-mail for ${email}`);
  return last.link;
}

/** Empties the inbox (tests use unique addresses anyway). */
export async function clearInbox(): Promise<void> {
  await mailpit("/api/v1/messages", { method: "DELETE" });
}
