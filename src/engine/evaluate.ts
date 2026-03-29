import type { PromptDefinition, BuiltInMetric } from "../prompts/types";
import type { EvalConfig, EvalInput, EvalResult } from "./types";
import type { LLMJudgeResponse } from "./providers/types";
import { getPrompt } from "../prompts/index";
import { computeScore } from "../scoring/index";
import { createProvider } from "./providers/index";
import { validateLLMResponse } from "./providers/validate";
import {
  EvalConfigError,
  EvalInputError,
  EvalTimeoutError,
  EvalResponseError,
} from "../errors";

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
  metric: BuiltInMetric | PromptDefinition,
  input: EvalInput,
  config: EvalConfig,
): Promise<EvalResult> {
  const { provider: providerOptions, scoring } = config;

  const prompt = typeof metric === "string" ? getPrompt(metric) : metric;
  validateInput(input, prompt);

  const maxRetries = providerOptions.maxRetries ?? 2;
  if (maxRetries < 0 || !Number.isInteger(maxRetries)) {
    throw new EvalConfigError(
      `maxRetries must be a non-negative integer, got ${maxRetries}`,
    );
  }

  const provider = createProvider(providerOptions);
  const renderedPrompt = renderPrompt(prompt.prompt, input);

  const response = await callWithRetry(
    () => provider.call(renderedPrompt),
    maxRetries,
  );

  const validResponse = validateLLMResponse(response);

  const score = computeScore(
    validResponse.scoreValue,
    prompt.scoring,
    scoring?.thresholdOverride,
  );

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
    if (!inputKey || input[inputKey] == null) {
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
  rendered = rendered.replace(/\{\{input\}\}/g, () => input.input);
  rendered = rendered.replace(/\{\{output\}\}/g, () => input.output);
  if (input.context) {
    rendered = rendered.replace(/\{\{context\}\}/g, () => input.context!);
  }
  if (input.expectedOutput) {
    rendered = rendered.replace(/\{\{expected_output\}\}/g, () => input.expectedOutput!);
  }
  const unreplaced = rendered.match(/\{\{[\w_]+\}\}/g);
  if (unreplaced) {
    throw new EvalInputError(
      `Unreplaced placeholders in prompt: ${unreplaced.join(", ")}. Ensure all required fields are provided.`,
    );
  }
  return rendered;
}

function isTransientError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const err = error as Record<string, unknown>;
  const status = typeof err.status === "number" ? err.status : undefined;
  const code = typeof err.code === "string" ? err.code : undefined;
  // HTTP 429 (rate limit) or 5xx (server error)
  if (status !== undefined) {
    return status === 429 || status >= 500;
  }
  // Network-level transient errors
  const transientCodes = ["ECONNRESET", "ECONNREFUSED", "EPIPE", "UND_ERR_CONNECT_TIMEOUT"];
  if (code !== undefined && transientCodes.includes(code)) return true;
  return false;
}

function isTimeoutError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const err = error as Record<string, unknown>;
  const code = typeof err.code === "string" ? err.code : undefined;
  const type = typeof err.type === "string" ? err.type : undefined;
  const nestedError =
    typeof err.error === "object" && err.error !== null
      ? (err.error as Record<string, unknown>)
      : undefined;
  const nestedType =
    nestedError && typeof nestedError.type === "string"
      ? nestedError.type
      : undefined;
  return code === "ETIMEDOUT" || type === "request-timeout" || nestedType === "timeout";
}

async function callWithRetry(
  fn: () => Promise<LLMJudgeResponse>,
  maxRetries: number,
): Promise<LLMJudgeResponse> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      lastError = error;

      // Don't retry non-transient errors
      if (error instanceof EvalResponseError || error instanceof EvalConfigError) {
        throw error;
      }

      if (isTimeoutError(error)) {
        const message = error instanceof Error ? error.message : String(error);
        throw new EvalTimeoutError(
          `Request timed out: ${message}`,
        );
      }

      if (!isTransientError(error) || attempt === maxRetries) {
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
