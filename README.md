# dt-eval-lib

Minimal TypeScript library for running LLM-as-a-judge evaluations.

## Install

```bash
npm install
```

## Build

```bash
npm run build
```

## Test

```bash
npm test
```

## Quick Usage

```ts
import { evaluate } from "dt-eval-lib";

const result = await evaluate(
  "toxicity",
  {
    input: "Tell me a joke",
    output: "Why did the chicken cross the road? To get to the other side!",
  },
  {
    provider: "openai",
    apiKey: "sk-...",
  },
);

console.log(result.score);       // { value: 1, label: "pass" }
console.log(result.explanation); // { summary: "...", reasoning: "..." }
```

## Available Metrics

| Metric | Type | Required Fields |
|--------|------|-----------------|
| `toxicity` | binary | input, output |
| `faithfulness` | continuous | input, output, context |
| `hallucination` | binary | input, output, context |
| `pii-leakage` | binary | input, output |
| `relevance` | continuous | input, output |
| `factual-accuracy` | continuous | input, output, expected_output |
| `coherence` | likert (1-5) | input, output |

## Providers

Supports **OpenAI** and **Anthropic**. Configure via API key in code or environment variable.

### Environment Variables

```bash
# API Keys
export OPENAI_API_KEY="sk-..."
export ANTHROPIC_API_KEY="sk-ant-..."

# Custom Base URLs (optional — for proxies, self-hosted, or compatible APIs)
export OPENAI_BASE_URL="https://your-proxy.example.com/v1"
export ANTHROPIC_BASE_URL="https://your-proxy.example.com"
```

Or use a `.env` file (not committed to git):

```
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_BASE_URL=https://your-proxy.example.com/v1
ANTHROPIC_BASE_URL=https://your-proxy.example.com
```

When calling `evaluate()`, the library resolves config in this order:
1. Explicit value in `config` (e.g., `config.apiKey`, `config.baseUrl`)
2. Environment variable (`OPENAI_API_KEY`, `OPENAI_BASE_URL`, etc.)

```ts
// Option 1: explicit config
await evaluate("toxicity", input, {
  provider: "openai",
  apiKey: "sk-...",
  baseUrl: "https://your-proxy.example.com/v1",
});

// Option 2: env vars (no apiKey/baseUrl needed)
await evaluate("toxicity", input, { provider: "openai" });
```

## Metric Identification

Metrics are identified by **string IDs** (not enums). Pass the ID directly to `evaluate()`:

```ts
await evaluate("toxicity", input, config);       // built-in metric by string ID
await evaluate(myCustomPrompt, input, config);    // or a PromptDefinition object
```

Use `listPrompts()` and `getPrompt()` to discover available metrics:

```ts
import { listPrompts, getPrompt } from "dt-eval-lib";

const all = await listPrompts();           // all 7 built-in metrics
const tox = await getPrompt("toxicity");   // single metric by ID
```

## Threshold Override

```ts
const result = await evaluate("relevance", input, {
  provider: "openai",
  apiKey: "sk-...",
  thresholdOverride: 0.8, // stricter than default 0.5
});
```

## Custom Prompts

Create your own evaluation metrics and persist them to disk (`~/.dt-eval/custom-prompts.json`):

```ts
import { createCustomPrompt, deleteCustomPrompt, loadCustomPrompts } from "dt-eval-lib";

// Create a custom metric
const prompt = await createCustomPrompt({
  name: "Tone Check",
  prompt: "Evaluate if the output uses a professional tone.\n\nInput: {{input}}\nOutput: {{output}}",
  description: "Checks for professional tone",
  // Optional — defaults to continuous [0,1] with threshold 0.5
});

// Use it with evaluate()
const result = await evaluate("tone-check", input, config);

// Load previously saved custom prompts
const customs = await loadCustomPrompts();

// Delete a custom prompt
await deleteCustomPrompt("tone-check");
```
