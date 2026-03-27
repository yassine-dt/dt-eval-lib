import type { PromptDefinition } from "./types";
import { PromptRegistry } from "./registry";
import { EvalMetricError } from "../errors";

const registry = new PromptRegistry();

/**
 * Get a prompt definition by metric id.
 * Throws EvalMetricError if the metric is not found.
 */
export function getPrompt(id: string): PromptDefinition {
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
 * List all available prompt definitions.
 */
export function listPrompts(): PromptDefinition[] {
  return registry.list();
}
