import type { PromptDefinition } from "../prompts/types.js";
import type { EvalConfig, EvalInput, EvalResult } from "./types.js";
import type { LLMJudgeResponse } from "./providers/types.js";
import { getPrompt } from "../prompts/index.js";
import { computeScore } from "../scoring/index.js";
import { createProvider } from "./providers/index.js";
import {
  EvalConfigError,
  EvalInputError,
  EvalTimeoutError,
  EvalResponseError,
} from "../errors.js";

const FIELD_MAP: Record<string, keyof EvalInput> = {
  input: "input",
  output: "output",
  context: "context",
  expected_output: "expectedOutput",
};

/**
 * Main evaluation function.
 * Resolves the metric, validates input, renders the prompt,
 * calls the LLM provider, and computes the final score.
 */
export async function evaluate(
  metric: string | PromptDefinition,
  input: EvalInput,
  config: EvalConfig,
): Promise<EvalResult> {
  // 1. Resolve prompt
  const prompt = typeof metric === "string" ? await getPrompt(metric) : metric;

  // 2. Validate input — check required fields
  validateInput(input, prompt);

  // 3. Validate config — check API key before creating provider
  const apiKey = config.apiKey || process.env[getEnvKey(config.provider)];
  if (!apiKey) {
    throw new EvalConfigError(
      `Missing API key for ${config.provider}. Provide it via config.apiKey or set the ${getEnvKey(config.provider)} environment variable.`,
    );
  }

  // 4. Create provider
  const provider = createProvider(config);

  // 5. Build rendered prompt
  const renderedPrompt = renderPrompt(prompt.prompt, input);

  // 6. Call provider with retry logic
  const maxRetries = config.maxRetries ?? 2;
  const response = await callWithRetry(
    () => provider.call(renderedPrompt),
    maxRetries,
  );

  // 7. Validate and parse response
  const validResponse = validateResponse(response);

  // 8. Compute score
  const score = computeScore(
    validResponse.scoreValue,
    prompt.scoring,
    config.thresholdOverride,
  );

  // 9. Return result
  return {
    score,
    explanation: {
      summary: validResponse.summary,
      reasoning: validResponse.reasoning,
    },
  };
}

function validateInput(input: EvalInput, prompt: PromptDefinition): void {
  const missing: string[] = [];
  for (const field of prompt.requiredFields) {
    const inputKey = FIELD_MAP[field];
    if (!inputKey || !input[inputKey]) {
      missing.push(field);
    }
  }
  if (missing.length > 0) {
    throw new EvalInputError(
      `Missing required fields for metric "${prompt.id}": ${missing.join(", ")}`,
    );
  }
}

function renderPrompt(template: string, input: EvalInput): string {
  let rendered = template;
  rendered = rendered.replace(/\{\{input\}\}/g, input.input);
  rendered = rendered.replace(/\{\{output\}\}/g, input.output);
  if (input.context) {
    rendered = rendered.replace(/\{\{context\}\}/g, input.context);
  }
  if (input.expectedOutput) {
    rendered = rendered.replace(/\{\{expected_output\}\}/g, input.expectedOutput);
  }
  return rendered;
}

function validateResponse(response: any): LLMJudgeResponse {
  if (
    typeof response?.scoreValue !== "number" ||
    typeof response?.summary !== "string" ||
    typeof response?.reasoning !== "string"
  ) {
    throw new EvalResponseError(
      `Malformed LLM response: expected { scoreValue: number, summary: string, reasoning: string }, got ${JSON.stringify(response)}`,
    );
  }
  return response as LLMJudgeResponse;
}

function isTransientError(error: any): boolean {
  // HTTP 429 (rate limit) or 5xx (server error)
  if (typeof error?.status === "number") {
    return error.status === 429 || error.status >= 500;
  }
  // Network-level transient errors
  const transientCodes = ["ECONNRESET", "ECONNREFUSED", "EPIPE", "UND_ERR_CONNECT_TIMEOUT"];
  if (transientCodes.includes(error?.code)) return true;
  return false;
}

function isTimeoutError(error: any): boolean {
  return (
    error?.code === "ETIMEDOUT" ||
    error?.type === "request-timeout" ||
    error?.error?.type === "timeout"
  );
}

async function callWithRetry(
  fn: () => Promise<LLMJudgeResponse>,
  maxRetries: number,
): Promise<LLMJudgeResponse> {
  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Don't retry non-transient errors
      if (error instanceof EvalResponseError || error instanceof EvalConfigError) {
        throw error;
      }

      if (isTimeoutError(error)) {
        throw new EvalTimeoutError(
          `Request timed out: ${error.message}`,
        );
      }

      if (!isTransientError(error) || attempt === maxRetries) {
        // Exhausted retries or non-retryable
        if (attempt === maxRetries && isTransientError(error)) {
          throw error;
        }
        throw error;
      }

      // Exponential backoff: 100ms, 200ms, 400ms...
      const delay = 100 * Math.pow(2, attempt);
      await sleep(delay);
    }
  }

  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getEnvKey(provider: string): string {
  const keys: Record<string, string> = {
    openai: "OPENAI_API_KEY",
    anthropic: "ANTHROPIC_API_KEY",
  };
  return keys[provider] || `${provider.toUpperCase()}_API_KEY`;
}
