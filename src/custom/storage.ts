import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { PromptDefinition } from "../prompts/types.js";

const FILENAME = "custom-prompts.json";

/**
 * Read custom prompts from storage directory.
 * Returns empty array if file doesn't exist.
 */
export async function readCustomPrompts(
  storageDir: string,
): Promise<PromptDefinition[]> {
  const filePath = path.join(storageDir, FILENAME);
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content) as PromptDefinition[];
  } catch (error: any) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

/**
 * Write custom prompts to storage directory.
 * Creates directory if it doesn't exist.
 */
export async function writeCustomPrompts(
  prompts: PromptDefinition[],
  storageDir: string,
): Promise<void> {
  await fs.mkdir(storageDir, { recursive: true });
  const filePath = path.join(storageDir, FILENAME);
  await fs.writeFile(filePath, JSON.stringify(prompts, null, 2), "utf-8");
}
