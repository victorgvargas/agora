import { getDb, EMBED_DIM } from "./db";
import { embedQuery } from "./gemini";

function floatArrayToBlob(vec: number[]): Buffer {
  if (vec.length !== EMBED_DIM) {
    throw new Error(`Expected ${EMBED_DIM}-dim vector, got ${vec.length}`);
  }
  const buf = Buffer.alloc(vec.length * 4);
  for (let i = 0; i < vec.length; i++) buf.writeFloatLE(vec[i], i * 4);
  return buf;
}

export function insertChunkEmbedding(chunkId: number, vec: number[]): void {
  const db = getDb();
  // vec0 requires BigInt for its PK column, and doesn't support INSERT OR REPLACE.
  const id = BigInt(chunkId);
  db.prepare("DELETE FROM chunk_embeddings WHERE chunk_id = ?").run(id);
  db.prepare(
    "INSERT INTO chunk_embeddings(chunk_id, embedding) VALUES (?, ?)",
  ).run(id, floatArrayToBlob(vec));
}

export interface RetrievedChunk {
  chunkId: number;
  bookId: number;
  bookTitle: string;
  bookAuthor: string;
  ordinal: number;
  text: string;
  distance: number;
}

export async function searchChunksForTopic(
  topicId: number,
  query: string,
  k: number = 6,
): Promise<RetrievedChunk[]> {
  const db = getDb();
  const vec = await embedQuery(query);

  // Ask vec0 for a larger candidate pool, then filter to the topic's books.
  const candidatePool = Math.max(k * 8, 40);
  const rows = db
    .prepare(
      `
      SELECT
        ce.chunk_id  AS chunkId,
        ce.distance  AS distance,
        c.book_id    AS bookId,
        c.ordinal    AS ordinal,
        c.text       AS text,
        b.title      AS bookTitle,
        b.author     AS bookAuthor
      FROM chunk_embeddings ce
      JOIN chunks c ON c.id = ce.chunk_id
      JOIN books  b ON b.id = c.book_id
      JOIN topic_books tb ON tb.book_id = c.book_id AND tb.topic_id = ?
      WHERE ce.embedding MATCH ? AND k = ?
      ORDER BY ce.distance
    `,
    )
    .all(topicId, floatArrayToBlob(vec), candidatePool) as RetrievedChunk[];

  return rows.slice(0, k);
}
