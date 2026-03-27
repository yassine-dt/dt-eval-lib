import type { Score } from "../scoring/types.js";
import type { PromptDefinition } from "../prompts/types.js";

/** Provider selection */
export type Provider = "openai" | "anthropic";

/** Configuration for the eval engine */
export interface EvalConfig {
  provider: Provider;
  /** API key — falls back to OPENAI_API_KEY / ANTHROPIC_API_KEY env vars */
  apiKey?: string;
  /** Base URL for the provider API — falls back to OPENAI_BASE_URL / ANTHROPIC_BASE_URL env vars */
  baseUrl?: string;
  /** Model override — defaults to gpt-5.1 / claude-sonnet-4-20250514 */
  model?: string;
  /** Override the metric's default scoring threshold */
  thresholdOverride?: number;
  /** Request timeout in ms — default 30000 */
  timeout?: number;
  /** Max retries on transient errors — default 2 */
  maxRetries?: number;
}

/** Input to an evaluation */
export interface EvalInput {
  /** The input/question sent to the LLM */
  input: string;
  /** The LLM's output to evaluate */
  output: string;
  /** Optional context (e.g., retrieved documents for RAG) */
  context?: string;
  /** Optional expected/reference output */
  expectedOutput?: string;
}

/** Result of an evaluation */
export interface EvalResult {
  score: Score;
  explanation: {
    summary: string;
    reasoning: string;
  };
}

/** Main evaluation function signature */
export type EvaluateFn = (
  metric: string | PromptDefinition,
  input: EvalInput,
  config: EvalConfig,
) => Promise<EvalResult>;
