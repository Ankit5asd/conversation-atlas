// ── The locked-contract prompt ────────────────────────────────────────────────
// The model operates INSIDE this fixed structure. It debates *what goes where*,
// never *whether the rules apply*. Output is validated by sanitize.ts afterward —
// the prompt asks for good behavior; the code enforces it.

import type { AtlasResult } from "../types";

export const SYSTEM_CONTRACT = `You are the interpretive layer of Conversation Atlas, a tool that shows a person how they think — measured from their own AI chat history. You work under a LOCKED CONTRACT. You are a debater in its courtroom, not a lawmaker.

THE ONE RULE: Evidence → Models → Questions. NEVER Evidence → Identity. You never say "you are X." You say "here is a pattern, here is what it might mean — you decide."

HARD BLOCKS (never produce these — they will be discarded):
- No personality typing (no MBTI, no "introvert/extrovert", no "night owl", no "perfectionist").
- No clinical or medical labels (no ADHD, autism, anxiety, depression, OCD, etc.) — ever, not even softened ("ADHD-style").
- No fake-precision numbers ("83.7% confident"). Confidence is a feeling word only.
- No claims beyond AI-visible behavior. You only see their chat titles + aggregate stats, never their life, relationships, or offline work.
- No analyzing third parties mentioned in their chats.

YOUR JOB, three outputs, all as STRICT JSON (no prose outside the JSON, no markdown fences):
1. "theories": 1–3 bold-but-fenced interpretations. Each is a guess over the real patterns, phrased as a QUESTION ending in "?", with the evidence that suggests it and a confidence FEELING. These live only in the speculative zone.
2. "language": 0–2 short interpretive notes about HOW they phrase things (hedging, agency framing), grounded in the language stats given. Describe behaviour; do not diagnose. Keep them modest.
3. "critiques": for any deterministic finding you want to push back on, a short note. You MAY suggest a different tier ("solid"→"context" if you think it's over-claimed, etc.). You may NEVER promote a "demoted" finding into a claim — demotions are the tool refusing to be wrong, and you respect them.

CONFIDENCE FEELINGS for theories: "a hunch" (weakest) | "a real possibility" | "could go either way".

Return ONLY this JSON shape:
{
  "theories": [ { "question": "…?", "evidence": "…", "confidence": "a hunch" } ],
  "language": [ { "title": "…", "description": "…" } ],
  "critiques": [ { "findingId": "DEPTH_GROWTH", "note": "…", "suggestedTier": "context" } ]
}
"language" and "critiques" may be empty arrays. "suggestedTier" is optional.`;

export function buildUserPrompt(result: AtlasResult): string {
  const findings = result.observations
    .filter((o) => o.category <= 7 && o.tier !== "demoted")
    .map((o) => `- ${o.id} [cat ${o.category}, ${o.tier}]: ${o.title}`)
    .join("\n");
  const demoted = result.observations
    .filter((o) => o.tier === "demoted")
    .map((o) => `- ${o.id}: ${o.title}`)
    .join("\n");
  const lang = result.digest.language;
  const hedging = Object.entries(lang.hedgingByYear).map(([y, v]) => `${y}: ${v}×`).join(", ");

  return `Here is the DETERMINISTIC analysis of this person's ${result.meta.total} AI conversations (${result.meta.years.join("–")}). It is already measured and true — your job is to interpret and pressure-test it, under the contract.

SURFACED FINDINGS (measured facts you may interpret or critique):
${findings}

ALREADY-DEMOTED (the tool refused these; you must NOT revive them as claims):
${demoted || "(none)"}

LANGUAGE STATS (aggregate word counts — the basis for your "language" notes):
- Hedging:certainty ratio by year — ${hedging}
- Self-directed "should/have-to": ${lang.should} vs "want/chose": ${lang.want}
- Question words — why: ${lang.why}, how: ${lang.how}, what: ${lang.what}

RECURRING / DEEPEST CONVERSATION TITLES (their own words — the only raw text you get):
${result.digest.sampleTitles.slice(0, 30).map((t) => `• ${t}`).join("\n")}

Now produce the JSON (theories, language, critiques). Fenced, honest, ending questions in "?". No identity claims.`;
}
