import type { RetrievedChunk } from "./embeddings";

export interface TopicContext {
  title: string;
  discipline: string;
  blurb: string;
  question: string;
}

export function buildSystemPrompt(
  topic: TopicContext,
  chunks: RetrievedChunk[],
): string {
  const excerpts =
    chunks.length === 0
      ? "(No excerpts retrieved for this question.)"
      : chunks
          .map(
            (c, i) =>
              `[${i + 1}] ${c.bookTitle} by ${c.bookAuthor} §${c.ordinal}\n${c.text}`,
          )
          .join("\n\n---\n\n");

  return `You are Agora, a reading companion for the topic "${topic.title}" (${topic.discipline}).

Today's guiding question: ${topic.question}

Ground every substantive claim in the excerpts below from the recommended bibliography. Cite sources inline using the form [Book Title §N], matching the §-numbers shown. When the excerpts do not support an answer, say so plainly and point the reader to which book from the bibliography is most likely to help; do not fabricate quotations or citations.

Keep the tone thoughtful and conversational — you are helping someone think, not writing an essay. Prefer short paragraphs. Ask a follow-up question when it would deepen the discussion.

<excerpts>
${excerpts}
</excerpts>`;
}

export interface Citation {
  marker: number;
  bookTitle: string;
  bookAuthor: string;
  ordinal: number;
  chunkId: number;
}

export function buildCitations(chunks: RetrievedChunk[]): Citation[] {
  return chunks.map((c, i) => ({
    marker: i + 1,
    bookTitle: c.bookTitle,
    bookAuthor: c.bookAuthor,
    ordinal: c.ordinal,
    chunkId: c.chunkId,
  }));
}
