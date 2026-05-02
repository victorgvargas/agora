export interface Chunk {
  ordinal: number;
  text: string;
  charStart: number;
  charEnd: number;
}

const APPROX_CHARS_PER_TOKEN = 4;
const DEFAULT_CHUNK_TOKENS = 500;
const DEFAULT_OVERLAP_TOKENS = 100;

export function normalizeText(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function chunkText(
  text: string,
  {
    chunkTokens = DEFAULT_CHUNK_TOKENS,
    overlapTokens = DEFAULT_OVERLAP_TOKENS,
  }: { chunkTokens?: number; overlapTokens?: number } = {},
): Chunk[] {
  const chunkSize = chunkTokens * APPROX_CHARS_PER_TOKEN;
  const overlap = overlapTokens * APPROX_CHARS_PER_TOKEN;
  const stride = Math.max(1, chunkSize - overlap);

  const chunks: Chunk[] = [];
  let ordinal = 0;
  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + chunkSize, text.length);

    // Prefer to break on a paragraph or sentence boundary when near the tail.
    if (end < text.length) {
      const tail = text.slice(end - 200, end + 200);
      const paraIdx = tail.lastIndexOf("\n\n");
      const sentenceIdx = Math.max(
        tail.lastIndexOf(". "),
        tail.lastIndexOf("! "),
        tail.lastIndexOf("? "),
      );
      const offset = paraIdx >= 0 ? paraIdx : sentenceIdx;
      if (offset >= 0) end = end - 200 + offset + 1;
    }

    const slice = text.slice(start, end).trim();
    if (slice.length > 50) {
      chunks.push({
        ordinal,
        text: slice,
        charStart: start,
        charEnd: end,
      });
      ordinal += 1;
    }

    if (end >= text.length) break;
    start = end - overlap;
    if (start < 0) start = 0;
  }

  return chunks;
}
