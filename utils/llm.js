import OpenAI from "openai";
import { OPENAI_API_KEY, LLM_TIMEOUT_MS, LLM_MAX_RETRIES } from "../config/env.js";
import { LLMError, LLMTimeoutError, LLMParseError } from "./errors.js";

export const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const BACKOFF_MS = [500, 1500, 4000]; // delay before each retry attempt

/**
 * Strip markdown fences and leading/trailing whitespace so JSON.parse works
 * even when the model wraps its response in ```json ... ```.
 */
export function cleanJSON(raw) {
  let text = raw.trim();
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  return text.trim();
}

/**
 * Core LLM call with per-attempt timeout (AbortController) and exponential
 * backoff between retries.  Throws typed errors on all failure paths.
 */
export async function callLLM(messages) {
  let lastErr;

  for (let attempt = 0; attempt < LLM_MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await new Promise(r => setTimeout(r, BACKOFF_MS[attempt - 1] ?? 4000));
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

    try {
      const response = await openai.chat.completions.create(
        { model: "gpt-4.1", messages, temperature: 0.3 },
        { signal: controller.signal },
      );
      clearTimeout(timer);
      return response.choices[0].message.content;
    } catch (err) {
      clearTimeout(timer);
      if (err.name === "AbortError" || err.code === "ECONNABORTED") {
        lastErr = new LLMTimeoutError(attempt + 1);
      } else {
        lastErr = err;
      }
    }
  }

  if (lastErr instanceof LLMTimeoutError) throw lastErr;
  throw new LLMError(`LLM call failed after ${LLM_MAX_RETRIES} attempt(s): ${lastErr?.message}`, lastErr, LLM_MAX_RETRIES);
}

/**
 * Call LLM and parse the response as JSON.
 * Retries once with a correction prompt if parsing fails.
 * Throws LLMParseError if both attempts fail.
 */
export async function callLLMJSON(messages) {
  const raw = await callLLM(messages);
  try {
    return JSON.parse(cleanJSON(raw));
  } catch {
    const retry = await callLLM([
      ...messages,
      { role: "assistant", content: raw },
      { role: "user", content: "Your previous response was not valid JSON. Return ONLY valid JSON, no markdown fences or explanations." },
    ]);
    try {
      return JSON.parse(cleanJSON(retry));
    } catch {
      throw new LLMParseError(retry);
    }
  }
}