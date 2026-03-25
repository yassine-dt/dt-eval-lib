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

## Story 2 — Prompt Catalog & Registry
Pending

## Story 3 — Eval Engine & Providers
Pending
