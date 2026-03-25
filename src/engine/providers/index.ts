import type { EvalConfig } from "../types.js";
import type { LLMProvider } from "./types.js";
import { OpenAIProvider } from "./openai.js";
import { AnthropicProvider } from "./anthropic.js";
import { EvalConfigError } from "../../errors.js";

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

export function createProvider(config: EvalConfig): LLMProvider {
  const apiKey = config.apiKey || process.env[ENV_KEYS[config.provider]];

  if (!apiKey) {
    throw new EvalConfigError(
      `Missing API key for ${config.provider}. Provide it via config.apiKey or set the ${ENV_KEYS[config.provider]} environment variable.`,
    );
  }

  const baseUrl = config.baseUrl || process.env[ENV_BASE_URL_KEYS[config.provider]];
  const model = config.model || DEFAULT_MODELS[config.provider];
  const timeout = config.timeout ?? 30000;
  const maxRetries = config.maxRetries ?? 2;
  const providerConfig = { apiKey, model, timeout, maxRetries, baseUrl };

  switch (config.provider) {
    case "openai":
      return new OpenAIProvider(providerConfig);
    case "anthropic":
      return new AnthropicProvider(providerConfig);
    default:
      throw new EvalConfigError(`Unknown provider: ${config.provider}`);
  }
}
