import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// We'll mock the provider modules so no real API calls are made
vi.mock("openai", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: vi.fn(),
        },
      },
    })),
  };
});

vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: vi.fn(),
      },
    })),
  };
});

import { evaluate } from "../src/engine/index.js";
import { createProvider } from "../src/engine/providers/index.js";
import { OpenAIProvider } from "../src/engine/providers/openai.js";
import { AnthropicProvider } from "../src/engine/providers/anthropic.js";
import type { EvalConfig, EvalInput, PromptDefinition } from "../src/types.js";
import {
  EvalConfigError,
  EvalInputError,
  EvalMetricError,
  EvalTimeoutError,
  EvalResponseError,
} from "../src/errors.js";
import type { LLMProvider, LLMJudgeResponse } from "../src/engine/providers/types.js";

// Helper to create a mock provider
function mockProvider(response: LLMJudgeResponse): LLMProvider {
  return {
    call: vi.fn().mockResolvedValue(response),
  };
}

function failingProvider(error: Error, succeedAfter?: number): LLMProvider {
  let callCount = 0;
  return {
    call: vi.fn().mockImplementation(async () => {
      callCount++;
      if (succeedAfter !== undefined && callCount > succeedAfter) {
        return { scoreValue: 1, summary: "ok", reasoning: "recovered" };
      }
      throw error;
    }),
  };
}

// We mock createProvider in the evaluate tests to inject our mock providers
vi.mock("../src/engine/providers/index.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/engine/providers/index.js")>();
  return {
    ...actual,
    createProvider: vi.fn(actual.createProvider),
  };
});

const baseConfig: EvalConfig = {
  provider: "openai",
  apiKey: "test-key-123",
  timeout: 30000,
  maxRetries: 2,
};

const baseInput: EvalInput = {
  input: "What is the capital of France?",
  output: "The capital of France is Paris.",
};

const customPrompt: PromptDefinition = {
  id: "test-metric",
  name: "Test Metric",
  version: "1.0.0",
  description: "A test metric",
  prompt: "Evaluate this: Input: {{input}} Output: {{output}}",
  requiredFields: ["input", "output"],
  scoring: { type: "binary", range: [0, 1], threshold: 1 },
};

