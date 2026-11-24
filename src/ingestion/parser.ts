import fs from 'fs/promises';
import path from 'path';
import pdfParse from 'pdf-parse';

export type ParsedPage = { page: number; text: string };

/**
 * Parse an uploaded file into a list of pages.
 *
 * Detection order:
 *  1. File extension (.pdf → PDF parser, .txt/.md/.markdown → plain text)
 *  2. Magic bytes — if the extension is absent or unrecognised, peek at the
 *     first 4 bytes: `%PDF` → PDF parser, anything else → plain text.
 *
 * Multer saves uploaded files with a random hash as the filename and no
 * extension, so magic-byte detection is the common path for real uploads.
 */
export async function parseFile(filePath: string): Promise<ParsedPage[]> {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.pdf') return parsePdf(filePath);
  if (ext === '.txt' || ext === '.md' || ext === '.markdown') return parsePlainText(filePath);

  // No recognised extension — detect by magic bytes
  const header = Buffer.alloc(4);
  const fh = await fs.open(filePath, 'r');
  try {
    await fh.read(header, 0, 4, 0);
  } finally {
    await fh.close();
  }

  if (header.toString('ascii') === '%PDF') return parsePdf(filePath);
  return parsePlainText(filePath);
}

async function parsePlainText(filePath: string): Promise<ParsedPage[]> {
  const text = await fs.readFile(filePath, 'utf-8');
  return [{ page: 1, text }];
}

async function parsePdf(filePath: string): Promise<ParsedPage[]> {
  const buffer = await fs.readFile(filePath);
  const pages: ParsedPage[] = [];

  // pdf-parse callback fires once per page; collect them in order
  await pdfParse(buffer, {
    pagerender(pageData: any) {
      return pageData.getTextContent().then((content: any) => {
        const text: string = content.items.map((item: any) => item.str).join(' ');
        pages.push({ page: pageData.pageIndex + 1, text });
        return text;
      });
    },
  });

  // Fallback: custom render produced nothing (some PDFs have no text layer)
  if (pages.length === 0) {
    const data = await pdfParse(buffer);
    return [{ page: 1, text: data.text }];
  }

  return pages;
}
