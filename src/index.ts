// Public API — dt-eval-lib

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
