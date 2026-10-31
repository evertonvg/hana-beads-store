import { getData } from "@/lib/data";
import { getSession } from "@/lib/session";

const NO_STORE = { "Cache-Control": "no-store" } as const;

/** LGPD data export: a JSON file with everything stored about the signed-in user, and only them. */
export async function GET() {
  const user = await getSession().catch(() => null);
  if (!user) return Response.json({ error: "Não autorizado." }, { status: 401, headers: NO_STORE });
  const data = await getData().account.exportData(user.id);
  if (!data) return Response.json({ error: "Não autorizado." }, { status: 401, headers: NO_STORE });
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      ...NO_STORE,
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="pixel-perfect-meus-dados.json"',
    },
  });
}
