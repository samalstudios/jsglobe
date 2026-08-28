import { PAGE_SIZES, widthOf, createPdf } from './pdf.js';

export const BLOCK_STYLE = {
  h1: { size: 24, bold: true, before: 16, after: 8 },
  h2: { size: 19, bold: true, before: 14, after: 7 },
  h3: { size: 15, bold: true, before: 12, after: 6 },
  h4: { size: 13, bold: true, before: 10, after: 5 },
  h5: { size: 12, bold: true, before: 9, after: 4 },
  h6: { size: 11, bold: true, before: 8, after: 4 },
  p: { size: 11, before: 0, after: 8 },
  quote: { size: 11, italic: true, before: 6, after: 8, indent: 24 },
  code: { size: 10, mono: true, before: 6, after: 8, indent: 12 },
  bullet: { size: 11, before: 0, after: 4, indent: 18 },
  ordered: { size: 11, before: 0, after: 4, indent: 18 },
  rule: { size: 0, before: 8, after: 12 },
  image: { size: 0, before: 8, after: 10 },
  table: { size: 10, before: 8, after: 10 },
};

const PDF_BASE = {
  helvetica: 'helvetica', 'helvetica neue': 'helvetica', arial: 'helvetica', verdana: 'helvetica',
  tahoma: 'helvetica', geneva: 'helvetica', 'trebuchet ms': 'helvetica', calibri: 'helvetica',
  candara: 'helvetica', 'segoe ui': 'helvetica', 'sans-serif': 'helvetica',
  times: 'times', 'times new roman': 'times', georgia: 'times', garamond: 'times',
  baskerville: 'times', palatino: 'times', 'palatino linotype': 'times', 'book antiqua': 'times',
  cambria: 'times', serif: 'times',
  courier: 'courier', 'courier new': 'courier', menlo: 'courier', consolas: 'courier',
  monaco: 'courier', monospace: 'courier',
};

