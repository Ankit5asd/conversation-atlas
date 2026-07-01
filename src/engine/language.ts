// ── Category 5: language & cognitive fingerprint (deterministic part) ─────────
// Words are real; meaning is ambiguous — so these are LANGUAGE-tier (capped) and
// describe behaviour, they don't diagnose. The AI layer (Phase 2) interprets
// these numbers under the locked contract; it never invents them.

import type { Observation } from "./types";
import type { Ctx } from "./extractors";

const HEDGE = /\b(maybe|perhaps|probably|possibly|i think|i guess|might|not sure|kind of|sort of|i feel like|it seems)\b/g;
const CERTAIN = /\b(definitely|certainly|obviously|clearly|absolutely|for sure|no doubt|always|never|must be)\b/g;
const SHOULD = /\bi (should|have to|need to|must|ought to|got to|gotta)\b/g;
const WANT = /\bi (want|wanted|chose|choose|decided|love to|like to|prefer|wish)\b/g;

function count(text: string, rx: RegExp): number {
  return (text.match(rx) ?? []).length;
}

export interface LanguageMetrics {
  hedgingByYear: Record<number, number>; // hedge:certain ratio, per year
  should: number;
  want: number;
  why: number;
  how: number;
  what: number;
}

export function computeLanguage(ctx: Ctx): LanguageMetrics {
  const { years, byYear, convos } = ctx;
  const hedgingByYear: Record<number, number> = {};
  for (const y of years) {
    const text = byYear[y].map((c) => c.text).join(" ");
    const h = count(text, HEDGE);
    const c = count(text, CERTAIN);
    hedgingByYear[y] = c > 0 ? Math.round((h / c) * 10) / 10 : h > 0 ? h : 0;
  }
  const all = convos.map((c) => c.text).join(" ");
  return {
    hedgingByYear,
    should: count(all, SHOULD),
    want: count(all, WANT),
    why: (all.match(/\bwhy\b/g) ?? []).length,
    how: (all.match(/\bhow\b/g) ?? []).length,
    what: (all.match(/\bwhat\b/g) ?? []).length,
  };
}

export function extractLanguage(ctx: Ctx): Observation[] {
  const m = computeLanguage(ctx);
  const { years } = ctx;
  const obs: Observation[] = [];

  // 5a. Hedging trend — LANGUAGE tier (capped), measured plainly.
  const seq = years.map((y) => m.hedgingByYear[y]);
  const rising = seq.length >= 2 && seq[seq.length - 1] > seq[0] * 1.3;
  obs.push({
    id: "LANG_HEDGING",
    category: 5,
    title: rising ? "Your certainty softened as you went deeper" : "Your hedging vs certainty, by year",
    description: `Ratio of hedging words ("maybe", "I think", "probably") to certainty words${rising ? ` climbed over time — ${seq.map((v) => `${v}×`).join(" → ")}` : `: ${seq.map((v) => `${v}×`).join(", ")}`}. Measured plainly: this is how often you express tentativeness. What it *means* is a separate question — see Theories.`,
    tier: "context",
    confidenceType: "language",
    score: 0,
    survives: true,
    evidence: { strength: 0.7, robustness: 0.6, ambiguity: 0.75, scope: 0.35 },
    chart: {
      kind: "vbars",
      bars: years.map((y, i) => ({ label: String(y), value: m.hedgingByYear[y], display: `${m.hedgingByYear[y]}×`, color: i === years.length - 1 ? "var(--violet)" : "var(--violet-l)" })),
      caption: "Ratio of hedging words to certainty words, by year",
    },
    data: { hedgingByYear: m.hedgingByYear },
  });

  // 5b. Should vs want framing — LANGUAGE tier.
  if (m.should + m.want >= 10) {
    const ratio = m.want > 0 ? Math.round((m.should / m.want) * 10) / 10 : m.should;
    const mx = Math.max(m.should, m.want, 1);
    obs.push({
      id: "LANG_SHOULD_WANT",
      category: 5,
      title: `You frame tasks as "should" more than "want"`,
      description: `Counting self-directed phrases, your "I should / have to" outweighs "I want / chose" by about ${ratio}:1. It's a real ratio in how you narrate your own tasks — though "should" carries meanings a word-counter can't fully catch.`,
      tier: "context",
      confidenceType: "language",
      score: 0,
      survives: true,
      chart: {
        kind: "hbars",
        bars: [
          { label: `"I should / have to"`, value: m.should, max: mx, display: String(m.should), color: "var(--amber)" },
          { label: `"I want / chose"`, value: m.want, max: mx, display: String(m.want), color: "var(--teal)" },
        ],
        caption: `Self-directed phrasing across all conversations (≈ ${ratio}:1)`,
      },
      data: { should: m.should, want: m.want, ratio },
    });
  }

  // 5c. DEMOTE: don't over-read the should/want ratio into a character trait.
  obs.push({
    id: "LANG_AGENCY_DEMOTE",
    category: 5,
    title: `Why we won't say you "lack agency"`,
    description: `A 3:1 "should over want" is a real word-count — but reading it as "driven by duty, not choice" is a leap a word-counter can't justify. "Should" is often just how people phrase tasks to an assistant. We report the ratio and refuse the character verdict.`,
    tier: "demoted",
    confidenceType: "interpretation",
    score: 0,
    survives: false,
    demotedReason: "A phrasing ratio is not a personality trait — an over-read, not a finding.",
  });

  return obs;
}
