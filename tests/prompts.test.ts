import { describe, it, expect } from "vitest";
import { getPrompt, listPrompts } from "../src/prompts/index.js";
import { PromptRegistry } from "../src/prompts/registry.js";
import type { PromptDefinition } from "../src/prompts/types.js";

describe("prompt catalog", () => {
  it("loads all 13 built-in prompts", async () => {
    const prompts = await listPrompts();
    expect(prompts).toHaveLength(13);
  });

  it("each prompt has id, name, version, description, prompt, requiredFields, scoring", async () => {
    const prompts = await listPrompts();
    for (const p of prompts) {
      expect(p).toHaveProperty("id");
      expect(p).toHaveProperty("name");
      expect(p).toHaveProperty("version");
      expect(p).toHaveProperty("description");
      expect(p).toHaveProperty("prompt");
      expect(p).toHaveProperty("requiredFields");
      expect(p).toHaveProperty("scoring");
    }
  });

  it("each prompt has embedded scoring with type, range, and threshold", async () => {
    const prompts = await listPrompts();
    for (const p of prompts) {
      expect(p.scoring).toHaveProperty("type");
      expect(p.scoring).toHaveProperty("range");
      expect(p.scoring).toHaveProperty("threshold");
      expect(["binary", "continuous", "likert"]).toContain(p.scoring.type);
      expect(p.scoring.range).toHaveLength(2);
    }
  });

  it("toxicity has binary scoring with threshold 1", async () => {
    const p = await getPrompt("toxicity");
    expect(p.scoring.type).toBe("binary");
    expect(p.scoring.threshold).toBe(1);
  });

  it("faithfulness has continuous scoring with threshold 0.5", async () => {
    const p = await getPrompt("faithfulness");
    expect(p.scoring.type).toBe("continuous");
    expect(p.scoring.threshold).toBe(0.5);
  });

  it("coherence has likert scoring with threshold 3", async () => {
    const p = await getPrompt("coherence");
    expect(p.scoring.type).toBe("likert");
    expect(p.scoring.threshold).toBe(3);
  });

  it("toxicity prompt requires input and output", async () => {
    const p = await getPrompt("toxicity");
    expect(p.requiredFields).toEqual(["input", "output"]);
  });

  it("faithfulness prompt requires input, output, and context", async () => {
    const p = await getPrompt("faithfulness");
    expect(p.requiredFields).toEqual(["input", "output", "context"]);
  });

  it("hallucination prompt requires input, output, and context", async () => {
    const p = await getPrompt("hallucination");
    expect(p.requiredFields).toEqual(["input", "output", "context"]);
  });

  it("pii-leakage prompt requires input and output", async () => {
    const p = await getPrompt("pii-leakage");
    expect(p.requiredFields).toEqual(["input", "output"]);
  });

  it("relevance prompt requires input and output", async () => {
    const p = await getPrompt("relevance");
    expect(p.requiredFields).toEqual(["input", "output"]);
  });

  it("factual-accuracy prompt requires input, output, and expected_output", async () => {
    const p = await getPrompt("factual-accuracy");
    expect(p.requiredFields).toEqual(["input", "output", "expected_output"]);
  });

  it("coherence prompt requires input and output", async () => {
    const p = await getPrompt("coherence");
    expect(p.requiredFields).toEqual(["input", "output"]);
  });

  it("each prompt contains placeholder tokens matching its requiredFields", async () => {
    const prompts = await listPrompts();
    for (const p of prompts) {
      for (const field of p.requiredFields) {
        expect(p.prompt).toContain(`{{${field}}}`);
      }
    }
  });
});

describe("getPrompt", () => {
  it("returns prompt by id", async () => {
    const p = await getPrompt("toxicity");
    expect(p.id).toBe("toxicity");
    expect(p.name).toBe("Toxicity");
  });

  it("throws EvalMetricError for unknown id", async () => {
    const { EvalMetricError } = await import("../src/errors.js");
    await expect(getPrompt("nonexistent")).rejects.toBeInstanceOf(EvalMetricError);
  });

  it("error message lists available metrics", async () => {
    try {
      await getPrompt("nonexistent");
    } catch (e: any) {
      expect(e.message).toContain("toxicity");
      expect(e.message).toContain("faithfulness");
    }
  });
});

describe("listPrompts", () => {
  it("returns all 14 prompts", async () => {
    const prompts = await listPrompts();
    expect(prompts).toHaveLength(13);
  });

  it("getPrompt and listPrompts are async", () => {
    expect(getPrompt("toxicity")).toBeInstanceOf(Promise);
    expect(listPrompts()).toBeInstanceOf(Promise);
  });
});

describe("registry", () => {
  it("has() returns true for built-in prompts", () => {
    const registry = new PromptRegistry();
    expect(registry.has("toxicity")).toBe(true);
  });

  it("has() returns false for unknown prompts", () => {
    const registry = new PromptRegistry();
    expect(registry.has("nonexistent")).toBe(false);
  });

  it("register() adds a new prompt", () => {
    const registry = new PromptRegistry();
    const custom: PromptDefinition = {
      id: "custom-test",
      name: "Custom Test",
      version: "1.0.0",
      description: "A test prompt",
      prompt: "Evaluate {{input}} and {{output}}",
      requiredFields: ["input", "output"],
      scoring: { type: "binary", range: [0, 1], threshold: 1 },
    };
    registry.register(custom);
    expect(registry.has("custom-test")).toBe(true);
    expect(registry.get("custom-test")).toEqual(custom);
  });

  it("register() throws if id already exists", () => {
    const registry = new PromptRegistry();
    const duplicate: PromptDefinition = {
      id: "toxicity",
      name: "Dupe",
      version: "1.0.0",
      description: "Duplicate",
      prompt: "test",
      requiredFields: ["input", "output"],
      scoring: { type: "binary", range: [0, 1], threshold: 1 },
    };
    expect(() => registry.register(duplicate)).toThrow();
  });
});
