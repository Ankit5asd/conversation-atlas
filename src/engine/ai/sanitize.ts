// ── Guardrail enforcement on AI output ────────────────────────────────────────
// The prompt asks for good behavior; THIS enforces it. Anything that violates a
// hard block is dropped, not shown. The model is a debater; this is the bailiff.

import type { AiCritique, Observation, Tier } from "../types";

/** Personality typing, clinical labels, and fake precision — all discarded. */
const BANNED = [
  /\b(intj|entj|infp|enfp|istj|estp|infj|isfj|entp|intp|esfj|estj|isfp|istp|esfp|enfj)\b/i,
  /\b(adhd|autis\w*|bipolar|\bocd\b|narciss\w*|depress\w*|anxiety disorder|clinical\w*|neuroti\w*|psych\w*)\b/i,
  /\byou(?:'re| are)\s+(?:an?\s+)?(introvert|extrovert|night owl|early bird|perfectionist|procrastinator|genius|type)\b/i,
  /\b\d{1,3}\.\d\s*%/, // fake-precision confidence
];
function clean(text: string): boolean {
  return !BANNED.some((rx) => rx.test(text));
}

const CONF_MAP: Record<string, number> = { "a hunch": 2, "a real possibility": 3, "could go either way": 3 };
const VALID_TIERS: Tier[] = ["solid", "surprising", "context", "demoted", "theory"];

interface RawEnrichment {
  theories?: { question?: string; evidence?: string; confidence?: string }[];
  language?: { title?: string; description?: string }[];
  critiques?: { findingId?: string; note?: string; suggestedTier?: string }[];
}

/** Strip markdown fences and parse the first JSON object found. */
export function parseModelJson(raw: string): RawEnrichment {
  let s = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start >= 0 && end > start) s = s.slice(start, end + 1);
  return JSON.parse(s);
}

export interface Enrichment {
  observations: Observation[];
  critiques: AiCritique[];
}

export function sanitizeEnrichment(raw: string, existingIds: Set<string>, demotedIds: Set<string>): Enrichment {
  const parsed = parseModelJson(raw);
  const observations: Observation[] = [];

  // Theories → fenced category-8 findings (must end in a question).
  (parsed.theories ?? []).slice(0, 3).forEach((t, i) => {
    const q = (t.question ?? "").trim();
    const ev = (t.evidence ?? "").trim();
    if (!q || !ev) return;
    if (!clean(q) || !clean(ev)) return; // hard-block violation → drop
    const question = /\?$/.test(q) ? q : `${q}?`;
    observations.push({
      id: `AI_THEORY_${i + 1}`,
      category: 8,
      title: question,
      description: ev,
      tier: "theory",
      confidenceType: "interpretation",
      score: 0,
      survives: true,
      robustness: 0.5,
      fromAI: true,
      data: { confidence: t.confidence ?? "a hunch", dots: CONF_MAP[t.confidence ?? ""] ?? 2 },
    });
  });

  // Language interpretation → modest category-5 context (capped).
  (parsed.language ?? []).slice(0, 2).forEach((l, i) => {
    const title = (l.title ?? "").trim();
    const desc = (l.description ?? "").trim();
    if (!title || !desc) return;
    if (!clean(title) || !clean(desc)) return;
    observations.push({
      id: `AI_LANG_${i + 1}`,
      category: 5,
      title,
      description: desc,
      tier: "context",
      confidenceType: "language",
      score: 0,
      survives: true,
      fromAI: true,
    });
  });

  // Critiques → transparent notes on existing findings. A demoted finding can
  // never be promoted; drop any such suggestion but keep the note.
  const critiques: AiCritique[] = [];
  (parsed.critiques ?? []).forEach((c) => {
    const id = (c.findingId ?? "").trim();
    const note = (c.note ?? "").trim();
    if (!id || !note || !existingIds.has(id)) return;
    if (!clean(note)) return;
    let suggestedTier: Tier | undefined;
    if (c.suggestedTier && VALID_TIERS.includes(c.suggestedTier as Tier)) {
      suggestedTier = c.suggestedTier as Tier;
      // Forbidden: reviving a demotion into a claim.
      if (demotedIds.has(id) && suggestedTier !== "demoted") suggestedTier = undefined;
    }
    critiques.push({ findingId: id, note, suggestedTier });
  });

  return { observations, critiques };
}
