import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { booksForTopic, nextTopic } from "@/lib/feed";

export const dynamic = "force-dynamic";

const Body = z.object({
  excludeId: z.number().int().nullable().optional(),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const topic = await nextTopic(parsed.data.excludeId ?? null);
  if (!topic) {
    return NextResponse.json({ error: "No other topics available" }, { status: 404 });
  }
  const books = await booksForTopic(topic.id);
  return NextResponse.json({ topic, books });
}
