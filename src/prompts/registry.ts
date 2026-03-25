import type { PromptDefinition } from "./types.js";
import { EvalMetricError } from "../errors.js";
import catalogData from "./catalog.json" with { type: "json" };

export class PromptRegistry {
  private prompts: Map<string, PromptDefinition>;
  private builtInIds: Set<string>;

  constructor() {
    this.prompts = new Map();
    this.builtInIds = new Set();
    for (const entry of catalogData as PromptDefinition[]) {
      this.prompts.set(entry.id, entry);
      this.builtInIds.add(entry.id);
    }
  }

  get(id: string): PromptDefinition | undefined {
    return this.prompts.get(id);
  }

  list(): PromptDefinition[] {
    return Array.from(this.prompts.values());
  }

  has(id: string): boolean {
    return this.prompts.has(id);
  }

  hasBuiltIn(id: string): boolean {
    return this.builtInIds.has(id);
  }

  register(prompt: PromptDefinition): void {
    if (this.prompts.has(prompt.id)) {
      throw new EvalMetricError(
        `Prompt with id "${prompt.id}" already exists. Cannot override built-in or existing prompts.`,
      );
    }
    this.prompts.set(prompt.id, prompt);
  }

  unregister(id: string): void {
    if (this.builtInIds.has(id)) {
      throw new EvalMetricError(
        `Cannot unregister built-in prompt "${id}".`,
      );
    }
    this.prompts.delete(id);
  }
}
