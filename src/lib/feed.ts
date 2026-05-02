import { getDb } from "./db";

export interface TopicRow {
  id: number;
  slug: string;
  title: string;
  discipline: string;
  blurb: string;
  question: string;
}

export interface BookRow {
  id: number;
  title: string;
  author: string;
  year: string | null;
  blurb: string | null;
  relevance: string | null;
}

export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function listTopics(): TopicRow[] {
  const db = getDb();
  return db
    .prepare(
      "SELECT id, slug, title, discipline, blurb, question FROM topics ORDER BY id",
    )
    .all() as TopicRow[];
}

export function getTopicBySlug(slug: string): TopicRow | null {
  const db = getDb();
  return (
    (db
      .prepare(
        "SELECT id, slug, title, discipline, blurb, question FROM topics WHERE slug = ?",
      )
      .get(slug) as TopicRow | undefined) ?? null
  );
}

export function getTopicById(id: number): TopicRow | null {
  const db = getDb();
  return (
    (db
      .prepare(
        "SELECT id, slug, title, discipline, blurb, question FROM topics WHERE id = ?",
      )
      .get(id) as TopicRow | undefined) ?? null
  );
}

export function booksForTopic(topicId: number): BookRow[] {
  const db = getDb();
  return db
    .prepare(
      `
      SELECT b.id, b.title, b.author, b.year, b.blurb, tb.relevance_note AS relevance
      FROM books b
      JOIN topic_books tb ON tb.book_id = b.id
      WHERE tb.topic_id = ?
      ORDER BY tb.sort_order, b.id
    `,
    )
    .all(topicId) as BookRow[];
}

export function dailyTopic(): TopicRow | null {
  const db = getDb();
  const today = todayUtc();

  const pinned = db
    .prepare(
      `SELECT t.id, t.slug, t.title, t.discipline, t.blurb, t.question
       FROM daily_feed d JOIN topics t ON t.id = d.topic_id
       WHERE d.date = ?`,
    )
    .get(today) as TopicRow | undefined;
  if (pinned) return pinned;

  const topics = listTopics();
  if (topics.length === 0) return null;

  const pick = topics[hashString(today) % topics.length];
  db.prepare("INSERT OR REPLACE INTO daily_feed(date, topic_id) VALUES (?, ?)").run(
    today,
    pick.id,
  );
  return pick;
}

export function nextTopic(excludeId: number | null): TopicRow | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, slug, title, discipline, blurb, question FROM topics
       WHERE id != COALESCE(?, -1)
       ORDER BY RANDOM() LIMIT 1`,
    )
    .get(excludeId) as TopicRow | undefined;
  return row ?? null;
}
