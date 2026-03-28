import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Strip markdown fences and leading/trailing whitespace from LLM output
 * so JSON.parse works even if the model wraps its response in ```json ... ```.
 */
export function cleanJSON(raw) {
  let text = raw.trim();
  // Remove ```json ... ``` or ``` ... ```
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  return text.trim();
}

export async function callLLM(messages) {
  const response = await openai.chat.completions.create({
    model: "gpt-4.1",
    messages,
    temperature: 0.3,
  });

  return response.choices[0].message.content;
}

/**
 * Call LLM and parse as JSON. Retries once on parse failure.
 */
export async function callLLMJSON(messages) {
  const raw = await callLLM(messages);
  try {
    return JSON.parse(cleanJSON(raw));
  } catch {
    // Retry once with a fix-up message
    const retry = await callLLM([
      ...messages,
      { role: "assistant", content: raw },
      { role: "user", content: "Your previous response was not valid JSON. Return ONLY valid JSON, no markdown fences or explanations." },
    ]);
    return JSON.parse(cleanJSON(retry));
  }
}