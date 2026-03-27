import type { PromptDefinition } from "./types";
import { catalog } from "./catalog-data";

export class PromptRegistry {
  private prompts: Map<string, PromptDefinition>;

  constructor() {
    this.prompts = new Map();
    for (const entry of catalog) {
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
