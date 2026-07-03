import { useRef, useState } from "react";
import { parseExport, analyze, buildDemoConversations, type AtlasResult } from "../../engine";

const SYSTEM_NAME = "Conversation Atlas";

export function Upload({ onResult, onDemo }: { onResult: (r: AtlasResult, name: string) => void; onDemo: (r: AtlasResult) => void }) {
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handle(file: File) {
    setErr(null);
    setBusy(`Reading ${file.name} (${(file.size / 1e6).toFixed(1)} MB)…`);
    // Yield to the browser so the busy state paints before the heavy parse.
    await new Promise((r) => setTimeout(r, 30));
    try {
      const text = await file.text();
      setBusy("Analyzing your conversations…");
      await new Promise((r) => setTimeout(r, 30));
      const { conversations, format } = parseExport(JSON.parse(text));
      if (format === "unknown" || conversations.length === 0) {
        setBusy(null);
        setErr("Couldn't recognize this as a ChatGPT or Claude export. Expected conversations.json (ChatGPT) or a Claude data export.");
        return;
      }
      const dated = conversations.filter((c) => c.year != null);
      if (dated.length === 0) {
        setBusy(null);
        setErr("Parsed the file, but found no conversations with timestamps to analyze.");
        return;
      }
      const result = analyze(conversations); // browser: uses local timezone
      onResult(result, file.name);
    } catch (e) {
      setBusy(null);
      setErr(`Couldn't parse the file: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return (
    <div className="shell">
      <div className="topbar">
        <div className="brand">
          <span className="mark">A</span>
          {SYSTEM_NAME}
        </div>
        <div className="meta">browser-only · nothing uploaded</div>
      </div>

      <div className="landing">
        <div className="eyebrow">A mirror, not a verdict</div>
        <h1 style={{ fontFamily: "var(--serif)", fontWeight: 500, fontSize: "clamp(28px,5.5vw,40px)", lineHeight: 1.1, letterSpacing: "-.02em", marginBottom: 16 }}>
          See how you think out loud with <em style={{ fontStyle: "italic", color: "var(--teal-d)" }}>AI</em>.
        </h1>
        <p style={{ fontSize: 16, color: "var(--ink-soft)", maxWidth: "52ch", lineHeight: 1.55 }}>
          Drop in your exported chat history. The engine reads it entirely in your browser and shows an honest, evidence-tagged map of your patterns — and openly states what it can't see. No personality labels. No fake scores.
        </p>

        <div
          className={`drop${over ? " over" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files?.[0]; if (f) handle(f); }}
          onClick={() => inputRef.current?.click()}
        >
          <input ref={inputRef} type="file" accept=".json,application/json" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handle(f); }} />
          <h3>Drop your export here</h3>
          <p>ChatGPT: Settings → Data controls → Export → the <b>conversations.json</b> inside the zip.</p>
          <p>Claude: Settings → Account → Export data.</p>
          <button className="pick" type="button">Choose a file</button>
        </div>

        <div className="demo-row">
          <span>No export handy?</span>
          <button className="demo-btn" onClick={() => onDemo(analyze(buildDemoConversations()))}>
            See a sample atlas →
          </button>
        </div>

        {busy && <div className="busy">{busy}</div>}
        {err && <div className="err">{err}</div>}

        <div className="privacy">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span>
            <b>Even this web app never sees your data.</b> Your export is read in-memory in your browser and never uploaded. No account, no server, no storage — close the tab and it's gone.
          </span>
        </div>
      </div>
    </div>
  );
}
