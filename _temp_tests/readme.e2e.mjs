#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function stripWrappingQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function loadDotEnv() {
  const envPath = resolve(__dirname, "../.env");
  if (!existsSync(envPath)) {
    return;
  }

  const content = readFileSync(envPath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = stripWrappingQuotes(line.slice(separatorIndex + 1).trim());

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function getFlag(name) {
  const direct = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (direct) {
    return direct.slice(name.length + 3);
  }

  const index = process.argv.findIndex((arg) => arg === `--${name}`);
  if (index >= 0) {
    return process.argv[index + 1];
  }

  return undefined;
}

function assertResultShape(label, result) {
  if (typeof result?.score?.value !== "number") {
    throw new Error(`${label}: expected score.value to be a number`);
  }

  if (typeof result?.score?.label !== "string") {
    throw new Error(`${label}: expected score.label to be a string`);
  }

  if (typeof result?.explanation?.summary !== "string") {
    throw new Error(`${label}: expected explanation.summary to be a string`);
  }

  if (typeof result?.explanation?.reasoning !== "string") {
    throw new Error(`${label}: expected explanation.reasoning to be a string`);
  }
}

function resolveProvider() {
  const provider = getFlag("provider") ?? process.env.EVAL_PROVIDER ?? "openai";

  if (provider !== "openai" && provider !== "anthropic") {
    throw new Error(`Unsupported provider \"${provider}\". Use openai or anthropic.`);
  }

  return provider;
}

function resolveApiKey(provider) {
  const explicitApiKey = getFlag("api-key");
  if (explicitApiKey) {
    return explicitApiKey;
  }

  const envKey = provider === "anthropic" ? "ANTHROPIC_API_KEY" : "OPENAI_API_KEY";
  const apiKey = process.env[envKey];
  if (!apiKey) {
    throw new Error(`Missing API key. Set ${envKey} or pass --api-key.`);
  }

  return apiKey;
}

function resolveBaseUrl(provider) {
  const explicitBaseUrl = getFlag("base-url");
  if (explicitBaseUrl) {
    return explicitBaseUrl;
  }

  const envKey = provider === "anthropic" ? "ANTHROPIC_BASE_URL" : "OPENAI_BASE_URL";
  return process.env[envKey];
}

function maskApiKey(apiKey) {
  if (apiKey.length <= 8) {
    return "********";
  }

  return `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`;
}

async function loadLibrary() {
  const distEntry = resolve(__dirname, "../dist/index.js");
  if (!existsSync(distEntry)) {
    throw new Error("Build output not found at dist/index.js. Run npm run build first.");
  }

  return import(pathToFileURL(distEntry).href);
}

async function probeEndpoint(baseUrl, apiKey) {
  const url = baseUrl.replace(/\/$/, "") + "/models";
  console.log(`\nProbing endpoint: GET ${url}`);
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });
    console.log(`Probe response status: ${res.status} ${res.statusText}`);
    if (res.status === 401) {
      throw new Error(
        `401 Unauthorized — the API key is not accepted by this endpoint.\n` +
        `Make sure the key in OPENAI_API_KEY is issued by or allowed for:\n  ${baseUrl}`,
      );
    }
    if (!res.ok) {
      throw new Error(`Endpoint probe failed with status ${res.status}`);
    }
    const json = await res.json();
    const modelIds = (json?.data ?? []).map((m) => m.id);
    console.log(`Available models (${modelIds.length}): ${modelIds.join(", ")}`);
    console.log("Endpoint probe succeeded.\n");
    return modelIds;
  } catch (err) {
    if (err.message.startsWith("401")) throw err;
    throw new Error(`Endpoint unreachable: ${err.message}`);
  }
}

async function main() {
  loadDotEnv();

  const provider = resolveProvider();
  const apiKey = resolveApiKey(provider);
  const baseUrl = resolveBaseUrl(provider);
  const { evaluate, getPrompt, listPrompts } = await loadLibrary();

  const quickInput = {
    input: getFlag("input") ?? "Tell me a joke",
    output:
      getFlag("output") ??
      "Why did the chicken cross the road? To get to the other side!",
  };

  const config = {
    provider,
    apiKey,
    ...(baseUrl ? { baseUrl } : {}),
  };

  const explicitModel = getFlag("model");

  console.log(`Running README end-to-end script with provider: ${provider}`);
  console.log(`Using API key: ${maskApiKey(apiKey)}`);
  if (baseUrl) {
    console.log(`Using base URL: ${baseUrl}`);
    const availableModels = await probeEndpoint(baseUrl, apiKey);
    const DEFAULT_MODEL = "gpt-4o";
    const modelToUse = explicitModel ?? DEFAULT_MODEL;
    if (
      availableModels.length > 0 &&
      !availableModels.includes(modelToUse)
    ) {
      const suggested = availableModels[0];
      console.warn(
        `WARNING: Model "${modelToUse}" is not in the available model list.`,
      );
      console.warn(
        `Suggested: pass --model ${suggested} (or one of: ${availableModels.slice(0, 4).join(", ")})`,
      );
      process.exitCode = 1;
      return;
    }
    if (explicitModel) {
      config.model = explicitModel;
    }
  }

  const prompts = await listPrompts();
  console.log(`Loaded ${prompts.length} prompt definitions.`);

  const toxicityPrompt = await getPrompt("toxicity");
  console.log(`Resolved prompt: ${toxicityPrompt.id} (${toxicityPrompt.name})`);

  const quickUsageResult = await evaluate("toxicity", quickInput, config);
  assertResultShape("quick usage evaluate(\"toxicity\")", quickUsageResult);

  const promptObjectResult = await evaluate(toxicityPrompt, quickInput, config);
  assertResultShape("prompt object evaluate(prompt)", promptObjectResult);

  console.log("Quick usage result:");
  console.log(JSON.stringify(quickUsageResult, null, 2));

  console.log("Prompt object result:");
  console.log(JSON.stringify(promptObjectResult, null, 2));

  console.log("README end-to-end script completed successfully.");
}

main().catch((error) => {
  console.error("README end-to-end script failed.");
  if (error?.status === 401) {
    console.error("401 Unauthorized from provider endpoint.");
    console.error("Check that the API key matches the selected base URL and provider.");
  }
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
