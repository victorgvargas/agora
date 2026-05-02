"use client";

import Link from "next/link";
import { useState } from "react";
import { BookList } from "./BookList";
import type { BookRow, TopicRow } from "@/lib/feed";

interface FeedPayload {
  topic: TopicRow;
  books: BookRow[];
}

export function FeedCard({ initial }: { initial: FeedPayload }) {
  const [state, setState] = useState<FeedPayload>(initial);
  const [loading, setLoading] = useState(false);

  async function shuffle() {
    setLoading(true);
    try {
      const res = await fetch("/api/feed/next", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ excludeId: state.topic.id }),
      });
      if (res.ok) setState(await res.json());
    } finally {
      setLoading(false);
    }
  }

  const { topic, books } = state;

  return (
    <article className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-widest text-amber-700">
          {topic.discipline}
        </span>
        <h1 className="text-4xl font-semibold leading-tight">{topic.title}</h1>
        <p className="text-lg leading-relaxed text-stone-700">
          <em>{topic.question}</em>
        </p>
      </header>

      <p className="text-base leading-relaxed text-stone-800">{topic.blurb}</p>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-stone-500">
          Bibliography
        </h2>
        <BookList books={books} />
      </section>

      <div className="flex items-center gap-3 pt-2">
        <Link
          href={`/topics/${topic.slug}`}
          className="inline-flex items-center rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-stone-50 hover:bg-stone-800"
        >
          Start conversation
        </Link>
        <button
          type="button"
          onClick={shuffle}
          disabled={loading}
          className="inline-flex items-center rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100 disabled:opacity-50"
        >
          {loading ? "Loading…" : "Get another topic"}
        </button>
      </div>
    </article>
  );
}
