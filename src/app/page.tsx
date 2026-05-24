import Link from "next/link";
import { FeedCard } from "@/components/FeedCard";
import { booksForTopic, dailyTopic } from "@/lib/feed";

export const dynamic = "force-dynamic";

export default async function Home() {
  const topic = await dailyTopic();

  if (!topic) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <h1 className="text-2xl font-semibold">Agora</h1>
        <p className="mt-4 text-stone-700">
          The catalog is empty. Run{" "}
          <code className="rounded bg-stone-200 px-1.5 py-0.5 text-sm">
            pnpm ingest
          </code>{" "}
          to populate topics and embeddings.
        </p>
      </main>
    );
  }

  const books = await booksForTopic(topic.id);

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Link
        href="/"
        className="text-xs uppercase tracking-widest text-stone-500 hover:text-stone-900"
      >
        Agora
      </Link>
      <div className="mt-8">
        <FeedCard initial={{ topic, books }} />
      </div>
    </main>
  );
}
