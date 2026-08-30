import { validateGithubProfile } from "@/lib/intelligence/github";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { url?: unknown };
    if (typeof body.url !== "string" || !body.url.trim()) return Response.json({ error: "GitHub profile is required" }, { status: 400 });
    return Response.json(await validateGithubProfile(body.url));
  } catch (error) {
    const message = error instanceof Error ? error.message : "GitHub profile validation failed";
    return Response.json({ error: message }, { status: message.includes("temporarily") ? 502 : 400 });
  }
}
