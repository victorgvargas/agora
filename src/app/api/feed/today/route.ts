import { NextResponse } from "next/server";
import { booksForTopic, dailyTopic } from "@/lib/feed";

export const dynamic = "force-dynamic";

export async function GET() {
  const topic = dailyTopic();
  if (!topic) {
    return NextResponse.json(
      { error: "No topics in catalog. Run `pnpm ingest`." },
      { status: 503 },
    );
  }
  const books = booksForTopic(topic.id);
  return NextResponse.json({ topic, books });
}
