import { getDb, ensureSchema } from "./db";

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

export async function listTopics(): Promise<TopicRow[]> {
  await ensureSchema();
  const db = getDb();
  const res = await db.execute(
    "SELECT id, slug, title, discipline, blurb, question FROM topics ORDER BY id",
  );
  return res.rows as unknown as TopicRow[];
}

export async function getTopicBySlug(slug: string): Promise<TopicRow | null> {
  await ensureSchema();
  const db = getDb();
  const res = await db.execute({
    sql: "SELECT id, slug, title, discipline, blurb, question FROM topics WHERE slug = ?",
    args: [slug],
  });
  return (res.rows[0] as unknown as TopicRow) ?? null;
}

export async function getTopicById(id: number): Promise<TopicRow | null> {
  await ensureSchema();
  const db = getDb();
  const res = await db.execute({
    sql: "SELECT id, slug, title, discipline, blurb, question FROM topics WHERE id = ?",
    args: [id],
  });
  return (res.rows[0] as unknown as TopicRow) ?? null;
}

export async function booksForTopic(topicId: number): Promise<BookRow[]> {
  await ensureSchema();
  const db = getDb();
  const res = await db.execute({
    sql: `
      SELECT b.id, b.title, b.author, b.year, b.blurb, tb.relevance_note AS relevance
      FROM books b
      JOIN topic_books tb ON tb.book_id = b.id
      WHERE tb.topic_id = ?
      ORDER BY tb.sort_order, b.id
    `,
    args: [topicId],
  });
  return res.rows as unknown as BookRow[];
}

export async function dailyTopic(): Promise<TopicRow | null> {
  await ensureSchema();
  const db = getDb();
  const today = todayUtc();

  const pinned = await db.execute({
    sql: `SELECT t.id, t.slug, t.title, t.discipline, t.blurb, t.question
          FROM daily_feed d JOIN topics t ON t.id = d.topic_id
          WHERE d.date = ?`,
    args: [today],
  });
  if (pinned.rows[0]) return pinned.rows[0] as unknown as TopicRow;

  const topics = await listTopics();
  if (topics.length === 0) return null;

  const pick = topics[hashString(today) % topics.length];
  await db.execute({
    sql: "INSERT OR REPLACE INTO daily_feed(date, topic_id) VALUES (?, ?)",
    args: [today, pick.id],
  });
  return pick;
}

export async function nextTopic(
  excludeId: number | null,
): Promise<TopicRow | null> {
  await ensureSchema();
  const db = getDb();
  const res = await db.execute({
    sql: `SELECT id, slug, title, discipline, blurb, question FROM topics
          WHERE id != COALESCE(?, -1)
          ORDER BY RANDOM() LIMIT 1`,
    args: [excludeId],
  });
  return (res.rows[0] as unknown as TopicRow) ?? null;
}
