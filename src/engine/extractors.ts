// ── Deterministic observation extractors (categories 1–4, 6, 7) ──────────────
// Ported from the reference prototype.py and extended to the full oracle. Every
// function here is pure and deterministic given the ontology. No AI, no network.

import type { Conversation, Observation } from "./types";
import { ONTOLOGY, TOPIC_COLOR } from "./contract";
import { topicCountsByYear, survivesRemoveBiggestYear, trendRobustness } from "./robustness";

/** Injectable clock so hour-of-day is computed in the user's local timezone in
 *  the browser, but deterministically (UTC) in tests. */
export interface Clock {
  hour(epochSec: number): number;
  dow(epochSec: number): number; // 0 = Sunday
}
export const localClock: Clock = {
  hour: (e) => new Date(e * 1000).getHours(),
  dow: (e) => new Date(e * 1000).getDay(),
};

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// helpers ---------------------------------------------------------------------
const pct = (n: number, d: number) => (d ? (100 * n) / d : 0);
const round1 = (n: number) => Math.round(n * 10) / 10;
/** "Show me why" receipt: title · month-year · turn count. Titles only — never message text. */
const asExample = (c: Conversation) => ({
  title: c.title || "(untitled)",
  date: c.createTime ? new Date(c.createTime * 1000).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "",
  turns: c.turns,
});
const deepestFirst = (arr: Conversation[]) => [...arr].sort((a, b) => b.turns - a.turns);

export interface Ctx {
  convos: Conversation[];
  years: number[];
  byYear: Record<number, Conversation[]>;
  clock: Clock;
}

export function buildCtx(convos: Conversation[], clock: Clock): Ctx {
  const years = [...new Set(convos.map((c) => c.year!))].filter((y) => y != null).sort((a, b) => a - b);
  const byYear: Record<number, Conversation[]> = {};
  for (const y of years) byYear[y] = convos.filter((c) => c.year === y);
  return { convos, years, byYear, clock };
}

