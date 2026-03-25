import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

import {
  createCustomPrompt,
  deleteCustomPrompt,
  loadCustomPrompts,
} from "../src/custom/index.js";
import { readCustomPrompts, writeCustomPrompts } from "../src/custom/storage.js";
import { getPrompt, listPrompts } from "../src/prompts/index.js";
import { evaluate } from "../src/engine/index.js";
import { createProvider } from "../src/engine/providers/index.js";
import { EvalMetricError, EvalInputError } from "../src/errors.js";
import type { PromptDefinition } from "../src/prompts/types.js";
import type { LLMProvider } from "../src/engine/providers/types.js";

// Mock provider for evaluate integration tests
vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: { completions: { create: vi.fn() } },
  })),
}));
vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: vi.fn() },
  })),
}));
vi.mock("../src/engine/providers/index.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/engine/providers/index.js")>();
  return { ...actual, createProvider: vi.fn(actual.createProvider) };
});

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "dt-eval-test-"));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("createCustomPrompt()", () => {
  it("creates a custom prompt with all fields", async () => {
    const result = await createCustomPrompt(
      {
        name: "My Test Metric",
        prompt: "Evaluate {{input}} and {{output}}",
        description: "A test metric",
        scoring: { type: "binary", range: [0, 1], threshold: 1 },
        requiredFields: ["input", "output"],
      },
      { storageDir: tmpDir },
    );
    expect(result.id).toBe("my-test-metric");
    expect(result.name).toBe("My Test Metric");
    expect(result.prompt).toBe("Evaluate {{input}} and {{output}}");
    expect(result.description).toBe("A test metric");
    expect(result.scoring.type).toBe("binary");
    expect(result.requiredFields).toEqual(["input", "output"]);
  });

  it("generates kebab-case id from name", async () => {
    const result = await createCustomPrompt(
      { name: "My Custom Metric", prompt: "test {{input}} {{output}}" },
      { storageDir: tmpDir },
    );
    expect(result.id).toBe("my-custom-metric");
  });

  it("applies default scoring (CONTINUOUS_SCALE) when not provided", async () => {
    const result = await createCustomPrompt(
      { name: "Default Score", prompt: "test {{input}} {{output}}" },
      { storageDir: tmpDir },
    );
    expect(result.scoring).toEqual({
      type: "continuous",
      range: [0, 1],
      threshold: 0.5,
    });
  });

  it("applies default requiredFields (['input', 'output']) when not provided", async () => {
    const result = await createCustomPrompt(
      { name: "Default Fields", prompt: "test {{input}} {{output}}" },
      { storageDir: tmpDir },
    );
    expect(result.requiredFields).toEqual(["input", "output"]);
  });

  it("sets version to '1.0.0'", async () => {
    const result = await createCustomPrompt(
      { name: "Versioned", prompt: "test {{input}} {{output}}" },
      { storageDir: tmpDir },
    );
    expect(result.version).toBe("1.0.0");
  });

  it("persists to custom-prompts.json in storage dir", async () => {
    await createCustomPrompt(
      { name: "Persisted", prompt: "test {{input}} {{output}}" },
      { storageDir: tmpDir },
    );
    const filePath = path.join(tmpDir, "custom-prompts.json");
    const content = await fs.readFile(filePath, "utf-8");
    const data = JSON.parse(content);
    expect(data).toHaveLength(1);
    expect(data[0].id).toBe("persisted");
  });

  it("appends to existing custom prompts (doesn't overwrite)", async () => {
    await createCustomPrompt(
      { name: "First", prompt: "test {{input}} {{output}}" },
      { storageDir: tmpDir },
    );
    await createCustomPrompt(
      { name: "Second", prompt: "test {{input}} {{output}}" },
      { storageDir: tmpDir },
    );
    const filePath = path.join(tmpDir, "custom-prompts.json");
    const data = JSON.parse(await fs.readFile(filePath, "utf-8"));
    expect(data).toHaveLength(2);
  });

  it("throws on empty name", async () => {
    await expect(
      createCustomPrompt({ name: "", prompt: "test" }, { storageDir: tmpDir }),
    ).rejects.toThrow();
  });

  it("throws on empty prompt text", async () => {
    await expect(
      createCustomPrompt({ name: "Valid", prompt: "" }, { storageDir: tmpDir }),
    ).rejects.toThrow();
  });

  it("throws if id conflicts with a built-in prompt", async () => {
    await expect(
      createCustomPrompt(
        { name: "Toxicity", prompt: "test {{input}} {{output}}" },
        { storageDir: tmpDir },
      ),
    ).rejects.toThrow();
  });

  it("throws if custom prompt with same id already exists", async () => {
    await createCustomPrompt(
      { name: "Duplicate", prompt: "test {{input}} {{output}}" },
      { storageDir: tmpDir },
    );
    await expect(
      createCustomPrompt(
        { name: "Duplicate", prompt: "test {{input}} {{output}}" },
        { storageDir: tmpDir },
      ),
    ).rejects.toThrow();
  });
});

