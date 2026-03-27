import type { ProviderOptions } from "../types";
import type { LLMProvider } from "./types";
import { OpenAIProvider } from "./openai";
import { AnthropicProvider } from "./anthropic";
import { EvalConfigError } from "../../errors";

const DEFAULT_MODELS: Record<string, string> = {
  openai: "gpt-5.1",
  anthropic: "claude-sonnet-4-20250514",
};

const ENV_KEYS: Record<string, string> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
};

const ENV_BASE_URL_KEYS: Record<string, string> = {
  openai: "OPENAI_BASE_URL",
  anthropic: "ANTHROPIC_BASE_URL",
};

export function createProvider(options: ProviderOptions): LLMProvider {
  const apiKey = options.apiKey || process.env[ENV_KEYS[options.provider]];

  if (!apiKey) {
    throw new EvalConfigError(
      `Missing API key for ${options.provider}. Provide it via provider.apiKey or set the ${ENV_KEYS[options.provider]} environment variable.`,
    );
  }

  const baseUrl = options.baseUrl || process.env[ENV_BASE_URL_KEYS[options.provider]];
  const model = options.model || DEFAULT_MODELS[options.provider];
  const timeout = options.timeout ?? 30000;
  const maxRetries = options.maxRetries ?? 2;
  const providerConfig = { apiKey, model, timeout, maxRetries, baseUrl };

  switch (options.provider) {
    case "openai":
      return new OpenAIProvider(providerConfig);
    case "anthropic":
      return new AnthropicProvider(providerConfig);
    default:
      throw new EvalConfigError(`Unknown provider: ${options.provider}`);
  }
}
