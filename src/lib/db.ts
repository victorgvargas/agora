import Database, { type Database as DB } from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";
import { mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";

export const EMBED_DIM = 768;

const DEFAULT_PATH = join(process.cwd(), "data", "agora.db");

let _db: DB | null = null;

export function getDb(path: string = DEFAULT_PATH): DB {
  if (_db) return _db;

  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  sqliteVec.load(db);
  migrate(db);

  _db = db;
  return db;
}

function migrate(db: DB) {
  db.exec(`
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
  `);

  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS chunk_embeddings USING vec0(
      chunk_id INTEGER PRIMARY KEY,
      embedding FLOAT[${EMBED_DIM}]
    );
  `);
}
