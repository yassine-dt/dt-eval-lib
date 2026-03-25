import type { EvalInput } from "../types.js";

/** Raw structured response from the LLM judge */
export interface LLMJudgeResponse {
  score_value: number;
  summary: string;
  reasoning: string;
}

/** Interface that each LLM provider must implement */
export interface LLMProvider {
  /** Send the evaluation prompt to the LLM and get structured output */
  evaluate(systemPrompt: string, input: EvalInput): Promise<LLMJudgeResponse>;
}