describe("deleteCustomPrompt()", () => {
  it("deletes a custom prompt by id", async () => {
    await createCustomPrompt(
      { name: "To Delete", prompt: "test {{input}} {{output}}" },
      { storageDir: tmpDir },
    );
    await deleteCustomPrompt("to-delete", { storageDir: tmpDir });
    const prompts = await readCustomPrompts(tmpDir);
    expect(prompts).toHaveLength(0);
  });

  it("removes from storage file", async () => {
    await createCustomPrompt(
      { name: "Keep", prompt: "test {{input}} {{output}}" },
      { storageDir: tmpDir },
    );
    await createCustomPrompt(
      { name: "Remove", prompt: "test {{input}} {{output}}" },
      { storageDir: tmpDir },
    );
    await deleteCustomPrompt("remove", { storageDir: tmpDir });
    const prompts = await readCustomPrompts(tmpDir);
    expect(prompts).toHaveLength(1);
    expect(prompts[0].id).toBe("keep");
  });

  it("unregisters from registry", async () => {
    const prompt = await createCustomPrompt(
      { name: "Unreg Test", prompt: "test {{input}} {{output}}" },
      { storageDir: tmpDir },
    );
    // Should be findable
    const found = await getPrompt("unreg-test");
    expect(found.id).toBe("unreg-test");
    // Delete
    await deleteCustomPrompt("unreg-test", { storageDir: tmpDir });
    // Should no longer be findable
    await expect(getPrompt("unreg-test")).rejects.toBeInstanceOf(EvalMetricError);
  });

  it("throws if id is a built-in prompt", async () => {
    await expect(
      deleteCustomPrompt("toxicity", { storageDir: tmpDir }),
    ).rejects.toThrow();
  });

  it("throws if custom prompt not found", async () => {
    await expect(
      deleteCustomPrompt("nonexistent", { storageDir: tmpDir }),
    ).rejects.toThrow();
  });

  it("deleted prompt no longer findable via getPrompt()", async () => {
    await createCustomPrompt(
      { name: "Ephemeral", prompt: "test {{input}} {{output}}" },
      { storageDir: tmpDir },
    );
    await deleteCustomPrompt("ephemeral", { storageDir: tmpDir });
    await expect(getPrompt("ephemeral")).rejects.toBeInstanceOf(EvalMetricError);
  });
});

