// Public API — dt-eval-lib

// Main eval function
export { evaluate } from "./engine/index.js";

// Scoring
export { computeScore, BINARY_SCALE, CONTINUOUS_SCALE, LIKERT_SCALE } from "./scoring/index.js";

// Prompt catalog
export { getPrompt, listPrompts } from "./prompts/index.js";

// Custom prompts
export { createCustomPrompt, deleteCustomPrompt, loadCustomPrompts } from "./custom/index.js";

// Types
export type {
  ScoringScaleType,
  ScoringScale,
  Score,
  PromptDefinition,
  Provider,
  EvalConfig,
  EvalInput,
  EvalResult,
  EvaluateFn,
  CreateCustomPromptInput,
  CustomPromptConfig,
} from "./types.js";

// Errors
export {
  DtEvalError,
  EvalConfigError,
  EvalMetricError,
  EvalInputError,
  EvalTimeoutError,
  EvalResponseError,
} from "./errors.js";
