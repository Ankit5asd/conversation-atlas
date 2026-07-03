// ── Core domain types for the Conversation Atlas engine ──────────────────────
// Framework-independent. The React app and the test suite both consume this.

/** One parsed conversation, reduced to what the extractors need. */
export interface Conversation {
  id: string;
  title: string;
  createTime: number | null; // epoch seconds (UTC), as stored in exports
  year: number | null;
  userMessages: string[];
  /** turn count = number of user messages (one user turn per back-and-forth) */
  turns: number;
  /** lowercased join of all user messages, for keyword matching */
  text: string;
  source: "chatgpt" | "claude" | "unknown";
}

/** Confidence tiers — the visible trust label on every finding. */
export type Tier = "solid" | "surprising" | "context" | "demoted" | "theory";

/** Confidence *type* sets the ceiling; evidence sets the position inside it. */
export type ConfidenceType = "count" | "pattern" | "language" | "interpretation";

/** The evidence vector — attaches to the OBSERVATION, never the interpretation.
 *  Rendered as labeled bars (0..1), never stars, never a single fake number. */
export interface EvidenceVector {
  strength: number; // how much data supports it
  robustness: number; // survives removing a year/topic?
  ambiguity: number; // how many competing explanations fit (higher = worse)
  scope: number; // how much of life it covers (AI-only reads low = flagged narrow)
}

/** Chart specs let the UI stay a thin renderer over engine output. */
export type ChartSpec =
  | { kind: "vbars"; bars: { label: string; value: number; display: string; color: string; muted?: boolean }[]; caption: string; captionColor?: string }
  | { kind: "hbars"; bars: { label: string; value: number; max: number; display: string; color: string }[]; caption: string; captionColor?: string }
  | { kind: "mini"; items: { name: string; badge: string; badgeKind: string; vals: number[]; color: string }[]; caption: string };

/** A concrete conversation behind a finding — the "show me why" receipts. */
export interface ExampleConvo {
  title: string;
  date: string; // e.g. "May 2025"
  turns: number;
}

/** A single finding produced by the engine. */
export interface Observation {
  id: string;
  category: number; // 1..9
  title: string;
  description: string;
  tier: Tier;
  confidenceType: ConfidenceType;
  score: number; // ranking score (higher = surfaced first)
  survives: boolean; // passed robustness (false => tier becomes 'demoted')
  robustness?: number; // 0..1 survival fraction where applicable
  demotedReason?: string; // shown when tier === 'demoted' (a refusal, builds trust)
  evidence?: EvidenceVector;
  chart?: ChartSpec;
  /** raw numbers behind the finding, for "show me why" / debugging */
  data?: Record<string, unknown>;
  /** the actual conversations behind the finding — evidence exposed */
  examples?: ExampleConvo[];
  /** set by the optional AI re-read pass — shown transparently, not merged into
   *  the finding's own tier/claim. */
  aiNote?: string;
  aiSuggestedTier?: Tier;
  /** true for findings produced by the AI layer (cat 5 interpretation, cat 8). */
  fromAI?: boolean;
}

/** Full engine result handed to the UI. */
export interface AtlasResult {
  meta: {
    total: number;
    years: number[];
    perYear: Record<number, number>;
    activeMonths: number;
    dateRange: { start: string; end: string };
    parsedFrom: string; // "chatgpt" | "claude" | "mixed"
    droppedNoDate: number;
  };
  observations: Observation[]; // ranked, all tiers
  byCategory: Record<number, Observation[]>;
  /** Compact, privacy-conscious summary sent to the AI layer (aggregates +
   *  sampled titles — never full transcripts). */
  digest: {
    sampleTitles: string[];
    language: {
      hedgingByYear: Record<number, number>;
      should: number;
      want: number;
      why: number;
      how: number;
      what: number;
    };
  };
}

/** An AI-generated note attached to a deterministic finding (the "re-read"). */
export interface AiCritique {
  findingId: string;
  note: string;
  suggestedTier?: Tier; // shown transparently; never silently overwrites
}