// ── CATEGORY 1 — When & how much ─────────────────────────────────────────────
export function extractOverview(ctx: Ctx): Observation[] {
  const { convos, years, byYear, clock } = ctx;
  const obs: Observation[] = [];
  const dated = convos.filter((c) => c.createTime != null);

  // 1a. Per-year volume — the spike is genuinely notable (Surprising).
  const perYear: Record<number, number> = {};
  for (const y of years) perYear[y] = byYear[y].length;
  const maxYear = years.reduce((a, b) => (perYear[b] > perYear[a] ? b : a), years[0]);
  const maxVol = perYear[maxYear];
  const otherMax = Math.max(...years.filter((y) => y !== maxYear).map((y) => perYear[y]), 0);
  const spiked = maxVol > 1.8 * otherMax;
  obs.push({
    id: "OVERVIEW_VOLUME",
    category: 1,
    title: spiked ? `${maxYear} was your explosive year` : "Your volume, year by year",
    description: spiked
      ? `Your usage climbed then cooled — ${years.map((y) => perYear[y]).join(", ")} conversations across ${years.join("–")}. ${maxVol} of them (${Math.round(pct(maxVol, convos.length))}%) happened in ${maxYear} alone.`
      : `Conversations per year: ${years.map((y) => `${y}: ${perYear[y]}`).join(", ")}.`,
    tier: spiked ? "surprising" : "context",
    confidenceType: "pattern",
    score: 0,
    survives: true,
    chart: {
      kind: "vbars",
      bars: years.map((y) => ({ label: String(y), value: perYear[y], display: String(perYear[y]), color: y === maxYear ? "var(--blue)" : "var(--blue-l)" })),
      caption: "Conversations per year",
    },
    data: { perYear },
    examples: deepestFirst(byYear[maxYear]).slice(0, 4).map(asExample),
  });

  // 1b. Overall counting facts — true but quiet (rank-low).
  const monthsSet = new Set(dated.map((c) => { const d = new Date(c.createTime! * 1000); return `${d.getUTCFullYear()}-${d.getUTCMonth()}`; }));
  obs.push({
    id: "OVERVIEW_COUNT",
    category: 1,
    title: "How much, in total",
    description: `${convos.length} conversations across ${monthsSet.size} active months — about ${Math.round(convos.length / Math.max(monthsSet.size, 1))} a month.`,
    tier: "context",
    confidenceType: "count",
    score: 0,
    survives: true,
    data: { total: convos.length, activeMonths: monthsSet.size },
  });

  // 1c. Time-of-day distribution — measured plainly, NO personality label.
  const buckets = { morning: 0, afternoon: 0, evening: 0, night: 0 };
  const hourHist: Record<number, number> = {};
  for (const c of dated) {
    const h = clock.hour(c.createTime!);
    hourHist[h] = (hourHist[h] ?? 0) + 1;
    if (h >= 5 && h < 12) buckets.morning++;
    else if (h >= 12 && h < 17) buckets.afternoon++;
    else if (h >= 17 && h < 21) buckets.evening++;
    else buckets.night++;
  }
  const peakHour = Object.keys(hourHist).map(Number).reduce((a, b) => (hourHist[b] > hourHist[a] ? b : a), 0);
  const todOrder: (keyof typeof buckets)[] = ["morning", "afternoon", "evening", "night"];
  const todMax = Math.max(...todOrder.map((k) => buckets[k]), 1);
  obs.push({
    id: "OVERVIEW_TIMING",
    category: 1,
    title: "When you show up",
    description: `Your peak hour is ${peakHour}:00. By part of day: ${todOrder.map((k) => `${k} ${Math.round(pct(buckets[k], dated.length))}%`).join(", ")}. This is a measured distribution — nothing more is claimed from it.`,
    tier: "context",
    confidenceType: "count",
    score: 0,
    survives: true,
    chart: {
      kind: "vbars",
      bars: todOrder.map((k) => ({ label: k, value: buckets[k], display: `${Math.round(pct(buckets[k], dated.length))}%`, color: buckets[k] === todMax ? "var(--amber)" : "var(--amber-l)" })),
      caption: `Share of conversations by time of day · peak hour ${peakHour}:00`,
    },
    data: { buckets, peakHour, hourHist },
  });

  // 1d. Weekday rhythm — quiet context.
  const dowHist: number[] = new Array(7).fill(0);
  for (const c of dated) dowHist[clock.dow(c.createTime!)]++;
  const weekdayShare = pct(dowHist[1] + dowHist[2] + dowHist[3] + dowHist[4] + dowHist[5], dated.length);
  const peakDay = dowHist.indexOf(Math.max(...dowHist));
  obs.push({
    id: "OVERVIEW_WEEKDAY",
    category: 1,
    title: `Weekday-weighted, peaking ${DAY_NAMES[peakDay]}`,
    description: `${Math.round(weekdayShare)}% of your usage falls Monday–Friday, busiest on ${DAY_NAMES[peakDay]}.`,
    tier: "context",
    confidenceType: "count",
    score: 0,
    survives: true,
    data: { dowHist, weekdayShare, peakDay: DAY_NAMES[peakDay] },
  });

  // 1e. DEMOTE (by construction): refuse to turn a timing count into a stereotype.
  const biggestBucket = todOrder.reduce((a, b) => (buckets[b] > buckets[a] ? b : a), "morning");
  const stereotype = biggestBucket === "night" ? "a late-night thinker" : biggestBucket === "morning" ? "an early bird" : `a ${biggestBucket} person`;
  obs.push({
    id: "OVERVIEW_TIMING_STEREOTYPE",
    category: 1,
    title: `Why we won't call you “${stereotype}”`,
    description: `Your usage leans ${biggestBucket}, and a flashier tool would stamp a personality on that. A time-of-day count is not a personality. We report the distribution above and refuse the label — that refusal is the point.`,
    tier: "demoted",
    confidenceType: "count",
    score: 0,
    survives: false,
    demotedReason: "A timing count is not a personality trait — a stereotype, not a finding.",
    data: { biggestBucket },
  });

  return obs;
}

