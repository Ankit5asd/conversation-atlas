import { useEffect, useState } from "react";
import type { AtlasResult, Observation } from "../../engine";
import { CATEGORIES, ONTOLOGY } from "../../engine";
import { FindingCard, type FeedbackVal } from "./FindingCard";
import { AiPanel } from "./AiPanel";
import { viewReport, printReport, exportJSON } from "../export";
import { useReveal } from "../hooks";

const SYSTEM_NAME = "Conversation Atlas";

function AuditPanel({ o }: { o: Observation }) {
  const { ref, inView } = useReveal<HTMLDivElement>();
  const rows = (o.data?.rows as { k: string; kind: string; t: string }[]) ?? [];
  return (
    <div ref={ref} className={`audit reveal${inView ? " in" : ""}`}>
      {rows.map((r, i) => (
        <div className="audit-row" key={i}>
          <span className={`audit-k ak-${r.kind}`}>{r.k}</span>
          <span className="audit-t">{r.t}</span>
        </div>
      ))}
    </div>
  );
}

/** The story first: the three strongest findings, before the deep dive. */
function Takeaways({ result }: { result: AtlasResult }) {
  const top = [...result.observations]
    .filter((o) => o.tier === "solid" || o.tier === "surprising")
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  if (top.length < 2) return null;
  return (
    <div className="takeaways">
      <div className="tk-label">If you remember three things</div>
      <div className="tk-grid">
        {top.map((o, i) => (
          <a key={o.id} className="tk" href={`#${CATEGORIES[o.category].key}`}>
            <span className="tk-num">{String(i + 1).padStart(2, "0")}</span>
            <span className="tk-title">{o.title}</span>
            <span className="tk-cat">{CATEGORIES[o.category].title} ↓</span>
          </a>
        ))}
      </div>
    </div>
  );
}

