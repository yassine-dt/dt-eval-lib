import Anthropic from "@anthropic-ai/sdk";
import type { LLMProvider, LLMJudgeResponse, ProviderConfig } from "./types.js";
import { EvalTimeoutError, EvalResponseError } from "../../errors.js";

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
        (block: any) => block.type === "tool_use" && block.name === "submit_evaluation",
      );
      if (!toolBlock || toolBlock.type !== "tool_use") {
        throw new EvalResponseError("Anthropic did not return the expected tool use response");
      }

      return this.validateResponse(toolBlock.input);
    } catch (error: any) {
      if (error instanceof EvalResponseError) throw error;
      if (error?.code === "ETIMEDOUT" || error?.error?.type === "timeout") {
        throw new EvalTimeoutError(`Anthropic request timed out after ${this.timeout}ms`);
      }
      throw error;
    }
  }

  private validateResponse(parsed: any): LLMJudgeResponse {
    if (
      typeof parsed.scoreValue !== "number" ||
      typeof parsed.summary !== "string" ||
      typeof parsed.reasoning !== "string"
    ) {
      throw new EvalResponseError(
        `Malformed LLM response: expected { scoreValue: number, summary: string, reasoning: string }, got ${JSON.stringify(parsed)}`,
      );
    }
    return {
      scoreValue: parsed.scoreValue,
      summary: parsed.summary,
      reasoning: parsed.reasoning,
    };
  }
}