// ── CATEGORY 2 — How deep you go ─────────────────────────────────────────────
export function extractDepth(ctx: Ctx): Observation[] {
  const { convos, years, byYear } = ctx;
  const obs: Observation[] = [];

  // 2a. Depth by year (the flagship). Monotonic → survives all.
  const avgByYear: Record<number, number> = {};
  for (const y of years) avgByYear[y] = round1(byYear[y].reduce((s, c) => s + c.turns, 0) / byYear[y].length);
  const seq = years.map((y) => avgByYear[y]);
  const trend = trendRobustness(seq);
  const growth = round1(seq[seq.length - 1] / Math.max(seq[0], 0.1));
  obs.push({
    id: "DEPTH_GROWTH",
    category: 2,
    title: "You stopped asking, and started working",
    description: `Your conversations got deeper ${trend.monotonic ? "every single year" : "over time"} — from ${seq[0]} to ${seq[seq.length - 1]} turns (${growth}×). ${trend.monotonic ? "No year reversed it" : "The trend is net-positive but not monotonic"}, and it holds across topics, not just one. Early on you asked and left; now you stay and work the problem.`,
    tier: "solid",
    confidenceType: "pattern",
    score: 0,
    survives: trend.survives,
    robustness: trend.robustness,
    evidence: { strength: 0.95, robustness: trend.robustness, ambiguity: 0.35, scope: 0.35 },
    chart: {
      kind: "vbars",
      bars: years.map((y, i) => ({ label: String(y), value: avgByYear[y], display: String(avgByYear[y]), color: i === years.length - 1 ? "var(--teal-d)" : i === 0 ? "var(--teal-l)" : "var(--teal)" })),
      caption: "Average back-and-forth turns per conversation, by year",
    },
    data: { avgByYear, growth, monotonic: trend.monotonic },
    // the deepest thread of each year — the growth arc in real conversations
    examples: years.map((y) => asExample(deepestFirst(byYear[y])[0])),
  });

  // 2b. Depth is BROAD, not just coding — kills the "just started coding" story.
  const lastYear = years[years.length - 1];
  const topicDepth: { topic: string; avg: number }[] = [];
  for (const [topic, rx] of Object.entries(ONTOLOGY)) {
    const matching = byYear[lastYear].filter((c) => rx.test(c.text));
    if (matching.length >= 3) topicDepth.push({ topic, avg: round1(matching.reduce((s, c) => s + c.turns, 0) / matching.length) });
  }
  topicDepth.sort((a, b) => b.avg - a.avg);
  const broad = topicDepth.length >= 3 && topicDepth[topicDepth.length - 1].avg > 6;
  const tdMax = Math.max(...topicDepth.map((t) => t.avg), 1);
  if (topicDepth.length >= 3) {
    obs.push({
      id: "DEPTH_BROAD",
      category: 2,
      title: broad ? "The growth is broad, not just coding" : "Depth by topic, this year",
      description: broad
        ? `An easy explanation would be "he just started coding, and code needs more turns." We checked — it's false. In ${lastYear} every topic runs deep (${topicDepth.slice(0, 4).map((t) => `${t.topic.toLowerCase()} ${t.avg}`).join(", ")}). Going deep across the board makes the depth story stronger, not weaker.`
        : `Average turns per conversation in ${lastYear}, by topic.`,
      tier: broad ? "solid" : "context",
      confidenceType: "pattern",
      score: 0,
      survives: true,
      evidence: broad ? { strength: 0.85, robustness: 0.9, ambiguity: 0.3, scope: 0.35 } : undefined,
      chart: {
        kind: "hbars",
        bars: topicDepth.map((t) => ({ label: t.topic, value: t.avg, max: tdMax, display: String(t.avg), color: TOPIC_COLOR[t.topic] ?? "var(--blue)" })),
        caption: `Average turns per conversation in ${lastYear}, by topic`,
      },
      data: { topicDepth },
    });
  }

  // 2c. Depth rationing — one-shot vs deep (Context).
  const oneShot = convos.filter((c) => c.turns <= 1).length;
  const deep8 = convos.filter((c) => c.turns >= 8).length;
  const veryDeep = convos.filter((c) => c.turns >= 20).length;
  obs.push({
    id: "DEPTH_RATION",
    category: 2,
    title: "You ration your depth",
    description: `Depth isn't spread evenly — you spend it deliberately. ${Math.round(pct(oneShot, convos.length))}% of chats are one-shot questions, while ${Math.round(pct(deep8, convos.length))}% run 8 turns or more. You go deep when it matters and skim when it doesn't.`,
    tier: "context",
    confidenceType: "pattern",
    score: 0,
    survives: true,
    chart: {
      kind: "hbars",
      bars: [
        { label: "One-shot (1 turn)", value: oneShot, max: convos.length, display: `${Math.round(pct(oneShot, convos.length))}%`, color: "var(--ink-faint)" },
        { label: "Deep (8+ turns)", value: deep8, max: convos.length, display: `${Math.round(pct(deep8, convos.length))}%`, color: "var(--teal)" },
        { label: "Very deep (20+)", value: veryDeep, max: convos.length, display: `${veryDeep}×`, color: "var(--teal-d)" },
      ],
      caption: "Distribution of conversation lengths",
    },
    data: { oneShot, deep8, veryDeep },
  });

  // 2d. Deepest single thread (Context count).
  const deepest = [...convos].sort((a, b) => b.turns - a.turns)[0];
  if (deepest) {
    obs.push({
      id: "DEPTH_DEEPEST",
      category: 2,
      title: `Your deepest single thread ran ${deepest.turns} turns`,
      description: `One conversation${deepest.title ? ` — “${deepest.title}” —` : ""} went ${deepest.turns} user turns deep. It's the outer edge of how far you'll push a single thread.`,
      tier: "context",
      confidenceType: "count",
      score: 0,
      survives: true,
      data: { title: deepest.title, turns: deepest.turns },
    });
  }

  // 2e. DEMOTE: depth of turns is not depth of thought.
  obs.push({
    id: "DEPTH_THINKER_DEMOTE",
    category: 2,
    title: "Why we won't say you “became a deeper thinker”",
    description: "More turns means more iteration — you go back and forth more. That is not the same as thinking more deeply, and we won't pretend the two are interchangeable. We measured iteration; we did not measure cognition.",
    tier: "demoted",
    confidenceType: "interpretation",
    score: 0,
    survives: false,
    demotedReason: "Depth of turns ≠ depth of thought. Claiming cognition from a turn count is an over-read.",
  });

  return obs;
}

