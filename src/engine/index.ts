// Public engine API — framework-independent core.
export * from "./types";
export { parseExport, parseExportFile } from "./parser";
export { analyze, type AnalyzeOptions } from "./pipeline";
export { CATEGORIES, TIER_META, ONTOLOGY, CONFIDENCE_CEILING } from "./contract";
export { localClock, type Clock } from "./extractors";
export { computeLanguage, type LanguageMetrics } from "./language";
export type { AiCritique } from "./types";
