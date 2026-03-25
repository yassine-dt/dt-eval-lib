import type { PromptDefinition } from "./types.js";
import { PromptRegistry } from "./registry.js";
import { EvalMetricError } from "../errors.js";

const registry = new PromptRegistry();

/** Get the singleton registry instance (for internal use by custom module) */
export function getRegistry(): PromptRegistry {
  return registry;
}

/**
 * Get a prompt definition by metric id.
 * Throws EvalMetricError if the metric is not found.
 */
export async function getPrompt(id: string): Promise<PromptDefinition> {
  const prompt = registry.get(id);
  if (!prompt) {
    const available = registry.list().map((p) => p.id).join(", ");
    throw new EvalMetricError(
      `Unknown metric "${id}". Available metrics: ${available}`,
    );
  }
  return prompt;
}

/**
 * List all available prompt definitions (built-in + custom).
 */
export async function listPrompts(): Promise<PromptDefinition[]> {
  return registry.list();
}

export { PromptRegistry } from "./registry.js";
export type { PromptDefinition } from "./types.js";