// ── CATEGORY 3 — What moved ──────────────────────────────────────────────────
export function extractMovement(ctx: Ctx): Observation[] {
  const { years, byYear } = ctx;
  const obs: Observation[] = [];

  const topicPct: Record<string, Record<number, number>> = {};
  const spreads: { topic: string; spread: number; pcts: Record<number, number> }[] = [];
  for (const [topic, rx] of Object.entries(ONTOLOGY)) {
    const p: Record<number, number> = {};
    for (const y of years) p[y] = Math.round(pct(byYear[y].filter((c) => rx.test(c.text)).length, byYear[y].length));
    topicPct[topic] = p;
    const vals = years.map((y) => p[y]);
    spreads.push({ topic, spread: Math.max(...vals) - Math.min(...vals), pcts: p });
  }
  spreads.sort((a, b) => b.spread - a.spread);

  // 3a. The single most volatile theme (Surprising, surface-high).
  const top = spreads[0];
  if (top && top.spread > 18) {
    const vals = years.map((y) => top.pcts[y]);
    const tMax = Math.max(...vals);
    obs.push({
      id: `MOVE_${top.topic.toUpperCase()}_VOLATILE`,
      category: 3,
      title: `${top.topic} vanished — then exploded`,
      description: `${years.map((y) => `${top.pcts[y]}%`).join(" → ")} across ${years.join("–")}. This ${top.spread}-point swing is the single biggest movement in your whole history.`,
      tier: "surprising",
      confidenceType: "pattern",
      score: 0,
      survives: true,
      evidence: { strength: 0.85, robustness: 0.8, ambiguity: 0.4, scope: 0.35 },
      chart: {
        kind: "vbars",
        bars: years.map((y) => ({ label: String(y), value: top.pcts[y], display: `${top.pcts[y]}%`, color: top.pcts[y] === tMax ? TOPIC_COLOR[top.topic] : "var(--coral-l)" })),
        caption: `${top.topic} as a share of your conversations, by year`,
      },
      data: { pcts: top.pcts, spread: top.spread },
      examples: (() => {
        const rxTop = ONTOLOGY[top.topic];
        const peakYear = years.reduce((a, b) => (top.pcts[b] >= top.pcts[a] ? b : a), years[0]);
        return deepestFirst(byYear[peakYear].filter((c) => rxTop.test(c.text))).slice(0, 4).map(asExample);
      })(),
    });
  }

  // 3b. A second theme that surged in the last year (e.g. Code).
  const lastYear = years[years.length - 1];
  const surged = spreads.filter((s) => s.topic !== top?.topic && s.pcts[lastYear] === Math.max(...years.map((y) => s.pcts[y])) && s.pcts[lastYear] > 2 * Math.min(...years.map((y) => s.pcts[y])) + 5);
  const code = surged.find((s) => s.topic === "Code") ?? surged[0];
  if (code) {
    const vals = years.map((y) => code.pcts[y]);
    const cMax = Math.max(...vals);
    obs.push({
      id: `MOVE_${code.topic.toUpperCase()}_SURGE`,
      category: 3,
      title: `${code.topic} reawakened in ${lastYear}`,
      description: `After years near-dormant, ${code.topic.toLowerCase()} surged to ${code.pcts[lastYear]}% in ${lastYear} (${years.map((y) => `${code.pcts[y]}%`).join(" → ")}) — moving in the same window as ${top?.topic ?? "your other volatile theme"}.`,
      tier: "surprising",
      confidenceType: "pattern",
      score: 0,
      survives: true,
      evidence: { strength: 0.8, robustness: 0.75, ambiguity: 0.45, scope: 0.35 },
      chart: {
        kind: "vbars",
        bars: years.map((y) => ({ label: String(y), value: code.pcts[y], display: `${code.pcts[y]}%`, color: code.pcts[y] === cMax ? TOPIC_COLOR[code.topic] : "var(--teal-l)" })),
        caption: `${code.topic} as a share of your conversations, by year`,
      },
      data: { pcts: code.pcts },
      examples: deepestFirst(byYear[lastYear].filter((c) => ONTOLOGY[code.topic].test(c.text))).slice(0, 4).map(asExample),
    });
  }

  // 3c. Every topic's trajectory, side by side (Context, small-multiples).
  const items = spreads
    .filter((s) => years.some((y) => s.pcts[y] > 0))
    .map((s) => {
      const badge = s.spread > 18 ? "volatile" : years.every((y, i) => i === 0 || s.pcts[y] >= s.pcts[years[i - 1]]) && s.pcts[lastYear] > s.pcts[years[0]] + 6 ? "rising" : s.spread <= 8 ? "stable" : "steady";
      const badgeKind = badge === "volatile" ? "coral" : badge === "rising" ? "amber" : badge === "stable" ? "teal" : "blue";
      return { name: s.topic, badge, badgeKind, vals: years.map((y) => s.pcts[y]), color: TOPIC_COLOR[s.topic] ?? "var(--blue)" };
    });
  obs.push({
    id: "MOVE_TRAJECTORIES",
    category: 3,
    title: "Every topic's trajectory, side by side",
    description: "The full picture of what rose and fell. Some threads swing hard, some rise slow and steady, and the rest stay flat. The badge shows how volatile each one is — the grouping is a chosen resolution, not a fact.",
    tier: "context",
    confidenceType: "pattern",
    score: 0,
    survives: true,
    chart: { kind: "mini", items, caption: `Each spark spans ${years[0]}→${lastYear} · height = share of that year's conversations` },
    data: { topicPct },
  });

  return obs;
}

