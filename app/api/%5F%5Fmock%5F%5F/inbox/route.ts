import { getMockStore } from "@/lib/data/mock/store";
import { env } from "@/lib/env";

// Test-only endpoint: the auth e-mails the mock "sent" to ?email=, oldest first.
export function GET(request: Request) {
  if (env.DATA_SOURCE !== "mock") return new Response(null, { status: 404 });
  const email = (new URL(request.url).searchParams.get("email") ?? "").trim().toLowerCase();
  return Response.json(getMockStore().inbox.filter((m) => m.to === email));
}
