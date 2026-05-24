import Link from "next/link";
import { notFound } from "next/navigation";
import { BookList } from "@/components/BookList";
import { ChatPanel } from "@/components/ChatPanel";
import { booksForTopic, getTopicBySlug } from "@/lib/feed";

export const dynamic = "force-dynamic";

export default async function TopicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const topic = await getTopicBySlug(slug);
  if (!topic) notFound();

  const books = await booksForTopic(topic.id);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Link
        href="/"
        className="text-xs uppercase tracking-widest text-stone-500 hover:text-stone-900"
      >
        ← Agora
      </Link>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_1.3fr]">
        <section className="flex flex-col gap-5">
          <header className="flex flex-col gap-2">
            <span className="text-xs uppercase tracking-widest text-amber-700">
              {topic.discipline}
            </span>
            <h1 className="text-3xl font-semibold leading-tight">
              {topic.title}
            </h1>
            <p className="text-base leading-relaxed text-stone-700">
              <em>{topic.question}</em>
            </p>
          </header>
          <p className="text-sm leading-relaxed text-stone-800">{topic.blurb}</p>
          <div>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-stone-500">
              Bibliography
            </h2>
            <BookList books={books} />
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-500">
            Talk to the reading companion
          </h2>
          <ChatPanel topicId={topic.id} />
        </section>
      </div>
    </main>
  );
}
