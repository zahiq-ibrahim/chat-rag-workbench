import type { ParsedPage } from './parser';

export type Chunk = { content: string; page?: number; heading?: string };

// PostgreSQL text columns cannot store NUL (\u0000) characters, which PDF
// extraction often produces. Also collapse extra spaces.
function clean(text: string): string {
  return text
    .replace(/\u0000/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n');
}

// Split text into windows of about `size` characters, breaking at a space
// when one is nearby, with `overlap` characters shared between neighbours.
function windowText(text: string, size: number, overlap: number): string[] {
  const pieces: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + size, text.length);

    if (end < text.length) {
      const lastSpace = text.lastIndexOf(' ', end);
      if (lastSpace > start + size / 2) end = lastSpace;
    }

    const piece = text.slice(start, end).trim();
    if (piece) pieces.push(piece);

    if (end >= text.length) break;
    start = Math.max(end - overlap, start + 1);
  }

  return pieces;
}

export function chunkPages(pages: ParsedPage[], size = 1000, overlap = 150): Chunk[] {
  const chunks: Chunk[] = [];

  for (const page of pages) {
    const text = clean(page.text);

    // Most recent markdown heading on this page (approximate for citations)
    let heading: string | undefined;
    for (const line of text.split('\n')) {
      const match = line.match(/^#{1,6}\s+(.*)$/);
      if (match) heading = match[1].trim();
    }

    for (const piece of windowText(text, size, overlap)) {
      chunks.push({ content: piece, page: page.page, heading });
    }
  }

  return chunks;
}