const ASCII = (widths) => {
  const table = new Array(256).fill(widths[0]);
  widths.slice(1).forEach((width, index) => {
    table[index + 32] = width;
  });
  return table;
};

const HELVETICA = ASCII([556,
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
]);

const HELVETICA_BOLD = ASCII([556,
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
  975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
  333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611,
  611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
]);

const TIMES = ASCII([500,
  250, 333, 408, 500, 500, 833, 778, 180, 333, 333, 500, 564, 250, 333, 250, 278,
  500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 278, 278, 564, 564, 564, 444,
  921, 722, 667, 667, 722, 611, 556, 722, 722, 333, 389, 722, 611, 889, 722, 722,
  556, 722, 667, 556, 611, 722, 722, 944, 722, 722, 611, 333, 278, 333, 469, 500,
  333, 444, 500, 444, 500, 444, 333, 500, 500, 278, 278, 500, 278, 778, 500, 500,
  500, 500, 333, 389, 278, 500, 500, 722, 500, 500, 444, 480, 200, 480, 541,
]);

const TIMES_BOLD = ASCII([500,
  250, 333, 555, 500, 500, 1000, 833, 278, 333, 333, 500, 570, 250, 333, 250, 278,
  500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 333, 333, 570, 570, 570, 500,
  930, 722, 667, 722, 722, 667, 611, 778, 778, 389, 500, 778, 667, 944, 722, 778,
  611, 778, 722, 556, 667, 722, 722, 1000, 722, 722, 667, 333, 278, 333, 581, 500,
  333, 500, 556, 444, 556, 444, 333, 500, 556, 278, 333, 556, 278, 833, 556, 500,
  556, 556, 444, 389, 333, 556, 500, 722, 500, 500, 444, 394, 220, 394, 520,
]);

const TIMES_ITALIC = ASCII([500,
  250, 333, 420, 500, 500, 833, 778, 214, 333, 333, 500, 675, 250, 333, 250, 278,
  500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 333, 333, 675, 675, 675, 500,
  920, 611, 611, 667, 722, 611, 611, 722, 722, 333, 444, 667, 556, 833, 667, 722,
  611, 722, 611, 500, 556, 722, 611, 833, 611, 556, 556, 389, 278, 389, 422, 500,
  333, 500, 500, 444, 500, 444, 278, 500, 500, 278, 278, 444, 278, 722, 500, 500,
  500, 500, 389, 389, 278, 500, 444, 667, 444, 444, 389, 400, 275, 400, 541,
]);

const TIMES_BOLD_ITALIC = ASCII([500,
  250, 389, 555, 500, 500, 833, 778, 278, 333, 333, 500, 570, 250, 333, 250, 278,
  500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 333, 333, 570, 570, 570, 500,
  832, 667, 667, 667, 722, 667, 667, 722, 778, 389, 500, 667, 611, 889, 722, 722,
  611, 722, 667, 556, 611, 722, 667, 889, 667, 611, 611, 333, 278, 333, 570, 500,
  333, 500, 500, 444, 500, 444, 333, 500, 556, 278, 278, 500, 278, 778, 556, 500,
  500, 500, 389, 389, 278, 556, 444, 667, 500, 444, 389, 348, 220, 348, 570,
]);

const COURIER = new Array(256).fill(600);

export const FONTS = {
  helvetica: { base: 'Helvetica', widths: HELVETICA },
  helveticaBold: { base: 'Helvetica-Bold', widths: HELVETICA_BOLD },
  helveticaItalic: { base: 'Helvetica-Oblique', widths: HELVETICA },
  helveticaBoldItalic: { base: 'Helvetica-BoldOblique', widths: HELVETICA_BOLD },
  times: { base: 'Times-Roman', widths: TIMES },
  timesBold: { base: 'Times-Bold', widths: TIMES_BOLD },
  timesItalic: { base: 'Times-Italic', widths: TIMES_ITALIC },
  timesBoldItalic: { base: 'Times-BoldItalic', widths: TIMES_BOLD_ITALIC },
  courier: { base: 'Courier', widths: COURIER },
  courierBold: { base: 'Courier-Bold', widths: COURIER },
  courierItalic: { base: 'Courier-Oblique', widths: COURIER },
  courierBoldItalic: { base: 'Courier-BoldOblique', widths: COURIER },
};

export const PAGE_SIZES = {
  a4: [595.28, 841.89],
  a3: [841.89, 1190.55],
  a5: [419.53, 595.28],
  letter: [612, 792],
  legal: [612, 1008],
  tabloid: [792, 1224],
};

const WIN_ANSI = {
  8364: 128, 8218: 130, 402: 131, 8222: 132, 8230: 133, 8224: 134, 8225: 135,
  710: 136, 8240: 137, 352: 138, 8249: 139, 338: 140, 381: 142, 8216: 145,
  8217: 146, 8220: 147, 8221: 148, 8226: 149, 8211: 150, 8212: 151, 732: 152,
  8482: 153, 353: 154, 8250: 155, 339: 156, 382: 158, 376: 159,
};

