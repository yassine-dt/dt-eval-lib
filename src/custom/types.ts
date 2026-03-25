import type { ScoringScale } from "../scoring/types.js";

export interface CreateCustomPromptInput {
  name: string;
  prompt: string;
  /** Optional — defaults to "continuous" */
  scoring?: ScoringScale;
  /** Optional — defaults to ["input", "output"] */
  requiredFields?: ("input" | "output" | "context" | "expected_output")[];
  description?: string;
}

export interface CustomPromptConfig {
  /** Directory for custom prompt storage — default: ~/.dt-eval/ */
  storageDir?: string;
}
