import OpenAI from "openai";
import type { LLMJudgeResponse, ProviderConfig } from "./types";
import { BaseProvider } from "./base";
import { EvalTimeoutError, EvalResponseError } from "../../errors";
import { validateLLMResponse } from "./validate";

interface ResponseSchema {
  name: string;
  strict: boolean;
  schema: {
    type: string;
    properties: Record<string, { type: string; description: string }>;
    required: readonly string[];
    additionalProperties: boolean;
  };
}

const RESPONSE_SCHEMA = {
  name: "eval_response",
  strict: true,
  schema: {
    type: "object",
    properties: {
      scoreValue: { type: "number", description: "The evaluation score" },
      summary: { type: "string", description: "Brief summary of the evaluation" },
      reasoning: { type: "string", description: "Detailed reasoning for the score" },
    },
    required: ["scoreValue", "summary", "reasoning"],
    additionalProperties: false,
  },
} as const satisfies ResponseSchema;

export class OpenAIProvider extends BaseProvider {
  private client: OpenAI;

  constructor(config: ProviderConfig) {
    super(config);
    this.client = new OpenAI({
      apiKey: this.apiKey,
      baseURL: this.baseUrl,
      timeout: this.timeout,
    });
  }

  async call(prompt: string): Promise<LLMJudgeResponse> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: "system",
            content: "You are an expert LLM evaluation judge. Respond only with the requested JSON structure.",
          },
          { role: "user", content: prompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: RESPONSE_SCHEMA,
        },
        temperature: 0,
      });

      const content = response.choices?.[0]?.message?.content;
      if (!content) {
        throw new EvalResponseError("OpenAI returned an empty response");
      }

      const parsed = JSON.parse(content);
      return validateLLMResponse(parsed);
    } catch (error: unknown) {
      if (error instanceof EvalResponseError) throw error;
      const err = typeof error === "object" && error !== null ? (error as Record<string, unknown>) : {};
      if (err.code === "ETIMEDOUT" || err.type === "request-timeout") {
        throw new EvalTimeoutError(`OpenAI request timed out after ${this.timeout}ms`);
      }
      throw error;
    }
  }
}
