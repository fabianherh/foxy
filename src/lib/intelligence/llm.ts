type JsonSchema = Record<string, unknown>;

type ChatCompletion = {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
};

export async function generateStructured<T>(name: string, schema: JsonSchema, system: string, input: unknown): Promise<T | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "X-Title": "Foxy AI Interviewer" },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || "openai/gpt-4.1-mini",
        temperature: 0.2,
        messages: [
          { role: "system", content: system },
          { role: "user", content: JSON.stringify(input) },
        ],
        response_format: { type: "json_schema", json_schema: { name, strict: true, schema } },
      }),
      signal: AbortSignal.timeout(35000),
    });
    const payload = await response.json().catch(() => ({})) as ChatCompletion;
    if (!response.ok) {
      console.error(`OpenRouter request failed for ${name}`, { status: response.status, message: payload.error?.message });
      return null;
    }
    const content = payload.choices?.[0]?.message?.content;
    if (!content) console.error(`OpenRouter returned no content for ${name}`);
    return content ? JSON.parse(content) as T : null;
  } catch (error) {
    console.error(`OpenRouter call threw for ${name}`, error instanceof Error ? { name: error.name, message: error.message } : { name: "UnknownError" });
    return null;
  }
}
