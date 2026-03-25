# Story 0 — Project Scaffolding & Foundation Types

## Goal
Set up the project structure, tooling, dependencies, and all shared types/interfaces so subsequent stories can build on a solid foundation.

## Approach: TDD (Red → Green → Refactor)

This story is mostly scaffolding, but we still apply TDD where applicable:

1. **Red** — Write a smoke test that imports from `src/index.ts` and asserts the module loads. Write type-level tests that verify error classes extend `DtEvalError`. These tests will fail because nothing exists yet.
2. **Green** — Create the project structure, config files, types, and error classes until all tests pass.
3. **Refactor** — Clean up any type organization, ensure consistent naming, verify build output.

## Scope

### 1. Initialize npm package
- `package.json` with name `dt-eval-lib`, ESM (`"type": "module"`)
- Dependencies: `openai`, `@anthropic-ai/sdk`
- Dev dependencies: `typescript`, `tsup`, `vitest`
- Scripts: `build`, `test`

### 2. TypeScript configuration
- `tsconfig.json` — strict mode, ESM, target ES2022, Node 18+ module resolution, `resolveJsonModule: true`
- `tsup.config.ts` — ESM-only output, dts generation

### 3. Vitest configuration
- `vitest.config.ts` — basic setup for the project

### 4. Project directory structure
Create all folders:
```
src/
  scoring/
  prompts/
  engine/
    providers/
  custom/
tests/
```

### 5. All shared types & interfaces
Create the full type system in organized files:
- `src/types.ts` — re-exports from submodules
- `src/scoring/types.ts` — `ScoringScaleType`, `ScoringScale`, `Score`
- `src/prompts/types.ts` — `PromptDefinition`
- `src/engine/types.ts` — `Provider`, `EvalConfig`, `EvalInput`, `EvalResult`, `EvaluateFn`
- `src/engine/providers/types.ts` — `LLMProvider` interface
- `src/custom/types.ts` — `CreateCustomPromptInput`, `CustomPromptConfig` (if needed)

### 6. Error classes
- `src/errors.ts` — `DtEvalError`, `EvalConfigError`, `EvalMetricError`, `EvalInputError`, `EvalTimeoutError`, `EvalResponseError`

### 7. Entry point stub
- `src/index.ts` — placeholder re-exports (will be filled in as stories complete)

## TDD Cycle Details

### Red Phase (write failing tests first)
```
tests/setup.test.ts:
  ✗ "module can be imported from src/index"
  ✗ "DtEvalError is an instance of Error"
  ✗ "EvalConfigError extends DtEvalError"
  ✗ "EvalMetricError extends DtEvalError"
  ✗ "EvalInputError extends DtEvalError"
  ✗ "EvalTimeoutError extends DtEvalError"
  ✗ "EvalResponseError extends DtEvalError"
  ✗ "all scoring types are importable"
  ✗ "all prompt types are importable"
  ✗ "all engine types are importable"
```

### Green Phase (make tests pass)
- Create all files, types, and error classes
- Wire up exports in `src/index.ts`
- Ensure `npm run build` produces valid output

### Refactor Phase
- Ensure consistent naming conventions across all type files
- Verify `dist/` output contains correct `.d.ts` declarations
- Clean up any redundant exports

## Commit
One commit: `feat: project scaffolding, tooling, and foundation types`

## Verification
- `npm install` succeeds
- All Red tests now pass (Green)
- `npm run build` produces `dist/` with `.js` and `.d.ts` files
- All type files compile without errors