/** Guardrail 2 — assumptions visible: the exact keywords behind each topic. */
function Assumptions() {
  const [open, setOpen] = useState(false);
  const words = (rx: RegExp) => rx.source.replace(/\\b/g, "").replace(/[()]/g, "").split("|").join(" · ");
  return (
    <div className="assume">
      <button className="why-btn" data-noexport onClick={() => setOpen((v) => !v)}>
        {open ? "− Hide the topic assumptions" : "⚙ Inspect the topic assumptions"}
      </button>
      {open && (
        <div className="assume-body">
          <p>
            Every "topic" above is a keyword bucket — a <b>chosen resolution, not a fact about you</b>. A conversation counts toward a topic if your words match any of these. Change the words and the story shifts; that's exactly why we show them.
          </p>
          {Object.entries(ONTOLOGY).map(([t, rx]) => (
            <div className="assume-row" key={t}>
              <b>{t}</b>
              <span>{words(rx)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Dashboard({ result, onReset, onEnriched, demoMode }: { result: AtlasResult; onReset: () => void; onEnriched: (r: AtlasResult) => void; demoMode?: boolean }) {
  const { meta, byCategory } = result;
  const [feedback, setFeedback] = useState<Record<string, FeedbackVal>>({});
  const [active, setActive] = useState("");

  const growth = byCategory[2]?.find((o) => o.id === "DEPTH_GROWTH");
  const growthX = (growth?.data?.growth as number) ?? null;
  const timing = byCategory[1]?.find((o) => o.id === "OVERVIEW_TIMING");
  const peakHour = (timing?.data?.peakHour as number) ?? null;
  const deepest = byCategory[2]?.find((o) => o.id === "DEPTH_DEEPEST");
  const deepestTurns = (deepest?.data?.turns as number) ?? null;

  const sectionsOrder = [1, 2, 3, 4, 5, 6, 7, 8, 9];

  // Highlight the section currently being read.
  useEffect(() => {
    const secs = document.querySelectorAll("section.sec");
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => e.isIntersecting && setActive((e.target as HTMLElement).id)),
      { rootMargin: "-35% 0px -55% 0px" },
    );
    secs.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);

  const giveFeedback = (id: string, v: FeedbackVal) =>
    setFeedback((f) => {
      const n = { ...f };
      if (n[id] === v) delete n[id];
      else n[id] = v;
      return n;
    });

  return (
    <div className="shell">
      <div className="topbar">
        <div className="brand">
          <span className="mark">A</span>
          {SYSTEM_NAME}
        </div>
        <div className="topbar-right">
          <div className="meta">
            {meta.total} conversations · {meta.dateRange.start?.slice(0, 4)}–{meta.dateRange.end?.slice(0, 4)}
          </div>
          <div className="dl-group" data-noexport>
            <button className="dl primary" onClick={() => printReport()} title="Save as PDF — opens on any phone. In the dialog, pick 'Save as PDF'.">
              ⤓ Save as PDF
            </button>
            <button className="dl" onClick={() => viewReport(result)} title="Open your report in a new browser tab">
              ⤢ View
            </button>
            <button className="dl" onClick={() => exportJSON(result, feedback)} title="Export the raw findings (and your theory verdicts) as JSON">
              JSON
            </button>
          </div>
        </div>
      </div>

      {demoMode && (
        <div className="demo-banner">
          <span>
            <b>Sample data.</b> This is a fictional student's three years of AI chats — not you, not any real person. Load your own export to see your real atlas.
          </span>
          <button className="demo-btn" data-noexport onClick={onReset}>
            Analyze my own →
          </button>
        </div>
      )}

      <nav className="nav">
        {sectionsOrder.map((n) => (
          <a key={n} href={`#${CATEGORIES[n].key}`} className={active === CATEGORIES[n].key ? "active" : ""}>
            {CATEGORIES[n].title}
          </a>
        ))}
        <a onClick={onReset} style={{ marginLeft: "auto" }} data-noexport>
          ↺ new export
        </a>
      </nav>

      <header className="hero">
        <div className="eyebrow">{demoMode ? "Sample results — a fictional student" : "Your full results"}</div>
        <h1>
          How you think out loud
          <br />
          with <em>AI</em>.
        </h1>
        <p className="lede">
          {sectionsOrder.length} ways of looking at your {meta.total} conversations — each finding measured from your own words, tagged by how confident the evidence is, and honest about what it can't see.
        </p>
        <div className="scope">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
          This reflects your AI conversations only — a real slice of your thinking, not your whole life.
        </div>
      </header>

      <div className="stats">
        <div className="stat">
          <div className="n">{meta.total}</div>
          <div className="l">Conversations</div>
          <div className="s">{meta.activeMonths} active months</div>
        </div>
        <div className="stat">
          <div className="n">{growthX ? `${growthX}×` : "—"}</div>
          <div className="l">Depth growth</div>
          <div className="s">first → last year</div>
        </div>
        <div className="stat">
          <div className="n">{peakHour != null ? `${peakHour}:00` : "—"}</div>
          <div className="l">Peak hour</div>
          <div className="s">your local time</div>
        </div>
        <div className="stat">
          <div className="n">{deepestTurns ?? "—"}</div>
          <div className="l">Deepest thread</div>
          <div className="s">turns in one chat</div>
        </div>
      </div>

      <Takeaways result={result} />

      {sectionsOrder.map((n) => {
        const cat = CATEGORIES[n];
        const items = byCategory[n] ?? [];
        const isAudit = n === 9;
        const isTheories = n === 8;
        const hasAI = result.observations.some((o) => o.fromAI);
        return (
          <section className="sec" id={cat.key} key={n}>
            <div className="sec-head">
              <span className="sec-num">{String(n).padStart(2, "0")}</span>
              <span className="sec-title">{cat.title}</span>
              <span className="rule" />
            </div>
            <p className="sec-intro">{cat.intro}</p>
            {isTheories && (
              <div data-noexport>
                <AiPanel result={result} onEnriched={onEnriched} />
              </div>
            )}
            {isTheories && !hasAI && items.length === 0 && (
              <p className="sec-intro" style={{ marginBottom: 0 }}>
                No theories yet — these are only ever generated by a model you plug in above, tagged as guesses, and phrased as questions. The engine never fabricates them.
              </p>
            )}
            {isAudit
              ? items.map((o) => <AuditPanel o={o} key={o.id} />)
              : items.map((o) => <FindingCard o={o} key={o.id} fb={feedback[o.id]} onFeedback={giveFeedback} />)}
            {n === 3 && <Assumptions />}
            {isAudit && (
              <p className="footnote">
                <b>How to read this.</b> Every finding is tagged by how much to trust it. <b>Solid</b> findings are measured and survive testing. <b>Surprising</b> ones are real but worth a second look. <b>Context</b> is true background. <b>Demoted</b> items are things the engine found but refused to claim. <b>Theories</b> (with a key) are guesses that end in a question — because you decide if they fit. All of it sees only your AI conversations, never your whole life.
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}
