import { useState } from "react";
import type { AtlasResult } from "../../engine";
import { PROVIDER_META, enrichWithAI, applyEnrichment, type ProviderConfig, type ProviderId } from "../../engine/ai";

const PROVIDERS: ProviderId[] = ["anthropic", "openai", "gemini", "custom"];

/** Bring-your-own-key panel. The key stays in this component's memory only —
 *  it is never stored, never sent anywhere except straight to the provider. */
export function AiPanel({ result, onEnriched }: { result: AtlasResult; onEnriched: (r: AtlasResult) => void }) {
  const saved = (() => {
    try {
      return JSON.parse(sessionStorage.getItem("atlas.ai") ?? "{}");
    } catch {
      return {};
    }
  })();
  const savedProvider: ProviderId = saved.provider ?? "anthropic";
  const [provider, setProvider] = useState<ProviderId>(savedProvider);
  const [model, setModel] = useState<string>(saved.model ?? PROVIDER_META[savedProvider].defaultModel);
  const [baseUrl, setBaseUrl] = useState<string>(saved.baseUrl ?? "");
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function pick(p: ProviderId) {
    setProvider(p);
    setModel(PROVIDER_META[p].defaultModel);
  }

  async function run() {
    setErr(null);
    setBusy(true);
    // Persist non-secret choices only (never the key).
    try {
      sessionStorage.setItem("atlas.ai", JSON.stringify({ provider, model, baseUrl }));
    } catch {
      /* ignore */
    }
    const cfg: ProviderConfig = { provider, apiKey: apiKey.trim(), model: model.trim(), baseUrl: baseUrl.trim() || undefined };
    try {
      const enrichment = await enrichWithAI(result, cfg);
      onEnriched(applyEnrichment(result, enrichment));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const meta = PROVIDER_META[provider];

  return (
    <div className="aipanel">
      <div className="ap-head">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="var(--violet)" strokeWidth="2">
          <path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2z" />
          <path d="M9 21h6M10 18h4" />
        </svg>
        Add an AI to unlock theories + a re-read
      </div>
      <p className="ap-sub">
        The interpretive sections (language & fenced theories) run on <b>your</b> key, called straight from your browser. The AI works inside the locked contract — it can propose fenced guesses and push back on findings, but it can't invent scores, apply labels, or revive anything the engine demoted.
      </p>

      <div className="ap-grid">
        <div className="ap-field">
          <label>Provider</label>
          <select value={provider} onChange={(e) => pick(e.target.value as ProviderId)}>
            {PROVIDERS.map((p) => (
              <option key={p} value={p}>{PROVIDER_META[p].label}</option>
            ))}
          </select>
        </div>
        {meta.needsBaseUrl && (
          <div className="ap-field grow">
            <label>Base URL</label>
            <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.groq.com/openai/v1" />
          </div>
        )}
        <div className="ap-field">
          <label>Model</label>
          <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="model id" />
        </div>
        <div className="ap-field grow">
          <label>API key</label>
          <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={meta.keyHint} autoComplete="off" />
        </div>
        <button className="ap-run" onClick={run} disabled={busy || !apiKey.trim() || !model.trim()}>
          {busy ? "Analyzing…" : "Run AI analysis"}
        </button>
      </div>

      <div className="ap-note">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
        <span>Your key is held in memory only — never stored, never sent to us, cleared when you close the tab. Only aggregate stats + your conversation titles are sent to the provider you pick.</span>
      </div>
      {err && <div className="ap-err">Couldn't run analysis: {err}</div>}
    </div>
  );
}
