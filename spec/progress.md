# Progress

## Story 0 — Project Scaffolding & Foundation Types ✅
- Initialized npm package (ESM-only, Node 18+)
- Configured TypeScript, tsup, vitest
- Created directory structure
- Implemented all shared types (scoring, prompts, engine, custom)
- Implemented error class hierarchy (DtEvalError + 5 subclasses)
- Wired up src/index.ts entry point
- Tests: 10/10 passing
- Build: dist/ with .js, .d.ts, .map
- Commit: `feat: project scaffolding, tooling, and foundation types`

## Story 1 — Prompt Catalog & Scoring System ✅
- Implemented computeScore() with threshold override support
- Added BINARY_SCALE, CONTINUOUS_SCALE, LIKERT_SCALE templates
- Created catalog.json with 7 prompt definitions (embedded scoring)
- Implemented PromptRegistry (get/list/has/register)
- Added getPrompt() and listPrompts() async API
- Tests: 40/40 passing (17 scoring + 23 prompts)
- Build: dist/ with .js, .d.ts
- Commit: `feat: built-in scoring scales and 7-metric prompt catalog`

## Story 2 — Eval Engine & LLM Providers ✅
- Implemented evaluate() with prompt resolution, validation, rendering, scoring
- Added OpenAI provider (structured output, default model gpt-5.1)
- Added Anthropic provider (tool use, default model claude-sonnet-4-20250514)
- Provider factory with API key + base URL resolution (config or env vars)
- Retry logic with exponential backoff for transient errors
- Error mapping (timeout, config, response, input, metric)
- README with env setup and usage instructions
- Tests: 33 engine tests passing
- Commit: `feat: eval engine with OpenAI and Anthropic providers`

## Story 3 — Custom Prompts & Final Polish ✅
- Implemented custom prompt storage (read/write custom-prompts.json)
- Added createCustomPrompt() with validation, kebab-case ID, defaults, persistence
- Added deleteCustomPrompt() with registry unregister
- Added loadCustomPrompts() with registry integration
- Updated PromptRegistry with unregister() and hasBuiltIn()
- Exported createCustomPrompt, deleteCustomPrompt, loadCustomPrompts from public API
- Tests: 26 custom tests passing
- Commit: `feat: custom prompts with persistence and README`
