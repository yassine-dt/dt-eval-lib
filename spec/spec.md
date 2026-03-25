# dt-eval-lib — Technical Specification

## Overview

**dt-eval-lib** is a minimal, developer-friendly TypeScript library for running LLM-as-a-judge evaluations. It ships as an ESM-only npm package for Node.js.

The library provides:
1. A **prompt catalog** of 7 pre-built evaluation metrics
2. A **scoring system** with 3 built-in scales (binary, continuous, likert)
3. An **eval engine** that calls OpenAI or Anthropic to judge LLM outputs
4. A **custom prompt** system with JSON file persistence

---

## Architecture

```
dt-eval-lib/
├── src/
│   ├── index.ts                  # Public API re-exports
│   ├── types.ts                  # All shared types/interfaces
│   ├── scoring/
│   │   ├── index.ts              # Scoring re-exports
│   │   ├── types.ts              # Scoring types
│   │   └── scales.ts             # Built-in scoring scales (binary, continuous, likert)
│   ├── prompts/
│   │   ├── index.ts              # Prompt catalog loader + re-exports
│   │   ├── types.ts              # Prompt types
│   │   ├── catalog.json          # Built-in prompt definitions
│   │   └── registry.ts           # Prompt registry (built-in + custom resolution)
│   ├── engine/
│   │   ├── index.ts              # evaluate() function — main entry point
│   │   ├── types.ts              # Engine config & result types
│   │   └── providers/
│   │       ├── index.ts          # Provider factory
│   │       ├── types.ts          # Provider interface
│   │       ├── openai.ts         # OpenAI structured output provider
│   │       └── anthropic.ts      # Anthropic structured output provider
│   └── custom/
│       ├── index.ts              # createCustomPrompt(), loadCustomPrompts()
│       └── storage.ts            # JSON file read/write for custom prompts
├── spec/                         # This spec folder
├── tests/
│   ├── scoring.test.ts
│   ├── prompts.test.ts
│   ├── engine.test.ts
│   └── custom.test.ts
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── vitest.config.ts
```

---

## Types & Interfaces

### Scoring

```ts
/** Supported scoring scale types */
type ScoringScaleType = "binary" | "continuous" | "likert";

/** Definition of a scoring scale */
interface ScoringScale {
  type: ScoringScaleType;
  /** Range of valid score values [min, max] */
  range: [number, number];
  /** Threshold at or above which the label is "pass" */
  threshold: number;
  /** Optional labels for discrete values (likert) */
  labels?: Record<number, string>;
}

/** A computed score result */
interface Score {
  value: number;
  label: "pass" | "fail";
}
```

**Built-in scales:**

| Name         | Range   | Default Threshold | Description                                        |
|--------------|---------|-------------------|----------------------------------------------------|
| `binary`     | [0, 1]  | 1                 | 0 = fail, 1 = pass                                 |
| `continuous`  | [0, 1]  | 0.5               | Float 0–1, pass if ≥ threshold (customizable)       |
| `likert`     | [1, 5]  | 3                 | Integer 1–5, pass if ≥ threshold (customizable). Labels: 1="Very Poor", 2="Poor", 3="Average", 4="Good", 5="Excellent" |

**Customizable thresholds:** Each built-in metric ships with a default threshold in its catalog entry. Users can override the threshold at evaluation time without modifying the catalog.

### Prompts

```ts
interface PromptDefinition {
  id: string;
  name: string;
  version: string;
  /** Description of what this metric evaluates */
  description: string;
  /** The evaluation prompt template — uses {{input}}, {{output}}, {{context}}, {{expected_output}} placeholders */
  prompt: string;
  /** Which input fields this prompt requires */
  requiredFields: ("input" | "output" | "context" | "expected_output")[];
  /** The scoring scale to use */
  scoring: ScoringScale;
}
```

### Eval Engine

```ts
/** Provider selection */
type Provider = "openai" | "anthropic";

/** Configuration for the eval engine */
interface EvalConfig {
  provider: Provider;
  /** API key — falls back to OPENAI_API_KEY / ANTHROPIC_API_KEY env vars */
  apiKey?: string;
  /** Model override — defaults to gpt-4o / claude-sonnet-4-20250514 */
  model?: string;
  /** Override the metric's default scoring threshold */
  thresholdOverride?: number;
  /** Request timeout in ms — default 30000 */
  timeout?: number;
  /** Max retries on transient errors — default 2 */
  maxRetries?: number;
}

/** Input to an evaluation */
interface EvalInput {
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
interface EvalResult {
  score: Score;
  explanation: {
    summary: string;
    [key: string]: unknown;
  };
}

/** Main evaluation function signature */
type EvaluateFn = (
  metric: string | PromptDefinition,
  input: EvalInput,
  config: EvalConfig
) => Promise<EvalResult>;
```

### Custom Prompts

