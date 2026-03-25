# Story 1 — Prompt Catalog & Scoring System

## Goal
Implement the scoring system with customizable thresholds and the 7-metric prompt catalog where each metric ships with its scoring baked in.

## Approach: TDD (Red → Green → Refactor)

1. **Red** — Write all scoring and prompt tests first. They will all fail because no implementation exists.
2. **Green** — Implement scoring scales, `computeScore()`, prompt catalog JSON (with embedded scoring), and prompt registry until every test passes.
3. **Refactor** — Extract common patterns, improve prompt text quality, ensure clean registry API.

## Key Design Decision: Customizable Thresholds

- Each built-in prompt in `catalog.json` ships with a **default scoring configuration** (scale type + default threshold)
- Users can **override the threshold** when calling `evaluate()` without modifying the catalog
- The `computeScore()` function accepts an optional `thresholdOverride` parameter
- Built-in scale constants (`BINARY_SCALE`, `CONTINUOUS_SCALE`, `LIKERT_SCALE`) serve as templates; the actual scoring per metric is defined in the catalog

## Scope

### 1. Built-in scoring scale templates
`src/scoring/scales.ts`:
- `BINARY_SCALE` — type "binary", range [0, 1], default threshold 1
- `CONTINUOUS_SCALE` — type "continuous", range [0, 1], default threshold 0.5
- `LIKERT_SCALE` — type "likert", range [1, 5], default threshold 3, labels: `{1: "Very Poor", 2: "Poor", 3: "Average", 4: "Good", 5: "Excellent"}`

These are **reusable templates** for custom prompts. Built-in prompts define their own scoring inline in the catalog.

`src/scoring/index.ts`:
- `computeScore(value: number, scale: ScoringScale, thresholdOverride?: number): Score`
  - Validates value is within range
  - Uses `thresholdOverride` if provided, otherwise uses `scale.threshold`
  - Computes pass/fail label: value ≥ effective threshold → "pass", otherwise → "fail"
- Re-export scales and types

### 2. Prompt catalog JSON
`src/prompts/catalog.json` — 7 prompt definitions, each with **embedded scoring**:

```json
{
  "id": "toxicity",
  "name": "Toxicity",
  "version": "1.0.0",
  "description": "Detects toxic, harmful, or offensive content",
  "prompt": "...",
  "requiredFields": ["input", "output"],
  "scoring": {
    "type": "binary",
    "range": [0, 1],
    "threshold": 1
  }
}
```

| Metric ID          | Scoring Type | Range   | Default Threshold | Required Fields                |
|---------------------|-------------|---------|-------------------|--------------------------------|
| `toxicity`          | binary      | [0, 1]  | 1                 | input, output                  |
| `faithfulness`      | continuous  | [0, 1]  | 0.5               | input, output, context         |
| `hallucination`     | binary      | [0, 1]  | 1                 | input, output, context         |
| `pii-leakage`       | binary      | [0, 1]  | 1                 | input, output                  |
| `relevance`         | continuous  | [0, 1]  | 0.5               | input, output                  |
| `factual-accuracy`  | continuous  | [0, 1]  | 0.5               | input, output, expected_output |
| `coherence`         | likert      | [1, 5]  | 3                 | input, output                  |

Each prompt text includes:
- Clear LLM judge role instructions
- Placeholder tokens: `{{input}}`, `{{output}}`, `{{context}}`, `{{expected_output}}`
- Specific evaluation criteria for the metric

### 3. Prompt registry
`src/prompts/registry.ts`:
- `PromptRegistry` class:
  - Loads built-in prompts from catalog.json on instantiation
  - `get(id: string): PromptDefinition | undefined` (sync for built-in; auto-loading handled at init)
  - `list(): PromptDefinition[]`
  - `register(prompt: PromptDefinition): void` — for custom prompts (used by Story 3)
  - `has(id: string): boolean`
  - `initCustomPrompts(storageDir?: string): Promise<void>` — lazily loads custom prompts from disk on first call

`src/prompts/index.ts`:
- `getPrompt(id: string): Promise<PromptDefinition>` — throws `EvalMetricError` if not found (async for custom prompt auto-loading)
- `listPrompts(): Promise<PromptDefinition[]>` — async for custom prompt auto-loading
- Singleton registry instance

## TDD Cycle Details

### Red Phase (write failing tests first)

```
tests/scoring.test.ts:
  describe("computeScore"):
    ✗ "binary scale: value 1 → pass"
    ✗ "binary scale: value 0 → fail"
    ✗ "continuous scale: value 0.7 → pass (default threshold 0.5)"
    ✗ "continuous scale: value 0.3 → fail"
    ✗ "continuous scale: value 0.5 (exact threshold) → pass"
    ✗ "likert scale: value 4 → pass"
    ✗ "likert scale: value 2 → fail"
    ✗ "likert scale: value 3 (exact threshold) → pass"
    ✗ "throws on value below range minimum"
    ✗ "throws on value above range maximum"
    ✗ "thresholdOverride: continuous with custom threshold 0.8 — value 0.7 → fail"
    ✗ "thresholdOverride: continuous with custom threshold 0.3 — value 0.4 → pass"
    ✗ "thresholdOverride: likert with custom threshold 4 — value 3 → fail"
    ✗ "thresholdOverride: takes precedence over scale.threshold"

  describe("built-in scale templates"):
    ✗ "BINARY_SCALE has correct type, range, and threshold"
    ✗ "CONTINUOUS_SCALE has correct type, range, and threshold"
    ✗ "LIKERT_SCALE has correct type, range, threshold, and labels"

tests/prompts.test.ts:
  describe("prompt catalog"):
    ✗ "loads all 7 built-in prompts"
    ✗ "each prompt has id, name, version, description, prompt, requiredFields, scoring"
    ✗ "each prompt has embedded scoring with type, range, and threshold"
    ✗ "toxicity has binary scoring with threshold 1"
    ✗ "faithfulness has continuous scoring with threshold 0.5"
    ✗ "coherence has likert scoring with threshold 3"
    ✗ "toxicity prompt requires input and output"
    ✗ "faithfulness prompt requires input, output, and context"
    ✗ "hallucination prompt requires input, output, and context"
    ✗ "pii-leakage prompt requires input and output"
    ✗ "relevance prompt requires input and output"
    ✗ "factual-accuracy prompt requires input, output, and expected_output"
    ✗ "coherence prompt requires input and output"
    ✗ "each prompt contains placeholder tokens matching its requiredFields"

  describe("getPrompt"):
    ✗ "returns prompt by id"
    ✗ "throws EvalMetricError for unknown id"
    ✗ "error message lists available metrics"

  describe("listPrompts"):
    ✗ "returns all 7 prompts"
    ✗ "getPrompt and listPrompts are async"

  describe("registry"):
    ✗ "has() returns true for built-in prompts"
    ✗ "has() returns false for unknown prompts"
    ✗ "register() adds a new prompt"
    ✗ "register() throws if id already exists"
```

### Green Phase (make tests pass)
- Implement `computeScore()` with validation and threshold override support
- Create `catalog.json` with all 7 prompt definitions (scoring embedded in each)
- Implement `PromptRegistry` class
- Wire up `getPrompt()` and `listPrompts()` public functions

### Refactor Phase
- Review and improve prompt text quality for each metric
- Ensure consistent prompt structure across all 7 metrics
- Extract any shared validation logic
- Verify types are correctly exported

## Commit
One commit: `feat: built-in scoring scales and 7-metric prompt catalog`

## Verification
- All Red tests now pass (Green)
- `npm run build` succeeds
- Types are correctly exported