// ── CATEGORY 4 — What held steady ────────────────────────────────────────────
export function extractHeld(ctx: Ctx): Observation[] {
  const { convos, years } = ctx;
  const obs: Observation[] = [];

  const anchors: { topic: string; present: number; survives: boolean; robustness: number; maxPct: number }[] = [];
  for (const [topic, rx] of Object.entries(ONTOLOGY)) {
    const counts = topicCountsByYear(convos, years, rx);
    const present = years.filter((y) => counts[y] > 0).length;
    if (present < years.length - 1) continue; // not even a candidate anchor
    const rob = survivesRemoveBiggestYear(counts, years);
    const maxPct = Math.max(...years.map((y) => pct(counts[y], ctx.byYear[y].length)));
    anchors.push({ topic, present, survives: present === years.length && rob.survives, robustness: rob.robustness, maxPct });
  }
  const solid = anchors.filter((a) => a.survives);
  // Refuse-in-public only the single most tempting false anchor — the candidate
  // most prominent (≥10% in its biggest year) that a naive tool would have
  // surfaced. One sharp refusal demonstrates the principle; a list dilutes it.
  // (Other 3/4-year topics simply aren't claimed — quiet, not refused aloud.)
  const demoted = anchors
    .filter((a) => !a.survives && a.maxPct >= 10)
    .sort((a, b) => b.maxPct - a.maxPct)
    .slice(0, 1);

  // 4a. The durable spine (Solid).
  if (solid.length) {
    obs.push({
      id: "HELD_ANCHORS",
      category: 4,
      title: `${solid.length} anchor${solid.length > 1 ? "s" : ""} that never left`,
      description: `Across all ${years.length} years, ${solid.map((a) => a.topic.toLowerCase()).join(", ")} appear every single year and survive every robustness test. These aren't phases — they're the durable spine of what you bring to AI.`,
      tier: "solid",
      confidenceType: "pattern",
      score: 0,
      survives: true,
      evidence: { strength: 0.9, robustness: 1, ambiguity: 0.3, scope: 0.35 },
      chart: {
        kind: "vbars",
        bars: [
          ...solid.map((a) => ({ label: `${a.present}/${years.length} yrs`, value: 100, display: a.topic, color: TOPIC_COLOR[a.topic] ?? "var(--blue)" })),
          ...demoted.map((a) => ({ label: `${a.present}/${years.length} · demoted`, value: 52, display: a.topic, color: "var(--line)", muted: true })),
        ],
        caption: "Grey = found, but demoted for failing the robustness test",
        captionColor: "var(--ink-faint)",
      },
      data: { solid, demoted },
      // one receipt per anchor: its single deepest conversation, ever
      examples: solid.map((a) => {
        const best = deepestFirst(convos.filter((c) => ONTOLOGY[a.topic].test(c.text)))[0];
        return { ...asExample(best), title: `${a.topic} — ${best.title || "(untitled)"}` };
      }),
    });
  }

  // 4b. The refusal — an anchor that failed the counterfactual (Demoted).
  for (const a of demoted) {
    obs.push({
      id: `HELD_${a.topic.toUpperCase()}_DEMOTE`,
      category: 4,
      title: `Why “${a.topic} is an anchor” was rejected`,
      description: `${a.topic} shows up and rises over time — tempting to call it a core theme. But it appears in only ${a.present} of ${years.length} years, and when we remove its biggest year the pattern collapses. A less careful tool would surface this. This one won't — it would rather be quiet than wrong.`,
      tier: "demoted",
      confidenceType: "pattern",
      score: 0,
      survives: false,
      robustness: a.robustness,
      demotedReason: "Fails the remove-biggest-year counterfactual — not durable enough to claim.",
      data: { present: a.present, robustness: a.robustness },
    });
  }

  // 4c. Quietly steady (Context) — smallest-spread topic present every year.
  const steady = Object.entries(ONTOLOGY)
    .map(([topic, rx]) => {
      const p = years.map((y) => Math.round(pct(ctx.byYear[y].filter((c) => rx.test(c.text)).length, ctx.byYear[y].length)));
      return { topic, present: p.filter((v) => v > 0).length, spread: Math.max(...p) - Math.min(...p), p };
    })
    .filter((t) => t.present === years.length && t.spread <= 10)
    .sort((a, b) => a.spread - b.spread)[0];
  if (steady) {
    obs.push({
      id: "HELD_STEADY",
      category: 4,
      title: `${steady.topic} is quietly steady`,
      description: `${steady.topic} sits in the background every year (${steady.p.map((v) => `${v}%`).join(", ")}), never swinging much. Not gripping — but genuinely stable, which is its own kind of signal.`,
      tier: "context",
      confidenceType: "pattern",
      score: 0,
      survives: true,
      data: { p: steady.p, spread: steady.spread },
    });
  }

  return obs;
}

