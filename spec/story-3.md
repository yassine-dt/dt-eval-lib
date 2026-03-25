# Story 3 — Custom Prompts & Final Polish

## Goal
Implement custom prompt creation with JSON file persistence, integrate custom prompts into the eval engine, finalize the public API, and add README documentation.

## Approach: TDD (Red → Green → Refactor)

1. **Red** — Write tests for custom prompt creation, persistence (read/write to temp dirs), registry integration, validation, and edge cases. All fail initially.
2. **Green** — Implement storage layer, `createCustomPrompt()`, `loadCustomPrompts()`, auto-loading, until all tests pass.
3. **Refactor** — Clean up file I/O error handling, simplify the auto-loading mechanism, finalize public API exports, write README.

## Scope

### 1. Custom prompt storage
`src/custom/storage.ts`:
- `readCustomPrompts(storageDir: string): Promise<PromptDefinition[]>` — reads `custom-prompts.json` from dir; returns `[]` if file doesn't exist
- `writeCustomPrompts(prompts: PromptDefinition[], storageDir: string): Promise<void>` — writes array to file; creates directory if needed
- Default storage dir: `~/.dt-eval/`

### 2. Custom prompt creation
`src/custom/index.ts`:

```ts
async function createCustomPrompt(
  input: CreateCustomPromptInput,
  config?: CustomPromptConfig
): Promise<PromptDefinition>
```

Flow:
1. **Validate** — name is non-empty, prompt is non-empty, scoring is valid (if provided)
2. **Generate ID** — kebab-case from name (e.g., "My Custom Metric" → `my-custom-metric`)
3. **Check conflicts** — reject if ID matches a built-in prompt
4. **Build PromptDefinition** — fill in defaults (version "1.0.0", scoring defaults to `CONTINUOUS_SCALE`, requiredFields defaults to `["input", "output"]`)
5. **Persist** — read existing custom prompts, append new one (reject duplicates), write back
6. **Register** — add to the prompt registry so it's available for `evaluate()`
7. **Return** the full `PromptDefinition`

```ts
async function deleteCustomPrompt(
  id: string,
  config?: CustomPromptConfig
): Promise<void>
```

Flow:
1. **Validate** — reject if ID matches a built-in prompt (can't delete built-ins)
2. **Read** — load existing custom prompts from storage
3. **Find & remove** — throw if not found
4. **Persist** — write updated array back to file
5. **Unregister** — remove from the prompt registry

```ts
async function loadCustomPrompts(
  config?: CustomPromptConfig
): Promise<PromptDefinition[]>
```

- Reads custom prompts from storage
- Registers each in the prompt registry
- Returns the loaded prompts

### 3. Auto-loading integration
Update `src/prompts/registry.ts`:
- Add `unregister(id: string): void` method to `PromptRegistry` for delete support
- On first `get()` or `list()` call, auto-load custom prompts from the default storage directory
- Lazy initialization — don't read the file system until needed
- Cache the loaded state

### 4. Update public API
`src/index.ts` — final exports:
- `evaluate`
- `createCustomPrompt`, `deleteCustomPrompt`, `loadCustomPrompts`
- `getPrompt`, `listPrompts`
- `BINARY_SCALE`, `CONTINUOUS_SCALE`, `LIKERT_SCALE`
- All types and error classes

### 5. README.md
Project README with:
- One-paragraph description
- Install command
- Quick start example (evaluate with a built-in metric)
- Custom prompt example
- API reference (brief, pointing to types)
- Configuration options
- Supported metrics table

## TDD Cycle Details

### Red Phase (write failing tests first)

```
tests/custom.test.ts:
  describe("createCustomPrompt()"):
    ✗ "creates a custom prompt with all fields"
    ✗ "generates kebab-case id from name"
    ✗ "applies default scoring (CONTINUOUS_SCALE) when not provided"
    ✗ "applies default requiredFields (['input', 'output']) when not provided"
    ✗ "sets version to '1.0.0'"
    ✗ "persists to custom-prompts.json in storage dir"
    ✗ "appends to existing custom prompts (doesn't overwrite)"
    ✗ "throws on empty name"
    ✗ "throws on empty prompt text"
    ✗ "throws if id conflicts with a built-in prompt"
    ✗ "throws if custom prompt with same id already exists"

  describe("deleteCustomPrompt()"):
    ✗ "deletes a custom prompt by id"
    ✗ "removes from storage file"
    ✗ "unregisters from registry"
    ✗ "throws if id is a built-in prompt"
    ✗ "throws if custom prompt not found"
    ✗ "deleted prompt no longer findable via getPrompt()"

  describe("loadCustomPrompts()"):
    ✗ "loads prompts from storage dir"
    ✗ "returns empty array when no file exists"
    ✗ "registers loaded prompts in the registry"
    ✗ "loaded prompts are findable via getPrompt()"

  describe("storage"):
    ✗ "readCustomPrompts returns [] for non-existent file"
    ✗ "writeCustomPrompts creates directory if needed"
    ✗ "roundtrip: write then read returns same data"

  describe("integration with evaluate()"):
    ✗ "evaluate() can use a custom prompt by string id (after creation)"
    ✗ "evaluate() throws EvalMetricError for unknown custom prompt before loading"

  describe("auto-loading"):
    ✗ "registry auto-loads custom prompts on first get() call"
    ✗ "auto-loaded prompts appear in listPrompts()"
```

**Note:** All file I/O tests use temporary directories (via `os.tmpdir()` or Vitest's temp dir utilities). No tests write to `~/.dt-eval/`.

### Green Phase (make tests pass)
- Implement `readCustomPrompts()` and `writeCustomPrompts()`
- Implement `createCustomPrompt()` with validation and persistence
- Implement `loadCustomPrompts()` with registry integration
- Update `PromptRegistry` for lazy auto-loading
- Wire up all public exports

### Refactor Phase
- Handle edge cases in file I/O (permissions, corrupt JSON)
- Ensure auto-loading doesn't cause issues if called multiple times
- Finalize and clean up all public API exports in `src/index.ts`
- Write README.md
- Final `npm run build` and `npm test` pass

## Commit
One commit: `feat: custom prompts with persistence and README`

## Verification
- All Red tests now pass (Green)
- `npm run build` succeeds
- README is accurate and examples are correct
- Full end-to-end flow: create custom prompt → load → evaluate with it (mocked LLM)
