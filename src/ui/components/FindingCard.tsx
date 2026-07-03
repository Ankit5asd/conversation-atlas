import { useState } from "react";
import type { Observation } from "../../engine";
import { TIER_META } from "../../engine";
import { Chart, Meters } from "./Charts";
import { useReveal } from "../hooks";

export type FeedbackVal = "rings-true" | "not-me";

function ConfDots({ on }: { on: number }) {
  return (
    <span className="conf-dots">
      {[0, 1, 2, 3, 4].map((i) => (
        <i key={i} className={i < on ? "on" : ""} />
      ))}
    </span>
  );
}

/** Renders one observation as a card, styled by its tier. Demoted findings are
 *  shown as refusals; theories are fenced, end in a question, and take the
 *  user's verdict as evidence. "Show me why" opens the real conversations. */
export function FindingCard({ o, fb, onFeedback }: { o: Observation; fb?: FeedbackVal; onFeedback?: (id: string, v: FeedbackVal) => void }) {
  const demoted = o.tier === "demoted";
  const theory = o.tier === "theory";
  const [why, setWhy] = useState(false);
  const { ref, inView } = useReveal<HTMLElement>();
  const confDots = (o.data?.dots as number) ?? 2;
  const confWord = (o.data?.confidence as string) ?? "a hunch";
  return (
    <article ref={ref} className={`finding${demoted ? " demoted" : ""}${theory ? " theory" : ""} reveal${inView ? " in" : ""}`}>
      <div className="f-head">
        <h3 className="f-title">{o.title}</h3>
        {o.fromAI && !theory ? <span className="fromai">via AI</span> : <span className={`tag ${o.tier}`}>{TIER_META[o.tier].label}</span>}
      </div>
      <p className="f-desc">{o.description}</p>
      {o.chart && <Chart spec={o.chart} />}
      {o.evidence && <Meters ev={o.evidence} />}

      {o.examples && o.examples.length > 0 && (
        <div className="why">
          <button className="why-btn" data-noexport onClick={() => setWhy((v) => !v)}>
            {why ? "− Hide the evidence" : "Show me why — the actual conversations"}
          </button>
          {why && (
            <ul className="why-list">
              {o.examples.map((e, i) => (
                <li key={i}>
                  <span className="why-title">{e.title}</span>
                  <span className="why-meta">
                    {e.date}
                    {e.date ? " · " : ""}
                    {e.turns} turns
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {theory && (
        <div className="conf-pill">
          <span>Confidence</span>
          <ConfDots on={confDots} />
          <span>{confWord}</span>
        </div>
      )}

      {theory && onFeedback && (
        <div className="actions" data-noexport>
          <button className={`btn${fb === "rings-true" ? " sel" : ""}`} onClick={() => onFeedback(o.id, "rings-true")}>
            Rings true
          </button>
          <button className={`btn${fb === "not-me" ? " sel" : ""}`} onClick={() => onFeedback(o.id, "not-me")}>
            Not me
          </button>
        </div>
      )}
      {theory && fb && (
        <div className="fb-note">You said: {fb === "rings-true" ? "rings true" : "not me"} — recorded as evidence (kept in your JSON export), never overwritten.</div>
      )}

      {demoted && o.demotedReason && (
        <div className="conf-pill">
          <span>Robustness</span>
          <ConfDots on={2} />
          <span>{o.demotedReason}</span>
        </div>
      )}

      {o.aiNote && (
        <div className="ai-note">
          <div className="who">
            <span>◆ AI re-read</span>
            {o.aiSuggestedTier && o.aiSuggestedTier !== o.tier && <span className="retier">reads this as: {TIER_META[o.aiSuggestedTier].label}</span>}
          </div>
          {o.aiNote}
        </div>
      )}
    </article>
  );
}
