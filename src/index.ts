// Public API — dt-eval-lib

// Main eval function
export { evaluate } from "./engine/index";

// Scoring
export { computeScore, BINARY_SCALE, CONTINUOUS_SCALE, LIKERT_SCALE } from "./scoring/index";

// Prompt catalog
export { getPrompt, listPrompts, BuiltInMetric } from "./prompts/index";

// Types
export type {
  ScoringScaleType,
  ScoringScale,
  Score,
} from "./scoring/types";

export type { PromptDefinition } from "./prompts/types";

export type {
  Provider,
  ProviderOptions,
  ScoringOptions,
  EvalConfig,
  EvalInput,
  EvalResult,
} from "./engine/types";

// Errors
export {
  DtEvalError,
  EvalConfigError,
  EvalMetricError,
  EvalInputError,
  EvalTimeoutError,
  EvalResponseError,
} from "./errors";
