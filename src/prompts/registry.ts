import type { PromptDefinition } from "./types.js";
import { EvalMetricError } from "../errors.js";
import catalogData from "./catalog.json" with { type: "json" };

export class PromptRegistry {
  private prompts: Map<string, PromptDefinition>;

  constructor() {
    this.prompts = new Map();
    for (const entry of catalogData as PromptDefinition[]) {
      this.prompts.set(entry.id, entry);
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

  register(prompt: PromptDefinition): void {
    if (this.prompts.has(prompt.id)) {
      throw new EvalMetricError(
        `Prompt with id "${prompt.id}" already exists. Cannot override built-in or existing prompts.`,
      );
    }
    this.prompts.set(prompt.id, prompt);
  }
}
