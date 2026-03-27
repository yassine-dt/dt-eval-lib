import OpenAI from "openai";
import type { LLMProvider, LLMJudgeResponse, ProviderConfig } from "./types.js";
import { EvalTimeoutError, EvalResponseError } from "../../errors.js";

interface ResponseSchema {
  name: string;
  strict: boolean;
  schema: {
    type: string;
    properties: Record<string, { type: string; description: string }>;
    required: string[];
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

export class OpenAIProvider implements LLMProvider {
  private client: OpenAI;
  private model: string;
  private timeout: number;

  constructor(config: ProviderConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      timeout: config.timeout,
    });
    this.model = config.model;
    this.timeout = config.timeout;
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
      return this.validateResponse(parsed);
    } catch (error: any) {
      if (error instanceof EvalResponseError) throw error;
      if (error?.code === "ETIMEDOUT" || error?.type === "request-timeout") {
        throw new EvalTimeoutError(`OpenAI request timed out after ${this.timeout}ms`);
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