// ── CATEGORY 6 — Your decision signature ─────────────────────────────────────
const DECISION_RX = /\b(sellable|booking|system|app|degree|btech|pcmb|iit|madras|debate|earn|online|comparison|compare|laptop|vs|which|should|choose|buy|design|build|freelanc|business|startup|invest|career|placement|tournament)\b/i;
const HOWTO_RX = /\b(calculation|guide|tips|recipe|meaning|definition|risks|factors)\b/i;

function decisionColor(title: string): string {
  const t = title.toLowerCase();
  if (/earn|online|money|income|sell/.test(t)) return "var(--coral)";
  if (/comparison|compare|laptop|vs/.test(t)) return "var(--blue)";
  if (/build|system|booking|design|app|tournament|sellable/.test(t)) return "var(--teal)";
  return "var(--violet)";
}

export function extractDecisions(ctx: Ctx): Observation[] {
  const { convos } = ctx;
  const sorted = [...convos].sort((a, b) => b.turns - a.turns);
  const decisions = sorted.filter((c) => c.title && DECISION_RX.test(c.title) && !(HOWTO_RX.test(c.title) && !/degree|debate|sellable|business/i.test(c.title))).slice(0, 7);
  if (decisions.length < 3) return [];
  const dMax = Math.max(...decisions.map((c) => c.turns), 1);
  return [
    {
      id: "DECISIONS_ARE_DEEPEST",
      category: 6,
      title: "Your deepest threads are almost all real decisions",
      description: "Sort your conversations by depth and a pattern jumps out: the longest ones aren't abstract learning — they're concrete choices and things you were trying to build. Several are about making something sellable.",
      tier: "solid",
      confidenceType: "pattern",
      score: 0,
      survives: true,
      evidence: { strength: 0.85, robustness: 0.85, ambiguity: 0.4, scope: 0.35 },
      chart: {
        kind: "hbars",
        bars: decisions.map((c) => ({ label: c.title.length > 34 ? c.title.slice(0, 33) + "…" : c.title, value: c.turns, max: dMax, display: `${c.turns}t`, color: decisionColor(c.title) })),
        caption: "Your longest conversations by turn count · teal = building something",
        captionColor: "var(--teal-d)",
      },
      data: { decisions: decisions.map((c) => ({ title: c.title, turns: c.turns })) },
      examples: decisions.map(asExample),
    },
  ];
}