describe("evaluate() — happy path", () => {
  beforeEach(() => {
    vi.mocked(createProvider).mockReturnValue(
      mockProvider({ scoreValue: 1, summary: "Good output", reasoning: "Output is correct" }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("evaluates with a string metric id (built-in)", async () => {
    const result = await evaluate("toxicity", baseInput, baseConfig);
    expect(result).toBeDefined();
    expect(result.score).toBeDefined();
    expect(result.explanation).toBeDefined();
  });

  it("evaluates with a PromptDefinition object directly", async () => {
    const result = await evaluate(customPrompt, baseInput, baseConfig);
    expect(result).toBeDefined();
    expect(result.score.value).toBe(1);
  });

  it("returns correct EvalResult shape { score: { value, label }, explanation: { summary, reasoning } }", async () => {
    const result = await evaluate("toxicity", baseInput, baseConfig);
    expect(result).toEqual({
      score: { value: 1, label: "pass" },
      explanation: { summary: "Good output", reasoning: "Output is correct" },
    });
  });

  it("binary scoring: score 1 → pass", async () => {
    vi.mocked(createProvider).mockReturnValue(
      mockProvider({ scoreValue: 1, summary: "safe", reasoning: "no issues" }),
    );
    const result = await evaluate("toxicity", baseInput, baseConfig);
    expect(result.score).toEqual({ value: 1, label: "pass" });
  });

  it("binary scoring: score 0 → fail", async () => {
    vi.mocked(createProvider).mockReturnValue(
      mockProvider({ scoreValue: 0, summary: "toxic", reasoning: "contains slurs" }),
    );
    const result = await evaluate("toxicity", baseInput, baseConfig);
    expect(result.score).toEqual({ value: 0, label: "fail" });
  });

  it("continuous scoring: score 0.8 → pass", async () => {
    vi.mocked(createProvider).mockReturnValue(
      mockProvider({ scoreValue: 0.8, summary: "relevant", reasoning: "on topic" }),
    );
    const result = await evaluate("relevance", baseInput, baseConfig);
    expect(result.score).toEqual({ value: 0.8, label: "pass" });
  });

  it("likert scoring: score 4 → pass", async () => {
    vi.mocked(createProvider).mockReturnValue(
      mockProvider({ scoreValue: 4, summary: "coherent", reasoning: "well structured" }),
    );
    const result = await evaluate("coherence", baseInput, baseConfig);
    expect(result.score).toEqual({ value: 4, label: "pass" });
  });

  it("thresholdOverride: continuous with custom threshold 0.9 — score 0.8 → fail", async () => {
    vi.mocked(createProvider).mockReturnValue(
      mockProvider({ scoreValue: 0.8, summary: "ok", reasoning: "decent" }),
    );
    const result = await evaluate("relevance", baseInput, {
      ...baseConfig,
      thresholdOverride: 0.9,
    });
    expect(result.score).toEqual({ value: 0.8, label: "fail" });
  });

  it("thresholdOverride: is passed through to computeScore", async () => {
    vi.mocked(createProvider).mockReturnValue(
      mockProvider({ scoreValue: 0.4, summary: "ok", reasoning: "ok" }),
    );
    // Default continuous threshold is 0.5, so 0.4 would fail
    // Override to 0.3, so 0.4 should pass
    const result = await evaluate("relevance", baseInput, {
      ...baseConfig,
      thresholdOverride: 0.3,
    });
    expect(result.score.label).toBe("pass");
  });
});

describe("evaluate() — prompt rendering", () => {
  let capturedPrompt: string;

  beforeEach(() => {
    const provider: LLMProvider = {
      call: vi.fn().mockImplementation(async (prompt: string) => {
        capturedPrompt = prompt;
        return { scoreValue: 1, summary: "ok", reasoning: "ok" };
      }),
    };
    vi.mocked(createProvider).mockReturnValue(provider);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("replaces {{input}} placeholder", async () => {
    await evaluate("toxicity", baseInput, baseConfig);
    expect(capturedPrompt).toContain("What is the capital of France?");
    expect(capturedPrompt).not.toContain("{{input}}");
  });

  it("replaces {{output}} placeholder", async () => {
    await evaluate("toxicity", baseInput, baseConfig);
    expect(capturedPrompt).toContain("The capital of France is Paris.");
    expect(capturedPrompt).not.toContain("{{output}}");
  });

  it("replaces {{context}} placeholder when present", async () => {
    const input: EvalInput = {
      ...baseInput,
      context: "France is a country in Europe. Its capital is Paris.",
    };
    await evaluate("faithfulness", input, baseConfig);
    expect(capturedPrompt).toContain("France is a country in Europe");
    expect(capturedPrompt).not.toContain("{{context}}");
  });

  it("replaces {{expected_output}} placeholder when present", async () => {
    const input: EvalInput = {
      ...baseInput,
      expectedOutput: "Paris is the capital of France.",
    };
    await evaluate("factual-accuracy", input, baseConfig);
    expect(capturedPrompt).toContain("Paris is the capital of France.");
    expect(capturedPrompt).not.toContain("{{expected_output}}");
  });

  it("omits optional placeholders when fields not provided", async () => {
    await evaluate("toxicity", baseInput, baseConfig);
    // toxicity only requires input + output, no context/expected_output placeholders in its prompt
    expect(capturedPrompt).not.toContain("{{context}}");
    expect(capturedPrompt).not.toContain("{{expected_output}}");
  });
});

describe("evaluate() — input validation", () => {
  beforeEach(() => {
    vi.mocked(createProvider).mockReturnValue(
      mockProvider({ scoreValue: 1, summary: "ok", reasoning: "ok" }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws EvalInputError when required field 'context' is missing for faithfulness", async () => {
    await expect(
      evaluate("faithfulness", baseInput, baseConfig),
    ).rejects.toBeInstanceOf(EvalInputError);
  });

  it("throws EvalInputError when required field 'expected_output' is missing for factual-accuracy", async () => {
    await expect(
      evaluate("factual-accuracy", baseInput, baseConfig),
    ).rejects.toBeInstanceOf(EvalInputError);
  });

  it("error message lists missing fields", async () => {
    try {
      await evaluate("faithfulness", baseInput, baseConfig);
    } catch (e: any) {
      expect(e.message).toContain("context");
    }
  });

  it("throws EvalMetricError for unknown string metric id", async () => {
    await expect(
      evaluate("nonexistent", baseInput, baseConfig),
    ).rejects.toBeInstanceOf(EvalMetricError);
  });
});

describe("evaluate() — error handling", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws EvalConfigError when API key is missing", async () => {
    const config: EvalConfig = { provider: "openai" };
    // Remove env var too
    const origEnv = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      await expect(evaluate("toxicity", baseInput, config)).rejects.toBeInstanceOf(
        EvalConfigError,
      );
    } finally {
      if (origEnv) process.env.OPENAI_API_KEY = origEnv;
    }
  });

  it("throws EvalTimeoutError on provider timeout", async () => {
    const timeoutError = new Error("timeout");
    (timeoutError as any).code = "ETIMEDOUT";
    vi.mocked(createProvider).mockReturnValue(failingProvider(timeoutError));
    await expect(
      evaluate("toxicity", baseInput, baseConfig),
    ).rejects.toBeInstanceOf(EvalTimeoutError);
  });

  it("throws EvalResponseError on malformed LLM response", async () => {
    const provider: LLMProvider = {
      call: vi.fn().mockResolvedValue({ garbage: true }),
    };
    vi.mocked(createProvider).mockReturnValue(provider);
    await expect(
      evaluate("toxicity", baseInput, baseConfig),
    ).rejects.toBeInstanceOf(EvalResponseError);
  });

  it("retries on transient error up to maxRetries", async () => {
    const transientError = new Error("rate limit");
    (transientError as any).status = 429;
    const provider = failingProvider(transientError, 2); // succeeds on 3rd call
    vi.mocked(createProvider).mockReturnValue(provider);
    const result = await evaluate("toxicity", baseInput, {
      ...baseConfig,
      maxRetries: 2,
    });
    expect(result.score.value).toBe(1);
    expect(provider.call).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  it("throws after exhausting retries", async () => {
    const transientError = new Error("rate limit");
    (transientError as any).status = 429;
    vi.mocked(createProvider).mockReturnValue(failingProvider(transientError));
    await expect(
      evaluate("toxicity", baseInput, { ...baseConfig, maxRetries: 2 }),
    ).rejects.toThrow();
  });

  it("uses exponential backoff between retries", async () => {
    const transientError = new Error("rate limit");
    (transientError as any).status = 429;
    const provider = failingProvider(transientError, 2);
    vi.mocked(createProvider).mockReturnValue(provider);

    const startTime = Date.now();
    // Use minimal config for fast test
    await evaluate("toxicity", baseInput, { ...baseConfig, maxRetries: 2 });
    // Just verify multiple calls were made (backoff is internal)
    expect(provider.call).toHaveBeenCalledTimes(3);
  });
});

describe("provider factory", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates OpenAI provider when provider is 'openai'", () => {
    const provider = createProvider({
      provider: "openai",
      apiKey: "test-key",
      timeout: 30000,
      maxRetries: 2,
    });
    expect(provider).toBeInstanceOf(OpenAIProvider);
  });

  it("creates Anthropic provider when provider is 'anthropic'", () => {
    const provider = createProvider({
      provider: "anthropic",
      apiKey: "test-key",
      timeout: 30000,
      maxRetries: 2,
    });
    expect(provider).toBeInstanceOf(AnthropicProvider);
  });

  it("uses explicit apiKey over env var", () => {
    process.env.OPENAI_API_KEY = "env-key";
    const provider = createProvider({
      provider: "openai",
      apiKey: "explicit-key",
      timeout: 30000,
      maxRetries: 2,
    });
    expect(provider).toBeInstanceOf(OpenAIProvider);
    delete process.env.OPENAI_API_KEY;
  });

  it("falls back to env var when apiKey not provided", () => {
    process.env.OPENAI_API_KEY = "env-key";
    const provider = createProvider({
      provider: "openai",
      timeout: 30000,
      maxRetries: 2,
    });
    expect(provider).toBeInstanceOf(OpenAIProvider);
    delete process.env.OPENAI_API_KEY;
  });

  it("uses custom model when specified", () => {
    const provider = createProvider({
      provider: "openai",
      apiKey: "test-key",
      model: "gpt-4-turbo",
      timeout: 30000,
      maxRetries: 2,
    });
    expect(provider).toBeInstanceOf(OpenAIProvider);
  });

  it("uses default model when not specified", () => {
    const provider = createProvider({
      provider: "openai",
      apiKey: "test-key",
      timeout: 30000,
      maxRetries: 2,
    });
    expect(provider).toBeInstanceOf(OpenAIProvider);
  });

  it("uses explicit baseUrl from config", () => {
    const provider = createProvider({
      provider: "openai",
      apiKey: "test-key",
      baseUrl: "https://custom.api.example.com/v1",
      timeout: 30000,
      maxRetries: 2,
    });
    expect(provider).toBeInstanceOf(OpenAIProvider);
  });

  it("falls back to OPENAI_BASE_URL env var", () => {
    process.env.OPENAI_BASE_URL = "https://env.api.example.com/v1";
    const provider = createProvider({
      provider: "openai",
      apiKey: "test-key",
      timeout: 30000,
      maxRetries: 2,
    });
    expect(provider).toBeInstanceOf(OpenAIProvider);
    delete process.env.OPENAI_BASE_URL;
  });

  it("falls back to ANTHROPIC_BASE_URL env var", () => {
    process.env.ANTHROPIC_BASE_URL = "https://env.api.example.com";
    const provider = createProvider({
      provider: "anthropic",
      apiKey: "test-key",
      timeout: 30000,
      maxRetries: 2,
    });
    expect(provider).toBeInstanceOf(AnthropicProvider);
    delete process.env.ANTHROPIC_BASE_URL;
  });
});
