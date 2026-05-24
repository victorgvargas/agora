import { getDb, ensureSchema, EMBED_DIM } from "./db";
import { embedQuery } from "./gemini";

function vectorLiteral(vec: number[]): string {
  if (vec.length !== EMBED_DIM) {
    throw new Error(`Expected ${EMBED_DIM}-dim vector, got ${vec.length}`);
  }
  return `[${vec.join(",")}]`;
}

export async function insertChunkEmbedding(
  chunkId: number,
  vec: number[],
): Promise<void> {
  await ensureSchema();
  const db = getDb();
  await db.execute({
    sql: `INSERT INTO chunk_embeddings(chunk_id, embedding)
          VALUES (?, vector32(?))
          ON CONFLICT(chunk_id) DO UPDATE SET embedding = excluded.embedding`,
    args: [chunkId, vectorLiteral(vec)],
  });
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
  await ensureSchema();
  const db = getDb();
  const vec = await embedQuery(query);

  // Overfetch ANN candidates, then filter by topic. The chunk_embeddings PK
  // aliases rowid, so vector_top_k's `id` column equals chunks.id.
  const candidatePool = Math.max(k * 8, 40);
  const litVec = vectorLiteral(vec);

  const res = await db.execute({
    sql: `
      SELECT
        c.id      AS chunkId,
        c.book_id AS bookId,
        c.ordinal AS ordinal,
        c.text    AS text,
        b.title   AS bookTitle,
        b.author  AS bookAuthor,
        vector_distance_cos(ce.embedding, vector32(?)) AS distance
      FROM vector_top_k('chunk_embeddings_idx', vector32(?), ?) AS vt
      JOIN chunk_embeddings ce ON ce.chunk_id = vt.id
      JOIN chunks c ON c.id = vt.id
      JOIN books  b ON b.id = c.book_id
      JOIN topic_books tb ON tb.book_id = c.book_id AND tb.topic_id = ?
      ORDER BY distance
      LIMIT ?
    `,
    args: [litVec, litVec, candidatePool, topicId, k],
  });

  return res.rows as unknown as RetrievedChunk[];
}
