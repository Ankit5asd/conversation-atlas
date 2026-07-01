// ── Provider adapters ─────────────────────────────────────────────────────────
// Bring-your-own-key, browser-direct. The key lives in the browser only; every
// request goes straight from the user's browser to their chosen provider. Our
// side is never in the path. One normalized call over four providers.

export type ProviderId = "anthropic" | "openai" | "gemini" | "custom";

export interface ProviderConfig {
  provider: ProviderId;
  apiKey: string;
  model: string;
  baseUrl?: string; // custom OpenAI-compatible endpoints (DeepSeek, Groq, Ollama, …)
}

export const PROVIDER_META: Record<ProviderId, { label: string; defaultModel: string; keyHint: string; needsBaseUrl?: boolean }> = {
  anthropic: { label: "Claude (Anthropic)", defaultModel: "claude-sonnet-5", keyHint: "sk-ant-…" },
  openai: { label: "GPT (OpenAI)", defaultModel: "gpt-4o", keyHint: "sk-…" },
  gemini: { label: "Gemini (Google)", defaultModel: "gemini-2.0-flash", keyHint: "AIza…" },
  custom: { label: "Custom (OpenAI-compatible)", defaultModel: "", keyHint: "your key", needsBaseUrl: true },
};

async function fail(res: Response): Promise<never> {
  let detail = "";
  try {
    detail = (await res.text()).slice(0, 400);
  } catch {
    /* ignore */
  }
  throw new Error(`${res.status} ${res.statusText}${detail ? ` — ${detail}` : ""}`);
}

/** Send a system + user prompt, get back the model's text (expected to be JSON). */
export async function callModel(cfg: ProviderConfig, system: string, user: string): Promise<string> {
  if (!cfg.apiKey) throw new Error("No API key provided.");
  if (!cfg.model) throw new Error("No model id provided.");

  if (cfg.provider === "anthropic") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": cfg.apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({ model: cfg.model, max_tokens: 2048, system, messages: [{ role: "user", content: user }] }),
    });
    if (!res.ok) await fail(res);
    const j = await res.json();
    return (j.content ?? []).map((b: { text?: string }) => b.text ?? "").join("");
  }

  if (cfg.provider === "gemini") {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent?key=${encodeURIComponent(cfg.apiKey)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.7 },
      }),
    });
    if (!res.ok) await fail(res);
    const j = await res.json();
    return (j.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
  }

  // openai + custom (OpenAI-compatible chat completions)
  const base = cfg.provider === "custom" ? (cfg.baseUrl ?? "").replace(/\/+$/, "") : "https://api.openai.com/v1";
  if (cfg.provider === "custom" && !base) throw new Error("Custom provider needs a base URL (e.g. https://api.groq.com/openai/v1).");
  const body: Record<string, unknown> = {
    model: cfg.model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.7,
  };
  // Only OpenAI proper reliably supports json_object mode; custom endpoints vary.
  if (cfg.provider === "openai") body.response_format = { type: "json_object" };
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) await fail(res);
  const j = await res.json();
  return j.choices?.[0]?.message?.content ?? "";
}