export const baseFor = (family, fallback = 'helvetica') => {
  if (!family) return fallback;
  for (const part of String(family).split(',')) {
    const name = part.trim().replace(/["']/g, '').toLowerCase();
    if (PDF_BASE[name]) return PDF_BASE[name];
  }
  return fallback;
};

const familyOf = (run, base, style) => {
  const bold = run.bold || style.bold;
  const italic = run.italic || style.italic;
  const mono = run.mono || style.mono;
  const family = mono ? 'courier' : baseFor(run.font, base);
  if (bold && italic) return `${family}BoldItalic`;
  if (bold) return `${family}Bold`;
  if (italic) return `${family}Italic`;
  return family;
};

const splitRuns = (runs, base, style) =>
  (runs ?? []).flatMap((run) =>
    String(run.text ?? '')
      .split(/(\s+)/)
      .filter((piece) => piece !== '')
      .map((piece) => ({
        text: piece,
        space: /^\s+$/.test(piece),
        font: familyOf(run, base, style),
        size: run.size ? run.size * 0.75 : style.size,
        color: run.color ?? '#111111',
        highlight: run.highlight,
        underline: run.underline,
        strike: run.strike,
        link: run.link,
      })),
  );

const breakLines = (pieces, limit) => {
  const lines = [];
  let line = [];
  let width = 0;
  for (const piece of pieces) {
    if (piece.text === '\n') {
      lines.push(line);
      line = [];
      width = 0;
      continue;
    }
    const size = widthOf(piece.text, piece.font, piece.size);
    if (width + size > limit && line.length && !piece.space) {
      lines.push(line);
      line = [piece];
      width = size;
      continue;
    }
    if (!line.length && piece.space) continue;
    line.push(piece);
    width += size;
  }
  if (line.length || !lines.length) lines.push(line);
  return lines.map((entry) => {
    while (entry.length && entry[entry.length - 1].space) entry.pop();
    return entry;
  });
};

const lineWidth = (line) => line.reduce((sum, piece) => sum + widthOf(piece.text, piece.font, piece.size), 0);

export function layoutDocument(blocks, options = {}) {
  const [paperWidth, paperHeight] = PAGE_SIZES[options.size ?? 'a4'] ?? PAGE_SIZES.a4;
  const landscape = options.orientation === 'landscape';
  const width = landscape ? paperHeight : paperWidth;
  const height = landscape ? paperWidth : paperHeight;
  const margin = options.margin ?? 72;
  const base = options.font ?? 'helvetica';
  const spacing = options.spacing ?? 1.45;
  const limit = width - margin * 2;
  const bottom = height - margin;

  const pages = [];
  let page = null;
  let y = margin;

  const openPage = () => {
    page = { items: [] };
    pages.push(page);
    y = margin;
  };
  openPage();

  const room = (needed) => {
    if (y + needed <= bottom) return;
    openPage();
  };

  let counter = [];

  for (const block of blocks) {
    const style = BLOCK_STYLE[block.type] ?? BLOCK_STYLE.p;
    const indent = (style.indent ?? 0) * ((block.depth ?? 0) + (style.indent ? 1 : 0)) + (block.indent ?? 0) * 36;
    const left = margin + indent;
    const span = limit - indent;
    y += style.before;

    if (block.type === 'rule') {
      room(6);
      page.items.push({ type: 'rule', x: margin, y, width: limit });
      y += style.after;
      continue;
    }

    if (block.type === 'image' && block.src) {
      const ratio = block.height && block.width ? block.height / block.width : 0.6;
      const drawWidth = Math.min(span, block.width ?? span);
      const drawHeight = drawWidth * ratio;
      room(drawHeight);
      page.items.push({ type: 'image', x: left, y, width: drawWidth, height: drawHeight, src: block.src });
      y += drawHeight + style.after;
      continue;
    }

    if (block.type === 'table') {
      const columns = Math.max(1, block.rows[0]?.length ?? 1);
      const cellWidth = span / columns;
      for (const row of block.rows) {
        const cells = row.map((cell) => breakLines(splitRuns(cell.runs, base, { ...style, bold: cell.head }), cellWidth - 10));
        const tall = Math.max(...cells.map((lines) => lines.length)) * style.size * spacing + 6;
        room(tall);
        page.items.push({ type: 'row', x: margin + indent, y, width: span, height: tall, columns });
        cells.forEach((lines, column) => {
          lines.forEach((line, index) => {
            let cursor = left + column * cellWidth + 5;
            for (const piece of line) {
              page.items.push({ ...piece, type: 'text', x: cursor, y: y + 4 + (index + 1) * style.size * spacing - style.size * 0.25 });
              cursor += widthOf(piece.text, piece.font, piece.size);
            }
          });
        });
        y += tall;
      }
      y += style.after;
      continue;
    }

    if (block.type === 'ordered') {
      const depth = block.depth ?? 0;
      counter.length = depth + 1;
      counter[depth] = (counter[depth] ?? 0) + 1;
    } else if (block.type !== 'bullet') {
      counter = [];
    }

    const pieces = splitRuns(block.runs, base, style);
    const lines = breakLines(pieces, span);
    const step = style.size * spacing;

    lines.forEach((line, index) => {
      room(step);
      const total = lineWidth(line);
      let cursor = left;
      if (block.align === 'center') cursor = left + (span - total) / 2;
      else if (block.align === 'right') cursor = left + span - total;

      const gaps = line.filter((piece) => piece.space).length;
      const stretch = block.align === 'justify' && index < lines.length - 1 && gaps ? (span - total) / gaps : 0;

      if (index === 0 && (block.type === 'bullet' || block.type === 'ordered')) {
        const marker = block.type === 'bullet' ? '•' : `${counter[block.depth ?? 0] ?? 1}.`;
        page.items.push({
          type: 'text', text: marker, x: left - 14, y: y + style.size,
          font: base, size: style.size, color: '#111111',
        });
      }

      for (const piece of line) {
        const size = widthOf(piece.text, piece.font, piece.size);
        if (!piece.space) {
          page.items.push({ ...piece, type: 'text', x: cursor, y: y + style.size });
        }
        cursor += size + (piece.space ? stretch : 0);
      }
      y += step;
    });

    y += style.after;
  }

  return { pages, width, height, margin };
}

export const pageCount = (layout) => layout.pages.length;

export function layoutToPdf(layout, meta = {}) {
  const doc = createPdf({ size: meta.size ?? 'a4', orientation: meta.orientation });
  layout.pages.forEach((page, index) => {
    if (index) doc.addPage();
    for (const item of page.items) {
      if (item.type === 'rule') {
        doc.line(item.x, item.y, item.x + item.width, item.y, { color: '#c8cdd2', width: 1 });
        continue;
      }
      if (item.type === 'row') {
        doc.rect(item.x, item.y, item.width, item.height, { stroke: '#d0d5da', width: 0.6 });
        for (let column = 1; column < item.columns; column += 1) {
          const at = item.x + (item.width / item.columns) * column;
          doc.line(at, item.y, at, item.y + item.height, { color: '#d0d5da', width: 0.6 });
        }
        continue;
      }
      if (item.type === 'image' && item.jpeg) {
        doc.image(item.jpeg, item.x, item.y, item.width, item.height);
        continue;
      }
      if (item.type !== 'text') continue;
      if (item.highlight) {
        doc.rect(item.x, item.y - item.size, widthOf(item.text, item.font, item.size), item.size * 1.25, { fill: item.highlight });
      }
      doc.text(item.text, {
        x: item.x,
        y: item.y,
        font: item.font,
        size: item.size,
        color: item.link ? '#1a5fb4' : item.color,
        underline: item.underline || Boolean(item.link),
        strike: item.strike,
      });
      if (item.link) {
        doc.link(item.x, item.y - item.size, widthOf(item.text, item.font, item.size), item.size * 1.2, item.link);
      }
    }
  });
  return doc.save(meta);
}
