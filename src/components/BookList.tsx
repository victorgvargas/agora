import type { BookRow } from "@/lib/feed";

export function BookList({ books }: { books: BookRow[] }) {
  if (books.length === 0) {
    return (
      <p className="text-sm text-stone-500 italic">
        No books linked to this topic yet.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-4">
      {books.map((b) => (
        <li
          key={b.id}
          className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm"
        >
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-lg font-semibold">{b.title}</h3>
            {b.year && (
              <span className="text-xs text-stone-500">{b.year}</span>
            )}
          </div>
          <p className="text-sm text-stone-600">{b.author}</p>
          {b.relevance && (
            <p className="mt-2 text-sm text-stone-700">{b.relevance}</p>
          )}
        </li>
      ))}
    </ul>
  );
}