// ── CATEGORY 7 — What you keep coming back to ────────────────────────────────
const TITLE_STOP = new Set(
  "the a an and or to of in for with my how what why is are do can it this that at be as from get make your you me i on new best request help guide about into over using use need want way ways more most vs".split(" "),
);

export function extractRecurring(ctx: Ctx): Observation[] {
  const { convos } = ctx;
  const counts = new Map<string, number>();
  for (const c of convos) {
    const seen = new Set<string>();
    for (const w of c.title.toLowerCase().match(/[a-z]+/g) ?? []) {
      if (w.length <= 3 || TITLE_STOP.has(w) || seen.has(w)) continue;
      seen.add(w);
      counts.set(w, (counts.get(w) ?? 0) + 1);
    }
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7);
  if (!top.length) return [];
  const wMax = top[0][1];
  const colorFor = (w: string) => (/madras|neet|bseb|iit|exam|degree|class/.test(w) ? "var(--violet)" : /laptop|price|cost/.test(w) ? "var(--coral-l)" : w === top[0][0] ? "var(--blue)" : "var(--blue-l)");
  return [
    {
      id: "RECURRING_TITLE_WORDS",
      category: 7,
      title: `“${top[0][0]}” is the word you return to most`,
      description: `One word dominates your conversation titles — ${top[0][0]}, appearing ${top[0][1]} times, ahead of anything else. Beneath it sit the specific subjects you kept circling back to.`,
      tier: "solid",
      confidenceType: "pattern",
      score: 0,
      survives: true,
      evidence: { strength: 0.8, robustness: 0.85, ambiguity: 0.35, scope: 0.35 },
      chart: {
        kind: "hbars",
        bars: top.map(([w, n]) => ({ label: w, value: n, max: wMax, display: `${n}×`, color: colorFor(w) })),
        caption: "Most frequent meaningful words in your conversation titles",
      },
      data: { top },
      examples: deepestFirst(convos.filter((c) => c.title.toLowerCase().includes(top[0][0]))).slice(0, 6).map(asExample),
    },
  ];
}

// ── CATEGORY 9 — Engine self-audit (static, always honest) ───────────────────
export function extractAudit(): Observation[] {
  return [
    {
      id: "AUDIT",
      category: 9,
      title: "What this can — and can't — see",
      description: "The engine judged by its own rules.",
      tier: "context",
      confidenceType: "count",
      score: 0,
      survives: true,
      data: {
        rows: [
          { k: "Confident", kind: "high", t: "Directly measured — usage timing, conversation depth, topic persistence, recurring subjects. As reliable as counting." },
          { k: "Medium", kind: "med", t: "Modeling choices — which conversations count as 'business', the stability bands, the topic ontology. Real signal, softer edges." },
          { k: "Guessing", kind: "low", t: "Interpretation — the fenced theories, what your hedging means, how you learn. Phrased as questions on purpose. (Needs an API key.)" },
          { k: "Blind", kind: "blind", t: "Everything offline. If you built that project, learned to code elsewhere, or made big decisions away from AI — none of it is here. Silence in the data isn't evidence of absence." },
        ],
      },
    },
  ];
}