export const toWinAnsi = (text) => {
  const out = [];
  for (const character of String(text)) {
    const code = character.codePointAt(0);
    if (code < 256) out.push(code);
    else if (WIN_ANSI[code]) out.push(WIN_ANSI[code]);
    else out.push(63);
  }
  return out;
};

export const widthOf = (text, font, size) => {
  const table = (FONTS[font] ?? FONTS.helvetica).widths;
  let total = 0;
  for (const code of toWinAnsi(text)) total += table[code] ?? 500;
  return (total * size) / 1000;
};

export function wrapText(text, font, size, limit) {
  const lines = [];
  for (const paragraph of String(text).split('\n')) {
    if (!paragraph) {
      lines.push('');
      continue;
    }
    let line = '';
    for (const word of paragraph.split(/(\s+)/)) {
      if (!word) continue;
      const next = line + word;
      if (line && widthOf(next, font, size) > limit) {
        lines.push(line.trimEnd());
        line = word.trimStart();
      } else {
        line = next;
      }
    }
    if (line.trim() || !lines.length) lines.push(line.trimEnd());
  }
  return lines;
}

const escapeString = (codes) => {
  let out = '';
  for (const code of codes) {
    if (code === 40 || code === 41 || code === 92) out += `\\${String.fromCharCode(code)}`;
    else if (code < 32 || code > 126) out += `\\${code.toString(8).padStart(3, '0')}`;
    else out += String.fromCharCode(code);
  }
  return out;
};

const colourOf = (value) => {
  if (Array.isArray(value)) return value.map((part) => Math.max(0, Math.min(1, part)));
  const hex = String(value ?? '#000000').replace('#', '');
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex.padEnd(6, '0');
  return [0, 2, 4].map((at) => parseInt(full.slice(at, at + 2), 16) / 255);
};

const number = (value) => (Math.round(value * 1000) / 1000).toString();

