import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { getDb } from "../src/lib/db";
import { embedTexts } from "../src/lib/gemini";
import { insertChunkEmbedding } from "../src/lib/embeddings";
import { chunkText, normalizeText } from "../src/lib/chunking";

interface BookSpec {
  title: string;
  author: string;
  year?: string;
  source?: string;
  source_url?: string;
  license?: string;
  relevance?: string;
  blurb?: string;
}

interface TopicSpec {
  slug: string;
  title: string;
  discipline: string;
  question: string;
  blurb: string;
  books: BookSpec[];
}

const BATCH_SIZE = 5;               // stay under free-tier TPM (10k tokens/min)
const INTER_BATCH_DELAY_MS = 13_000; // ~5 req/min cap
const MAX_CHARS_PER_BOOK = 60_000;   // ~15k tokens → ~15 chunks per book

function stripGutenbergBoilerplate(raw: string): string {
  const startRe = /\*\*\*\s*START OF (THIS|THE) PROJECT GUTENBERG[^*]+\*\*\*/i;
  const endRe = /\*\*\*\s*END OF (THIS|THE) PROJECT GUTENBERG[^*]+\*\*\*/i;
  const startMatch = raw.match(startRe);
  const endMatch = raw.match(endRe);
  const start = startMatch ? startMatch.index! + startMatch[0].length : 0;
  const end = endMatch ? endMatch.index! : raw.length;
  return raw.slice(start, end);
}

function loadSourceText(relPath: string): string | null {
  const full = join(process.cwd(), "content", "sources", relPath);
  if (!existsSync(full)) return null;
  const raw = readFileSync(full, "utf8");
  const stripped = stripGutenbergBoilerplate(raw);
  const normalized = normalizeText(stripped);
  return normalized.length > MAX_CHARS_PER_BOOK
    ? normalized.slice(0, MAX_CHARS_PER_BOOK)
    : normalized;
}

function upsertTopic(spec: TopicSpec): number {
  const db = getDb();
  db.prepare(
    `INSERT INTO topics(slug, title, discipline, blurb, question)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(slug) DO UPDATE SET
       title=excluded.title,
       discipline=excluded.discipline,
       blurb=excluded.blurb,
       question=excluded.question`,
  ).run(spec.slug, spec.title, spec.discipline, spec.blurb, spec.question);
  return (
    db.prepare("SELECT id FROM topics WHERE slug = ?").get(spec.slug) as {
      id: number;
    }
  ).id;
}

function upsertBook(spec: BookSpec): number {
  const db = getDb();
  db.prepare(
    `INSERT INTO books(title, author, year, source_url, license, blurb)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(title, author) DO UPDATE SET
       year=excluded.year,
       source_url=excluded.source_url,
       license=excluded.license,
       blurb=excluded.blurb`,
  ).run(
    spec.title,
    spec.author,
    spec.year ?? null,
    spec.source_url ?? null,
    spec.license ?? null,
    spec.blurb ?? null,
  );
  return (
    db
      .prepare("SELECT id FROM books WHERE title = ? AND author = ?")
      .get(spec.title, spec.author) as { id: number }
  ).id;
}

function linkTopicBook(
  topicId: number,
  bookId: number,
  relevance: string | undefined,
  sortOrder: number,
) {
  const db = getDb();
  db.prepare(
    `INSERT INTO topic_books(topic_id, book_id, relevance_note, sort_order)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(topic_id, book_id) DO UPDATE SET
       relevance_note=excluded.relevance_note,
       sort_order=excluded.sort_order`,
  ).run(topicId, bookId, relevance ?? null, sortOrder);
}

async function ingestBookText(bookId: number, text: string, label: string) {
  const db = getDb();
  const chunks = chunkText(text);
  console.log(`  - ${label}: ${chunks.length} chunks`);

  const existing = new Set(
    (
      db
        .prepare("SELECT ordinal FROM chunks WHERE book_id = ?")
        .all(bookId) as { ordinal: number }[]
    ).map((r) => r.ordinal),
  );

  const pending = chunks.filter((c) => !existing.has(c.ordinal));
  if (pending.length === 0) {
    console.log("    (all chunks already embedded)");
    return;
  }

  const insertChunk = db.prepare(
    "INSERT INTO chunks(book_id, ordinal, text, char_start, char_end) VALUES (?, ?, ?, ?, ?)",
  );
  const selectChunkId = db.prepare(
    "SELECT id FROM chunks WHERE book_id = ? AND ordinal = ?",
  );

  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const batch = pending.slice(i, i + BATCH_SIZE);
    const vectors = await embedTexts(
      batch.map((c) => c.text),
      "RETRIEVAL_DOCUMENT",
    );

    const tx = db.transaction(() => {
      batch.forEach((c, j) => {
        insertChunk.run(bookId, c.ordinal, c.text, c.charStart, c.charEnd);
        const { id } = selectChunkId.get(bookId, c.ordinal) as { id: number };
        insertChunkEmbedding(id, vectors[j]);
      });
    });
    tx();

    const done = Math.min(i + BATCH_SIZE, pending.length);
    console.log(`    embedded ${done}/${pending.length}`);
    if (done < pending.length) {
      await new Promise((r) => setTimeout(r, INTER_BATCH_DELAY_MS));
    }
  }
}

function preflightSources(catalog: TopicSpec[]): void {
  const missing: string[] = [];
  for (const topic of catalog) {
    for (const book of topic.books) {
      if (!book.source) continue;
      const full = join(process.cwd(), "content", "sources", book.source);
      if (!existsSync(full)) {
        missing.push(`  - ${topic.slug} / ${book.title}: ${book.source}`);
      }
    }
  }
  if (missing.length > 0) {
    throw new Error(
      `Missing source files for ${missing.length} book(s):\n${missing.join("\n")}\n` +
        `Fetch the texts into content/sources/ or remove the 'source' field to mark them bibliography-only.`,
    );
  }
}

async function main() {
  const catalogPath = join(process.cwd(), "content", "topics.json");
  const catalog = JSON.parse(readFileSync(catalogPath, "utf8")) as TopicSpec[];

  preflightSources(catalog);

  // Instantiate DB (runs migrations).
  getDb();

  for (const topic of catalog) {
    console.log(`\nTopic: ${topic.title}`);
    const topicId = upsertTopic(topic);

    for (let i = 0; i < topic.books.length; i++) {
      const book = topic.books[i];
      const bookId = upsertBook(book);
      linkTopicBook(topicId, bookId, book.relevance, i);

      if (!book.source) {
        console.log(`  - ${book.title}: bibliography-only (no source text)`);
        continue;
      }
      const text = loadSourceText(book.source);
      if (!text) {
        throw new Error(
          `Source file disappeared between preflight and ingest: ${book.source}`,
        );
      }
      await ingestBookText(bookId, text, book.title);
    }
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
