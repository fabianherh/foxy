const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(["pdf", "docx", "doc", "rtf", "txt", "md"]);

type ParseResponse = {
  success?: boolean;
  markdown?: string;
  type?: string;
  error?: string;
  message?: string;
  error_code?: string;
  key_metadata?: { credits_consumed?: number };
};

async function parseWithContext(bytes: ArrayBuffer, extension: string, contentType: string, ocr = false): Promise<{ response: Response; payload: ParseResponse }> {
  const apiKey = process.env.CONTEXT_DEV_API_KEY || process.env.CONTEXT_API_KEY;
  if (!apiKey) throw new Error("Context.dev is not configured");
  const params = new URLSearchParams({ extension, includeLinks: "false", includeImages: "false" });
  if (ocr) params.set("ocr", "true");
  const response = await fetch(`https://api.context.dev/v1/parse?${params}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": contentType || "application/octet-stream", "X-Context-Tag": "foxy-cv-parse" },
    body: bytes,
    signal: AbortSignal.timeout(60000),
  });
  return { response, payload: await response.json().catch(() => ({})) as ParseResponse };
}

export const runtime = "nodejs";
export const maxDuration = 90;

export async function POST(request: Request) {
  try {
    const filename = request.headers.get("x-file-name") || "";
    const extension = filename.split(".").pop()?.toLowerCase() || "";
    if (!ALLOWED_EXTENSIONS.has(extension)) return Response.json({ error: "Upload a PDF, DOCX, DOC, RTF, TXT, or Markdown résumé." }, { status: 415 });
    const declaredSize = Number(request.headers.get("content-length") || 0);
    if (declaredSize > MAX_FILE_SIZE) return Response.json({ error: "The résumé must be smaller than 10 MB." }, { status: 413 });
    const bytes = await request.arrayBuffer();
    if (!bytes.byteLength || bytes.byteLength > MAX_FILE_SIZE) return Response.json({ error: "The résumé must contain data and be smaller than 10 MB." }, { status: 413 });
    let result = await parseWithContext(bytes, extension, request.headers.get("content-type") || "application/octet-stream");
    if (!result.response.ok && result.payload.error_code === "PDF_IMAGES_ONLY" && extension === "pdf") result = await parseWithContext(bytes, extension, request.headers.get("content-type") || "application/pdf", true);
    if (!result.response.ok || !result.payload.markdown?.trim()) {
      const message = result.payload.message || result.payload.error || "The résumé could not be read. Try exporting it as a text-based PDF.";
      return Response.json({ error: message }, { status: result.response.status >= 400 && result.response.status < 500 ? result.response.status : 502 });
    }
    return Response.json({ text: result.payload.markdown.slice(0, 50000), type: result.payload.type || extension, credits: result.payload.key_metadata?.credits_consumed ?? null });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "The résumé could not be parsed." }, { status: 502 });
  }
}
