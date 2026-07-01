import type { Observation } from "../../engine";
import { TIER_META } from "../../engine";
import { Chart, Meters } from "./Charts";

/** Renders one observation as a card, styled by its tier. Demoted findings are
 *  shown as refusals (dashed, with a "why we won't claim this" pill). */
export function FindingCard({ o }: { o: Observation }) {
  const demoted = o.tier === "demoted";
  return (
    <article className={`finding${demoted ? " demoted" : ""}`}>
      <div className="f-head">
        <h3 className="f-title">{o.title}</h3>
        <span className={`tag ${o.tier}`}>{TIER_META[o.tier].label}</span>
      </div>
      <p className="f-desc">{o.description}</p>
      {o.chart && <Chart spec={o.chart} />}
      {o.evidence && <Meters ev={o.evidence} />}
      {demoted && o.demotedReason && (
        <div className="conf-pill">
          <span>Robustness</span>
          <span className="conf-dots">
            <i className="on" />
            <i className="on" />
            <i />
            <i />
            <i />
          </span>
          <span>{o.demotedReason}</span>
        </div>
      )}
    </article>
  );
}
