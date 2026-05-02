import { type NextRequest } from "next/server";
import { z } from "zod";
import { getTopicById } from "@/lib/feed";
import { searchChunksForTopic } from "@/lib/embeddings";
import { buildSystemPrompt, buildCitations } from "@/lib/rag";
import { CHAT_MODEL, getGenAI } from "@/lib/gemini";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Message = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

const Body = z.object({
  topicId: z.number().int().positive(),
  messages: z.array(Message).min(1).max(40),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }
  const { topicId, messages } = parsed.data;

  const topic = getTopicById(topicId);
  if (!topic) return Response.json({ error: "Unknown topic" }, { status: 404 });

  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUser) {
    return Response.json({ error: "No user message" }, { status: 400 });
  }

  let chunks;
  try {
    chunks = await searchChunksForTopic(topicId, lastUser.content, 6);
  } catch (err) {
    console.error("retrieval failed", err);
    return Response.json({ error: "Retrieval failed" }, { status: 500 });
  }

  const systemInstruction = buildSystemPrompt(topic, chunks);
  const citations = buildCitations(chunks);

  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const ai = getGenAI();

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      try {
        send("citations", citations);

        const iter = await ai.models.generateContentStream({
          model: CHAT_MODEL,
          contents,
          config: {
            systemInstruction,
            temperature: 0.5,
            maxOutputTokens: 900,
          },
        });

        for await (const chunk of iter) {
          const text = chunk.text;
          if (text) send("token", text);
        }

        send("done", {});
      } catch (err) {
        console.error("chat stream error", err);
        send("error", { message: "Model call failed" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
