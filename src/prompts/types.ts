import type { ScoringScale } from "../scoring/types.js";

export interface PromptDefinition {
  id: string;
  name: string;
  version: string;
  /** Description of what this metric evaluates */
  description: string;
  /** The evaluation prompt template — uses {{input}}, {{output}}, {{context}}, {{expected_output}} placeholders */
  prompt: string;
  /** Which input fields this prompt requires */
  requiredFields: ("input" | "output" | "context" | "expected_output")[];
  /** The scoring scale to use */
  scoring: ScoringScale;
}
