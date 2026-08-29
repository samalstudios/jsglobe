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

export const paperOf = (setup = {}) => {
  const [w, h] = PAGE_SIZES[setup.size ?? 'a4'] ?? PAGE_SIZES.a4;
  const landscape = setup.orientation === 'landscape';
  return {
    width: landscape ? h : w,
    height: landscape ? w : h,
    margin: setup.margin ?? 72,
    columns: Math.max(1, Math.min(3, Math.round(setup.columns ?? 1))),
  };
};

export function layoutDocument(blocks, options = {}) {
  const base = options.font ?? 'helvetica';
  const spacing = options.spacing ?? 1.45;

  let paper = paperOf(options);
  let width = paper.width;
  let height = paper.height;
  let margin = paper.margin;
  let columns = paper.columns;
  let gutter = columns > 1 ? 26 : 0;
  let limit = (width - margin * 2 - gutter * (columns - 1)) / columns;
  let bottom = height - margin;

  const first = { width, height, margin };

  const pages = [];
  let page = null;
  let y = margin;
  let column = 0;

  const openPage = () => {
    page = { items: [], starts: [], last: -1, width, height, margin, columns };
    pages.push(page);
    y = margin;
    column = 0;
  };
  openPage();

  const usePaper = (setup) => {
    paper = paperOf({ ...options, ...setup });
    width = paper.width;
    height = paper.height;
    margin = paper.margin;
    columns = paper.columns;
    gutter = columns > 1 ? 26 : 0;
    limit = (width - margin * 2 - gutter * (columns - 1)) / columns;
    bottom = height - margin;
  };

  const columnLeft = () => margin + column * (limit + gutter);

  const room = (needed) => {
    if (y + needed <= bottom) return;
    if (column < columns - 1) {
      column += 1;
      y = margin;
      return;
    }
    openPage();
  };

  let counter = [];

  let blockIndex = -1;
  for (const block of blocks) {
    blockIndex += 1;
    if (block.type === 'break') {
      if (page.items.length) {
        openPage();
        page.forced = true;
      }
      continue;
    }
    if (block.type === 'section') {
      usePaper(block.setup ?? {});
      if (page.items.length) {
        openPage();
        page.forced = true;
      } else {
        page.width = width;
        page.height = height;
        page.margin = margin;
        page.columns = columns;
      }
      continue;
    }
    const style = BLOCK_STYLE[block.type] ?? BLOCK_STYLE.p;
    page.starts.push(blockIndex);
    page.last = blockIndex;
    const indent = (style.indent ?? 0) * ((block.depth ?? 0) + (style.indent ? 1 : 0)) + (block.indent ?? 0) * 36;
    const left = columnLeft() + indent;
    const span = limit - indent;
    y += style.before;

    if (block.type === 'rule') {
      room(6);
      page.items.push({ type: 'rule', x: columnLeft(), y, width: limit });
      y += style.after;
      continue;
    }

    if (block.type === 'image' && block.src) {
      const ratio = block.jpeg?.ratio ?? (block.height && block.width ? block.height / block.width : 0.6);
      const drawWidth = Math.min(span, span * (block.share ?? 1));
      const drawHeight = drawWidth * ratio;
      room(drawHeight);
      const shift = block.align === 'center' ? (span - drawWidth) / 2 : block.align === 'right' ? span - drawWidth : 0;
      page.items.push({ type: 'image', x: left + shift, y, width: drawWidth, height: drawHeight, src: block.src, jpeg: block.jpeg });
      y += drawHeight + style.after;
      continue;
    }

    if (block.type === 'table') {
      const columns = Math.max(1, block.rows[0]?.length ?? 1);
      const cellWidth = span / columns;
      for (const row of block.rows) {
        const cells = row.map((cell) => breakLines(splitRuns(cell.runs, base, { ...style, bold: cell.head }), cellWidth - 10));
        void cells;
        const tall = Math.max(...cells.map((lines) => lines.length)) * style.size * spacing + 6;
        room(tall);
        page.items.push({ type: 'row', x: columnLeft() + indent, y, width: span, height: tall, columns: cells.length });
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

    if (options.keepBlocks !== false) {
      const tall = lines.length * step;
      const roomLeft = bottom - y;
      const roomFull = bottom - margin;
      if (tall > roomLeft && tall <= roomFull) room(tall);
    }

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

  while (pages.length > 1 && !pages[pages.length - 1].items.length && !pages[pages.length - 1].forced) pages.pop();

  return { pages, width: first.width, height: first.height, margin: first.margin, columns };
}

export const pageCount = (layout) => layout.pages.length;

export function layoutToPdf(layout, meta = {}) {
  const doc = createPdf({ size: meta.size ?? 'a4', orientation: meta.orientation });
  layout.pages.forEach((page, index) => {
    if (index) doc.addPage({ width: page.width, height: page.height });
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

    if (meta.header) {
      doc.text(meta.header, { x: page.margin, y: page.margin / 2 + 4, font: 'helvetica', size: 8.5, color: '#7a828a' });
    }
    if (meta.numbers || meta.footer) {
      const foot = page.height - page.margin / 2;
      if (meta.footer) {
        doc.text(meta.footer, { x: page.margin, y: foot, font: 'helvetica', size: 8.5, color: '#7a828a' });
      }
      if (meta.numbers) {
        const label = `${index + 1} / ${layout.pages.length}`;
        const wide = widthOf(label, 'helvetica', 8.5);
        doc.text(label, { x: page.width - page.margin - wide, y: foot, font: 'helvetica', size: 8.5, color: '#7a828a' });
      }
    }
  });
  return doc.save(meta);
}
