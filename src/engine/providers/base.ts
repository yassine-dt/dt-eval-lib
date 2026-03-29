import type { LLMProvider, ProviderConfig, LLMJudgeResponse } from "./types";

export abstract class BaseProvider implements LLMProvider {
  protected readonly apiKey: string;
  protected readonly model: string;
  protected readonly timeout: number;
  protected readonly maxRetries: number;
  protected readonly baseUrl?: string;

  constructor(config: ProviderConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.timeout = config.timeout;
    this.maxRetries = config.maxRetries;
    this.baseUrl = config.baseUrl;
  }

  abstract call(prompt: string): Promise<LLMJudgeResponse>;
}
