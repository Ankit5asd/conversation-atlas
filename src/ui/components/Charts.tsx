import { useEffect, useState } from "react";
import type { ChartSpec, EvidenceVector } from "../../engine";

/** Bars animate from 0 → final on mount (respects reduced-motion via CSS). */
function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setM(true), 30);
    return () => clearTimeout(t);
  }, []);
  return m;
}

export function Chart({ spec }: { spec: ChartSpec }) {
  if (spec.kind === "vbars") return <VBars spec={spec} />;
  if (spec.kind === "hbars") return <HBars spec={spec} />;
  return <MiniGrid spec={spec} />;
}

function Caption({ text, color }: { text: string; color?: string }) {
  return (
    <div className="caption">
      {color && <span className="swatch" style={{ background: color }} />}
      <span>{text}</span>
    </div>
  );
}

function VBars({ spec }: { spec: Extract<ChartSpec, { kind: "vbars" }> }) {
  const mounted = useMounted();
  const max = Math.max(...spec.bars.map((b) => b.value), 1);
  return (
    <>
      <div className="chart">
        {spec.bars.map((b, i) => {
          const h = Math.max(Math.round((b.value / max) * 100), 5);
          return (
            <div className="cbar-wrap" key={i}>
              <div className="cbar" style={{ height: mounted ? `${h}%` : "0%", background: b.color }}>
                <span className="v" style={b.muted ? { color: "var(--ink-faint)", fontSize: "10.5px" } : undefined}>{b.display}</span>
              </div>
              <div className="cbar-lab">{b.label}</div>
            </div>
          );
        })}
      </div>
      <Caption text={spec.caption} color={spec.captionColor ?? spec.bars.find((b) => !b.muted)?.color} />
    </>
  );
}

function HBars({ spec }: { spec: Extract<ChartSpec, { kind: "hbars" }> }) {
  const mounted = useMounted();
  return (
    <>
      <div className="hbars">
        {spec.bars.map((b, i) => {
          const w = Math.max(Math.round((b.value / b.max) * 100), 2);
          return (
            <div className="hrow" key={i}>
              <span className="hlab">{b.label}</span>
              <div className="htrack">
                <div className="hfill" style={{ width: mounted ? `${w}%` : "0%", background: b.color }} />
              </div>
              <span className="hval">{b.display}</span>
            </div>
          );
        })}
      </div>
      <Caption text={spec.caption} color={spec.captionColor ?? spec.bars[0]?.color} />
    </>
  );
}

function MiniGrid({ spec }: { spec: Extract<ChartSpec, { kind: "mini" }> }) {
  const mounted = useMounted();
  return (
    <>
      <div className="mini-grid">
        {spec.items.map((it, i) => {
          const max = Math.max(...it.vals, 1);
          return (
            <div className="mini" key={i}>
              <div className="mini-top">
                <span className="mini-name">{it.name}</span>
                <span className={`mini-badge ${it.badgeKind}`}>{it.badge}</span>
              </div>
              <div className="mini-spark">
                {it.vals.map((v, j) => (
                  <div className="sb" key={j} style={{ height: mounted ? `${Math.max(Math.round((v / max) * 100), 4)}%` : "2px", background: it.color }} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div className="caption" style={{ marginTop: 14 }}>{spec.caption}</div>
    </>
  );
}

const METER_LABELS: Record<keyof EvidenceVector, string> = {
  strength: "EVIDENCE",
  robustness: "ROBUSTNESS",
  ambiguity: "AMBIGUITY",
  scope: "SCOPE",
};
// For ambiguity/scope, a *low* bar is good — label it honestly.
function meterWord(key: keyof EvidenceVector, v: number): string {
  if (key === "robustness") return v >= 0.95 ? "Survives all" : v >= 0.6 ? "Mostly holds" : "Fails";
  if (key === "ambiguity") return v <= 0.35 ? "Low" : v <= 0.6 ? "Some" : "High";
  if (key === "scope") return "AI words only";
  return v >= 0.8 ? "Strong" : v >= 0.5 ? "Moderate" : "Thin";
}
function meterColor(key: keyof EvidenceVector, v: number): string {
  if (key === "ambiguity") return v <= 0.35 ? "var(--amber-l)" : "var(--coral)";
  if (key === "scope") return "var(--ink-faint)";
  return v >= 0.8 ? "var(--teal)" : "var(--violet)";
}

export function Meters({ ev }: { ev: EvidenceVector }) {
  const mounted = useMounted();
  const keys: (keyof EvidenceVector)[] = ["strength", "robustness", "ambiguity", "scope"];
  return (
    <div className="meters">
      {keys.map((k) => {
        const v = ev[k];
        // display bar: ambiguity/scope are "less is better", so show the raw value
        return (
          <div className="meter" key={k}>
            <div className="m-top">
              <span className="m-name">{METER_LABELS[k]}</span>
              <span className="m-val">{meterWord(k, v)}</span>
            </div>
            <div className="m-track">
              <div className="m-fill" style={{ width: mounted ? `${Math.round(v * 100)}%` : "0%", background: meterColor(k, v) }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
