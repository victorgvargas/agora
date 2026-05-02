import { GoogleGenAI } from "@google/genai";

export const CHAT_MODEL = "gemini-2.5-flash";
export const EMBED_MODEL = "gemini-embedding-001";
export const EMBED_DIMENSIONS = 768;

let _client: GoogleGenAI | null = null;

export function getGenAI(): GoogleGenAI {
  if (_client) return _client;

  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set. Add it to .env.local (see .env.example)."
    );
  }

  _client = new GoogleGenAI({ apiKey });
  return _client;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function embedWithRetry(
  texts: string[],
  taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY",
  attempt = 0,
): Promise<number[][]> {
  const ai = getGenAI();
  try {
    const res = await ai.models.embedContent({
      model: EMBED_MODEL,
      contents: texts,
      config: { taskType, outputDimensionality: EMBED_DIMENSIONS },
    });
    const embeddings = res.embeddings ?? [];
    if (embeddings.length !== texts.length) {
      throw new Error(
        `Gemini returned ${embeddings.length} embeddings for ${texts.length} inputs`,
      );
    }
    return embeddings.map((e, i) => {
      if (!e.values) throw new Error(`Missing embedding values at index ${i}`);
      return e.values;
    });
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status;
    if (status === 429 && attempt < 5) {
      const backoffMs = 15_000 * Math.pow(2, attempt);
      console.log(`  (rate limited — backing off ${backoffMs / 1000}s)`);
      await sleep(backoffMs);
      return embedWithRetry(texts, taskType, attempt + 1);
    }
    throw err;
  }
}

export async function embedTexts(
  texts: string[],
  taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY",
): Promise<number[][]> {
  if (texts.length === 0) return [];
  return embedWithRetry(texts, taskType);
}

export async function embedQuery(text: string): Promise<number[]> {
  const [v] = await embedTexts([text], "RETRIEVAL_QUERY");
  return v;
}