export function createPdf(options = {}) {
  const [defaultWidth, defaultHeight] = PAGE_SIZES[options.size] ?? PAGE_SIZES.a4;
  const landscape = options.orientation === 'landscape';
  const size = landscape ? [defaultHeight, defaultWidth] : [defaultWidth, defaultHeight];

  const pages = [];
  const images = [];
  const usedFonts = new Set();
  let page = null;

  const start = () => {
    page = { width: size[0], height: size[1], parts: [], links: [] };
    pages.push(page);
    return page;
  };

  const need = () => page ?? start();

  const api = {
    get pageCount() {
      return pages.length;
    },
    get size() {
      return { width: size[0], height: size[1] };
    },

    addPage() {
      return start();
    },

    text(value, spot = {}) {
      const target = need();
      const font = spot.font ?? 'helvetica';
      const fontSize = spot.size ?? 12;
      usedFonts.add(font);
      const [r, g, b] = colourOf(spot.color);
      const body = escapeString(toWinAnsi(value));
      const y = target.height - (spot.y ?? 0);
      const parts = [`BT /${font} ${number(fontSize)} Tf ${number(r)} ${number(g)} ${number(b)} rg`];
      if (spot.charSpacing) parts.push(`${number(spot.charSpacing)} Tc`);
      parts.push(`1 0 0 1 ${number(spot.x ?? 0)} ${number(y)} Tm (${body}) Tj`);
      if (spot.charSpacing) parts.push('0 Tc');
      parts.push('ET');
      target.parts.push(parts.join(' '));

      if (spot.underline || spot.strike) {
        const width = widthOf(value, font, fontSize) + (spot.charSpacing ?? 0) * Math.max(0, value.length - 1);
        const offset = spot.underline ? fontSize * 0.12 : -fontSize * 0.28;
        api.line(spot.x ?? 0, (spot.y ?? 0) + offset, (spot.x ?? 0) + width, (spot.y ?? 0) + offset, {
          color: spot.color,
          width: Math.max(0.4, fontSize / 16),
        });
      }
      return api;
    },

    line(x1, y1, x2, y2, spot = {}) {
      const target = need();
      const [r, g, b] = colourOf(spot.color);
      target.parts.push(
        `${number(r)} ${number(g)} ${number(b)} RG ${number(spot.width ?? 1)} w ` +
          `${number(x1)} ${number(target.height - y1)} m ${number(x2)} ${number(target.height - y2)} l S`,
      );
      return api;
    },

    rect(x, y, width, height, spot = {}) {
      const target = need();
      const shape = `${number(x)} ${number(target.height - y - height)} ${number(width)} ${number(height)} re`;
      if (spot.fill) {
        const [r, g, b] = colourOf(spot.fill);
        target.parts.push(`${number(r)} ${number(g)} ${number(b)} rg ${shape} f`);
      }
      if (spot.stroke) {
        const [r, g, b] = colourOf(spot.stroke);
        target.parts.push(`${number(r)} ${number(g)} ${number(b)} RG ${number(spot.width ?? 1)} w ${shape} S`);
      }
      return api;
    },

    image(jpeg, x, y, width, height) {
      const target = need();
      const name = `Im${images.length + 1}`;
      images.push({ name, data: jpeg.data, width: jpeg.width, height: jpeg.height, grey: jpeg.grey });
      target.parts.push(
        `q ${number(width)} 0 0 ${number(height)} ${number(x)} ${number(target.height - y - height)} cm /${name} Do Q`,
      );
      return api;
    },

    link(x, y, width, height, url) {
      const target = need();
      target.links.push({ x, y: target.height - y - height, width, height, url });
      return api;
    },

    save(meta = {}) {
      if (!pages.length) start();
      const chunks = [];
      const offsets = [0];
      let length = 0;
      const push = (text) => {
        const bytes = typeof text === 'string' ? new TextEncoder().encode(text) : text;
        chunks.push(bytes);
        length += bytes.length;
      };
      const object = (body) => {
        offsets.push(length);
        push(`${offsets.length - 1} 0 obj\n`);
        if (typeof body === 'string') push(body);
        else push(body);
        push('\nendobj\n');
        return offsets.length - 1;
      };

      push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');

      const fontIds = new Map();
      for (const key of usedFonts) {
        const font = FONTS[key] ?? FONTS.helvetica;
        fontIds.set(key, object(`<< /Type /Font /Subtype /Type1 /BaseFont /${font.base} /Encoding /WinAnsiEncoding >>`));
      }

      const imageIds = new Map();
      for (const picture of images) {
        offsets.push(length);
        const id = offsets.length - 1;
        push(`${id} 0 obj\n`);
        push(
          `<< /Type /XObject /Subtype /Image /Width ${picture.width} /Height ${picture.height} ` +
            `/ColorSpace /Device${picture.grey ? 'Gray' : 'RGB'} /BitsPerComponent 8 /Filter /DCTDecode ` +
            `/Length ${picture.data.length} >>\nstream\n`,
        );
        push(picture.data);
        push('\nendstream\nendobj\n');
        imageIds.set(picture.name, id);
      }

      const pageIds = [];
      const contentIds = [];
      const annotIds = [];
      for (const entry of pages) {
        const body = entry.parts.join('\n');
        contentIds.push(object(`<< /Length ${new TextEncoder().encode(body).length} >>\nstream\n${body}\nendstream`));
        const ids = entry.links.map((spot) =>
          object(
            `<< /Type /Annot /Subtype /Link /Rect [${number(spot.x)} ${number(spot.y)} ${number(spot.x + spot.width)} ${number(spot.y + spot.height)}] ` +
              `/Border [0 0 0] /A << /S /URI /URI (${escapeString(toWinAnsi(spot.url))}) >> >>`,
          ),
        );
        annotIds.push(ids);
      }

      const pagesId = offsets.length + pages.length;
      pages.forEach((entry, index) => {
        const fonts = [...fontIds].map(([key, id]) => `/${key} ${id} 0 R`).join(' ');
        const pictures = [...imageIds].map(([name, id]) => `/${name} ${id} 0 R`).join(' ');
        const resources =
          `<< /Font << ${fonts} >>` + (pictures ? ` /XObject << ${pictures} >>` : '') + ' >>';
        const annots = annotIds[index].length ? ` /Annots [${annotIds[index].map((id) => `${id} 0 R`).join(' ')}]` : '';
        pageIds.push(
          object(
            `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${number(entry.width)} ${number(entry.height)}] ` +
              `/Resources ${resources} /Contents ${contentIds[index]} 0 R${annots} >>`,
          ),
        );
      });

      const kids = pageIds.map((id) => `${id} 0 R`).join(' ');
      object(`<< /Type /Pages /Count ${pageIds.length} /Kids [${kids}] >>`);

      const stamp = (value) => escapeString(toWinAnsi(value ?? ''));
      const infoId = object(
        `<< /Title (${stamp(meta.title)}) /Author (${stamp(meta.author)}) /Creator (${stamp(meta.creator ?? 'Toolbox')}) ` +
          `/Producer (${stamp(meta.creator ?? 'Toolbox')}) >>`,
      );
      const catalogId = object(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

      const xrefAt = length;
      const count = offsets.length;
      push(`xref\n0 ${count}\n0000000000 65535 f \n`);
      for (let i = 1; i < count; i += 1) push(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
      push(`trailer\n<< /Size ${count} /Root ${catalogId} 0 R /Info ${infoId} 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`);

      const out = new Uint8Array(length);
      let at = 0;
      for (const chunk of chunks) {
        out.set(chunk, at);
        at += chunk.length;
      }
      return out;
    },
  };

  return api;
}
