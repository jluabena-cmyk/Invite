import OpenAI from "openai";

const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? "dummy";

if (!baseURL) {
  throw new Error("AI_INTEGRATIONS_OPENAI_BASE_URL is not set");
}

export const openai = new OpenAI({ baseURL, apiKey });
