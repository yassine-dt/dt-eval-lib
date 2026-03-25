# Story 2 — Eval Engine & LLM Providers

## Goal
Implement the core `evaluate()` function and both LLM provider integrations (OpenAI, Anthropic) with structured output, error handling, retries, and timeouts.

## Approach: TDD (Red → Green → Refactor)

1. **Red** — Write comprehensive tests for `evaluate()` with mocked LLM providers. Write tests for input validation, prompt rendering, error mapping, and retry logic. All fail initially.
2. **Green** — Implement providers, provider factory, and the `evaluate()` orchestration function until all tests pass.
3. **Refactor** — Extract shared provider logic, improve error messages, simplify retry logic.

## Scope

### 1. Provider interface
`src/engine/providers/types.ts`:
```ts
interface LLMProvider {
  call(prompt: string, schema: JSONSchema): Promise<LLMResponse>;
}

interface LLMResponse {
  scoreValue: number;
  summary: string;
  reasoning: string;
}
```

### 2. OpenAI provider
`src/engine/providers/openai.ts`:
- Uses `openai` SDK
- Sends the evaluation prompt as a user message
- Uses structured output (response_format with json_schema or function calling) to enforce the response schema
- Handles API key from config or `OPENAI_API_KEY` env var
- Default model: `gpt-4o`
- Respects `timeout` and `maxRetries` config

### 3. Anthropic provider
`src/engine/providers/anthropic.ts`:
- Uses `@anthropic-ai/sdk`
- Sends the evaluation prompt as a user message
- Uses tool use to enforce structured output schema
- Handles API key from config or `ANTHROPIC_API_KEY` env var
- Default model: `claude-sonnet-4-20250514`
- Respects `timeout` and `maxRetries` config

### 4. Provider factory
`src/engine/providers/index.ts`:
- `createProvider(config: EvalConfig): LLMProvider`
- Validates API key is available, throws `EvalConfigError` if missing

### 5. Eval engine
`src/engine/index.ts` — `evaluate()` function:

```ts
async function evaluate(
  metric: string | PromptDefinition,
  input: EvalInput,
  config: EvalConfig
): Promise<EvalResult>
```

Flow:
1. **Resolve prompt** — if `metric` is a string, look up in registry; if `PromptDefinition`, use directly
2. **Validate input** — check all `requiredFields` are present in `input`, throw `EvalInputError` if not
3. **Build prompt** — replace `{{input}}`, `{{output}}`, `{{context}}`, `{{expected_output}}` placeholders with actual values
4. **Call provider** — use structured output to get `{ scoreValue, summary, reasoning }`
5. **Compute score** — pass `scoreValue` through `computeScore()` with the prompt's scoring scale and optional `config.thresholdOverride`
6. **Return result** — `{ score: { value, label }, explanation: { summary, reasoning } }`

### 6. Error handling
- Wrap all provider calls in try/catch
- Map SDK errors to custom error types:
  - Auth errors → `EvalConfigError`
  - Timeout → `EvalTimeoutError`
  - Rate limit / transient → retry with exponential backoff
  - Malformed response → `EvalResponseError`
- All errors include helpful messages

### 7. Update public API
`src/index.ts`:
- Export `evaluate` function
- Export all types needed by consumers

## TDD Cycle Details

### Red Phase (write failing tests first)

```
tests/engine.test.ts:
  describe("evaluate() — happy path"):
    ✗ "evaluates with a string metric id (built-in)"
    ✗ "evaluates with a PromptDefinition object directly"
    ✗ "returns correct EvalResult shape { score: { value, label }, explanation: { summary, reasoning } }"
    ✗ "binary scoring: score 1 → pass"
    ✗ "binary scoring: score 0 → fail"
    ✗ "continuous scoring: score 0.8 → pass"
    ✗ "likert scoring: score 4 → pass"
    ✗ "thresholdOverride: continuous with custom threshold 0.9 — score 0.8 → fail"
    ✗ "thresholdOverride: is passed through to computeScore"

  describe("evaluate() — prompt rendering"):
    ✗ "replaces {{input}} placeholder"
    ✗ "replaces {{output}} placeholder"
    ✗ "replaces {{context}} placeholder when present"
    ✗ "replaces {{expected_output}} placeholder when present"
    ✗ "omits optional placeholders when fields not provided"

  describe("evaluate() — input validation"):
    ✗ "throws EvalInputError when required field 'context' is missing for faithfulness"
    ✗ "throws EvalInputError when required field 'expected_output' is missing for factual-accuracy"
    ✗ "error message lists missing fields"
    ✗ "throws EvalMetricError for unknown string metric id"

  describe("evaluate() — error handling"):
    ✗ "throws EvalConfigError when API key is missing"
    ✗ "throws EvalTimeoutError on provider timeout"
    ✗ "throws EvalResponseError on malformed LLM response"
    ✗ "retries on transient error up to maxRetries"
    ✗ "throws after exhausting retries"
    ✗ "uses exponential backoff between retries"

  describe("provider factory"):
    ✗ "creates OpenAI provider when provider is 'openai'"
    ✗ "creates Anthropic provider when provider is 'anthropic'"
    ✗ "uses explicit apiKey over env var"
    ✗ "falls back to env var when apiKey not provided"
    ✗ "uses custom model when specified"
    ✗ "uses default model when not specified"
```

**Note:** All LLM calls are mocked. Tests use `vi.mock()` to replace provider SDK clients with controlled stubs returning predefined structured responses.

### Green Phase (make tests pass)
- Implement `OpenAIProvider` and `AnthropicProvider` classes
- Implement `createProvider()` factory
- Implement `evaluate()` orchestration
- Implement retry logic with exponential backoff
- Map SDK errors to custom error types

### Refactor Phase
- Extract shared retry/timeout logic into a utility
- Improve error messages with actionable suggestions
- Ensure provider implementations are consistent in structure
- Simplify the evaluate() function if possible

## Commit
One commit: `feat: eval engine with OpenAI and Anthropic providers`

## Verification
- All Red tests now pass (Green)
- `npm run build` succeeds
- No real API calls made in tests (all mocked)