```ts
interface CreateCustomPromptInput {
  name: string;
  prompt: string;
  /** Optional — defaults to "continuous" */
  scoring?: ScoringScale;
  /** Optional — defaults to ["input", "output"] */
  requiredFields?: ("input" | "output" | "context" | "expected_output")[];
  description?: string;
}

interface CustomPromptConfig {
  /** Directory for custom prompt storage — default: ~/.dt-eval/ */
  storageDir?: string;
}
```

---

## Built-in Prompt Catalog (7 metrics)

Each prompt is stored in `src/prompts/catalog.json`. The prompt text instructs the LLM judge to evaluate a specific quality and return structured output.

| # | Metric ID           | Required Fields                    | Scoring     | Description                                                   |
|---|---------------------|------------------------------------|-------------|---------------------------------------------------------------|
| 1 | `toxicity`          | input, output                      | binary      | Detects toxic, harmful, or offensive content                   |
| 2 | `faithfulness`      | input, output, context             | continuous  | Measures if the output is faithful to the provided context     |
| 3 | `hallucination`     | input, output, context             | binary      | Detects fabricated information not grounded in context         |
| 4 | `pii-leakage`       | input, output                      | binary      | Detects leaked personally identifiable information             |
| 5 | `relevance`         | input, output                      | continuous  | Measures how relevant the output is to the input question      |
| 6 | `factual-accuracy`  | input, output, expected_output     | continuous  | Measures factual correctness against a reference answer        |
| 7 | `coherence`         | input, output                      | likert      | Rates logical structure, flow, and clarity (1–5)               |

---

## Provider Implementation

### Structured Output

Both providers use their native structured output mechanisms to ensure reliable JSON extraction:

- **OpenAI**: `response_format: { type: "json_schema", ... }` or function calling
- **Anthropic**: Tool use with a defined input schema

The schema enforced on the LLM response:

```json
{
  "score_value": "<number>",
  "summary": "<string>",
  "reasoning": "<string>"
}
```

The engine maps `score_value` through the prompt's scoring scale to produce the final `Score` (value + pass/fail label).

### Default Models

| Provider   | Default Model             |
|------------|---------------------------|
| OpenAI     | `gpt-4o`                  |
| Anthropic  | `claude-sonnet-4-20250514`    |

Users can override via `config.model`.

### Error Handling

- **Missing API key**: Throw a clear `EvalConfigError` with instructions
- **Invalid metric**: Throw `EvalMetricError` listing available metrics
- **LLM timeout**: Respect `config.timeout` (default 30s), throw `EvalTimeoutError`
- **LLM rate limit / transient error**: Retry up to `config.maxRetries` (default 2) with exponential backoff
- **Malformed LLM response**: Retry once, then throw `EvalResponseError` with the raw response
- **Missing required fields**: Throw `EvalInputError` listing which fields are missing

All custom errors extend a base `DtEvalError` class.

---

## Custom Prompt Persistence

### Storage

- Default directory: `~/.dt-eval/`
- File: `custom-prompts.json`
- Format: Array of `PromptDefinition` objects
- File is created on first `createCustomPrompt()` call

### API

```ts
// Create and persist a custom prompt
function createCustomPrompt(
  input: CreateCustomPromptInput,
  config?: CustomPromptConfig
): Promise<PromptDefinition>;

// Delete a custom prompt by id
function deleteCustomPrompt(
  id: string,
  config?: CustomPromptConfig
): Promise<void>;

// Load all custom prompts from storage
function loadCustomPrompts(
  config?: CustomPromptConfig
): Promise<PromptDefinition[]>;
```

### Auto-loading

The prompt registry merges built-in + custom prompts. When `evaluate("my-metric", ...)` is called:
1. Check built-in catalog
2. Check loaded custom prompts (auto-loaded from `~/.dt-eval/custom-prompts.json`)
3. If not found, throw `EvalMetricError`

Custom prompts with the same ID as built-in ones are rejected (no overriding built-ins).

---

## Public API Surface

```ts
// Main eval function
export { evaluate } from "./engine";

// Prompt catalog
export { getPrompt, listPrompts } from "./prompts";

// Custom prompts
export { createCustomPrompt, deleteCustomPrompt, loadCustomPrompts } from "./custom";

// Scoring utility
export { computeScore } from "./scoring";

// Built-in scoring scales
export { BINARY_SCALE, CONTINUOUS_SCALE, LIKERT_SCALE } from "./scoring";

// Types
export type {
  EvalConfig,
  EvalInput,
  EvalResult,
  Score,
  ScoringScale,
  PromptDefinition,
  Provider,
  // Errors
  DtEvalError,
  EvalConfigError,
  EvalMetricError,
  EvalInputError,
  EvalTimeoutError,
  EvalResponseError,
};
```

---

## Tooling & Config

| Tool      | Choice                      |
|-----------|-----------------------------|
| Language  | TypeScript (strict mode)    |
| Module    | ESM-only                    |
| Bundler   | tsup                        |
| Tests     | Vitest                      |
| Runtime   | Node.js ≥ 18               |
| LLM SDKs | `openai`, `@anthropic-ai/sdk` |
