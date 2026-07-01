import type { Observation } from "../../engine";
import { TIER_META } from "../../engine";
import { Chart, Meters } from "./Charts";

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
 *  shown as refusals; theories are fenced and end in a question. */
export function FindingCard({ o }: { o: Observation }) {
  const demoted = o.tier === "demoted";
  const theory = o.tier === "theory";
  const confDots = (o.data?.dots as number) ?? 2;
  const confWord = (o.data?.confidence as string) ?? "a hunch";
  return (
    <article className={`finding${demoted ? " demoted" : ""}${theory ? " theory" : ""}`}>
      <div className="f-head">
        <h3 className="f-title">{o.title}</h3>
        {o.fromAI && !theory ? <span className="fromai">via AI</span> : <span className={`tag ${o.tier}`}>{TIER_META[o.tier].label}</span>}
      </div>
      <p className="f-desc">{o.description}</p>
      {o.chart && <Chart spec={o.chart} />}
      {o.evidence && <Meters ev={o.evidence} />}

      {theory && (
        <div className="conf-pill">
          <span>Confidence</span>
          <ConfDots on={confDots} />
          <span>{confWord}</span>
        </div>
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
