import Anthropic from "@anthropic-ai/sdk";
import type { LLMProvider, LLMJudgeResponse, ProviderConfig } from "./types";
import { EvalTimeoutError, EvalResponseError } from "../../errors";
import { validateLLMResponse } from "./validate";

interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: string;
    properties: Record<string, { type: string; description: string }>;
    required: readonly string[];
  };
}

const EVAL_TOOL = {
  name: "submit_evaluation",
  description: "Submit the evaluation result with score, summary, and reasoning",
  input_schema: {
    type: "object",
    properties: {
      scoreValue: { type: "number", description: "The evaluation score" },
      summary: { type: "string", description: "Brief summary of the evaluation" },
      reasoning: { type: "string", description: "Detailed reasoning for the score" },
    },
    required: ["scoreValue", "summary", "reasoning"],
  },
} as const satisfies ToolDefinition;

export class AnthropicProvider implements LLMProvider {
  private client: Anthropic;
  private model: string;
  private timeout: number;

  constructor(config: ProviderConfig) {
    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      timeout: config.timeout,
    });
    this.model = config.model;
    this.timeout = config.timeout;
  }

  async call(prompt: string): Promise<LLMJudgeResponse> {
    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1024,
        system: "You are an expert LLM evaluation judge. Use the submit_evaluation tool to return your evaluation.",
        messages: [{ role: "user", content: prompt }],
        tools: [EVAL_TOOL],
        tool_choice: { type: "tool", name: "submit_evaluation" },
      });

      const toolBlock = response.content.find(
        (block): block is Anthropic.Messages.ToolUseBlock =>
          block.type === "tool_use" && block.name === "submit_evaluation",
      );
      if (!toolBlock) {
        throw new EvalResponseError("Anthropic did not return the expected tool use response");
      }

      return validateLLMResponse(toolBlock.input);
    } catch (error: unknown) {
      if (error instanceof EvalResponseError) throw error;
      const err = typeof error === "object" && error !== null ? (error as Record<string, unknown>) : {};
      const nested = typeof err.error === "object" && err.error !== null ? (err.error as Record<string, unknown>) : undefined;
      if (err.code === "ETIMEDOUT" || nested?.type === "timeout") {
        throw new EvalTimeoutError(`Anthropic request timed out after ${this.timeout}ms`);
      }
      throw error;
    }
  }
}
