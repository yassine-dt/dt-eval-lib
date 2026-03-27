import type { PromptDefinition } from "./types";
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
}
