import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function callLLM(messages) {
  const response = await openai.chat.completions.create({
    model: "gpt-4.1",
    messages,
    temperature: 0.3,
  });

  return response.choices[0].message.content;
}