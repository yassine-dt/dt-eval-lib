import type { CreateCustomPromptInput, CustomPromptConfig } from "./types.js";
import type { PromptDefinition } from "../prompts/types.js";
import { readCustomPrompts, writeCustomPrompts } from "./storage.js";
import { getRegistry } from "../prompts/index.js";
import { CONTINUOUS_SCALE } from "../scoring/scales.js";
import { EvalInputError, EvalMetricError } from "../errors.js";
import * as os from "node:os";
import * as path from "node:path";

const DEFAULT_STORAGE_DIR = path.join(os.homedir(), ".dt-eval");

function getStorageDir(config?: CustomPromptConfig): string {
  return config?.storageDir || DEFAULT_STORAGE_DIR;
}

function toKebabCase(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Create and persist a custom prompt.
 */
export async function createCustomPrompt(
  input: CreateCustomPromptInput,
  config?: CustomPromptConfig,
): Promise<PromptDefinition> {
  // Validate
  if (!input.name || input.name.trim() === "") {
    throw new EvalInputError("Custom prompt name cannot be empty");
  }
  if (!input.prompt || input.prompt.trim() === "") {
    throw new EvalInputError("Custom prompt text cannot be empty");
  }

  // Generate ID
  const id = toKebabCase(input.name);

  // Check conflicts with built-in prompts
  const registry = getRegistry();
  if (registry.hasBuiltIn(id)) {
    throw new EvalMetricError(
      `Cannot create custom prompt with id "${id}" — it conflicts with a built-in prompt.`,
    );
  }

  // Check for existing custom prompt with same ID
  if (registry.has(id)) {
    throw new EvalMetricError(
      `Custom prompt with id "${id}" already exists.`,
    );
  }

  // Build PromptDefinition
  const prompt: PromptDefinition = {
    id,
    name: input.name,
    version: "1.0.0",
    description: input.description || "",
    prompt: input.prompt,
    requiredFields: input.requiredFields || ["input", "output"],
    scoring: input.scoring || { ...CONTINUOUS_SCALE },
  };

  // Persist
  const storageDir = getStorageDir(config);
  const existing = await readCustomPrompts(storageDir);
  existing.push(prompt);
  await writeCustomPrompts(existing, storageDir);

  // Register
  registry.register(prompt);

  return prompt;
}

/**
 * Delete a custom prompt by id.
 */
export async function deleteCustomPrompt(
  id: string,
  config?: CustomPromptConfig,
): Promise<void> {
  const registry = getRegistry();

  // Can't delete built-in prompts
  if (registry.hasBuiltIn(id)) {
    throw new EvalMetricError(
      `Cannot delete built-in prompt "${id}".`,
    );
  }

  // Read storage
  const storageDir = getStorageDir(config);
  const existing = await readCustomPrompts(storageDir);
  const index = existing.findIndex((p) => p.id === id);

  if (index === -1) {
    throw new EvalMetricError(
      `Custom prompt "${id}" not found.`,
    );
  }

  // Remove and persist
  existing.splice(index, 1);
  await writeCustomPrompts(existing, storageDir);

  // Unregister
  registry.unregister(id);
}

/**
 * Load all custom prompts from storage and register them.
 */
export async function loadCustomPrompts(
  config?: CustomPromptConfig,
): Promise<PromptDefinition[]> {
  const storageDir = getStorageDir(config);
  const prompts = await readCustomPrompts(storageDir);
  const registry = getRegistry();

  for (const prompt of prompts) {
    if (!registry.has(prompt.id)) {
      registry.register(prompt);
    }
  }

  return prompts;
}
