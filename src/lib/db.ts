import { createClient, type Client } from "@libsql/client";
import { mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";

export const EMBED_DIM = 768;

let _client: Client | null = null;
let _migrated = false;

export function getDb(): Client {
  if (_client) return _client;

  const url = process.env.TURSO_DATABASE_URL;
  if (!url) {
    throw new Error(
      "TURSO_DATABASE_URL is not set. For local dev use `file:./data/agora.db`; for Turso use the libsql:// URL.",
    );
  }
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (url.startsWith("file:")) {
    const path = url.slice("file:".length);
    const dir = dirname(path);
    if (dir && !existsSync(dir)) mkdirSync(dir, { recursive: true });
  }

  _client = createClient({ url, authToken });
  return _client;
}

export async function ensureSchema(): Promise<void> {
  if (_migrated) return;
  const db = getDb();

  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS topics (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      slug       TEXT NOT NULL UNIQUE,
      title      TEXT NOT NULL,
      discipline TEXT NOT NULL,
      blurb      TEXT NOT NULL,
      question   TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS books (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      title      TEXT NOT NULL,
      author     TEXT NOT NULL,
      year       TEXT,
      source_url TEXT,
      license    TEXT,
      blurb      TEXT,
      UNIQUE (title, author)
    );

    CREATE TABLE IF NOT EXISTS topic_books (
      topic_id       INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
      book_id        INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      relevance_note TEXT,
      sort_order     INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (topic_id, book_id)
    );

    CREATE TABLE IF NOT EXISTS chunks (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id    INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      ordinal    INTEGER NOT NULL,
      text       TEXT NOT NULL,
      char_start INTEGER NOT NULL,
      char_end   INTEGER NOT NULL,
      UNIQUE (book_id, ordinal)
    );

    CREATE TABLE IF NOT EXISTS daily_feed (
      date     TEXT PRIMARY KEY,
      topic_id INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS chats (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      topic_id   INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS messages (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id        INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
      role           TEXT NOT NULL CHECK (role IN ('user','assistant')),
      content        TEXT NOT NULL,
      citations_json TEXT,
      created_at     TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS chunk_embeddings (
      chunk_id  INTEGER PRIMARY KEY REFERENCES chunks(id) ON DELETE CASCADE,
      embedding F32_BLOB(${EMBED_DIM}) NOT NULL
    );

    CREATE INDEX IF NOT EXISTS chunk_embeddings_idx
      ON chunk_embeddings(libsql_vector_idx(embedding));
  `);

  _migrated = true;
}