describe("loadCustomPrompts()", () => {
  it("loads prompts from storage dir", async () => {
    // Write directly to file
    const prompt: PromptDefinition = {
      id: "loaded-metric",
      name: "Loaded Metric",
      version: "1.0.0",
      description: "A loaded metric",
      prompt: "test {{input}} {{output}}",
      requiredFields: ["input", "output"],
      scoring: { type: "binary", range: [0, 1], threshold: 1 },
    };
    await writeCustomPrompts([prompt], tmpDir);
    const loaded = await loadCustomPrompts({ storageDir: tmpDir });
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe("loaded-metric");
  });

  it("returns empty array when no file exists", async () => {
    const emptyDir = await fs.mkdtemp(path.join(os.tmpdir(), "dt-eval-empty-"));
    try {
      const loaded = await loadCustomPrompts({ storageDir: emptyDir });
      expect(loaded).toEqual([]);
    } finally {
      await fs.rm(emptyDir, { recursive: true, force: true });
    }
  });

  it("registers loaded prompts in the registry", async () => {
    const prompt: PromptDefinition = {
      id: "reg-loaded",
      name: "Registry Loaded",
      version: "1.0.0",
      description: "Test",
      prompt: "test {{input}} {{output}}",
      requiredFields: ["input", "output"],
      scoring: { type: "binary", range: [0, 1], threshold: 1 },
    };
    await writeCustomPrompts([prompt], tmpDir);
    await loadCustomPrompts({ storageDir: tmpDir });
    const found = await getPrompt("reg-loaded");
    expect(found.id).toBe("reg-loaded");
  });

  it("loaded prompts are findable via getPrompt()", async () => {
    const prompt: PromptDefinition = {
      id: "findable",
      name: "Findable",
      version: "1.0.0",
      description: "Test",
      prompt: "test {{input}} {{output}}",
      requiredFields: ["input", "output"],
      scoring: { type: "continuous", range: [0, 1], threshold: 0.5 },
    };
    await writeCustomPrompts([prompt], tmpDir);
    await loadCustomPrompts({ storageDir: tmpDir });
    const found = await getPrompt("findable");
    expect(found.name).toBe("Findable");
  });
});

describe("storage", () => {
  it("readCustomPrompts returns [] for non-existent file", async () => {
    const result = await readCustomPrompts(tmpDir);
    expect(result).toEqual([]);
  });

  it("writeCustomPrompts creates directory if needed", async () => {
    const nestedDir = path.join(tmpDir, "nested", "dir");
    const prompt: PromptDefinition = {
      id: "nested-test",
      name: "Nested",
      version: "1.0.0",
      description: "Test",
      prompt: "test",
      requiredFields: ["input", "output"],
      scoring: { type: "binary", range: [0, 1], threshold: 1 },
    };
    await writeCustomPrompts([prompt], nestedDir);
    const filePath = path.join(nestedDir, "custom-prompts.json");
    const exists = await fs.access(filePath).then(() => true).catch(() => false);
    expect(exists).toBe(true);
  });

  it("roundtrip: write then read returns same data", async () => {
    const prompts: PromptDefinition[] = [
      {
        id: "roundtrip",
        name: "Roundtrip",
        version: "1.0.0",
        description: "Test",
        prompt: "test {{input}} {{output}}",
        requiredFields: ["input", "output"],
        scoring: { type: "continuous", range: [0, 1], threshold: 0.5 },
      },
    ];
    await writeCustomPrompts(prompts, tmpDir);
    const loaded = await readCustomPrompts(tmpDir);
    expect(loaded).toEqual(prompts);
  });
});

describe("integration with evaluate()", () => {
  it("evaluate() can use a custom prompt by string id (after creation)", async () => {
    const mockProv: LLMProvider = {
      call: vi.fn().mockResolvedValue({
        scoreValue: 0.9,
        summary: "good",
        reasoning: "solid",
      }),
    };
    vi.mocked(createProvider).mockReturnValue(mockProv);

    await createCustomPrompt(
      {
        name: "Eval Integration",
        prompt: "Evaluate: {{input}} → {{output}}",
        scoring: { type: "continuous", range: [0, 1], threshold: 0.5 },
      },
      { storageDir: tmpDir },
    );

    const result = await evaluate("eval-integration", {
      input: "test input",
      output: "test output",
    }, {
      provider: "openai",
      apiKey: "test-key",
    });

    expect(result.score.value).toBe(0.9);
    expect(result.score.label).toBe("pass");
  });

  it("evaluate() throws EvalMetricError for unknown custom prompt before loading", async () => {
    vi.mocked(createProvider).mockReturnValue({
      call: vi.fn().mockResolvedValue({ scoreValue: 1, summary: "ok", reasoning: "ok" }),
    });
    await expect(
      evaluate("never-created", { input: "a", output: "b" }, {
        provider: "openai",
        apiKey: "test-key",
      }),
    ).rejects.toBeInstanceOf(EvalMetricError);
  });
});
