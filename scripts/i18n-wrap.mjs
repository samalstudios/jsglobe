import { readFile, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';

const SKIP_TEXT = new Set([
  'OK', 'ID', 'URL', 'URI', 'JSON', 'YAML', 'XML', 'HTML', 'CSS', 'SVG', 'PNG', 'JPG', 'JPEG', 'GIF',
  'WEBP', 'PDF', 'CSV', 'TSV', 'MP3', 'MP4', 'WAV', 'UTF-8', 'ASCII', 'Base64', 'HEX', 'RGB', 'HSL',
  'OKLCH', 'HTTP', 'HTTPS', 'DNS', 'IP', 'IPv4', 'IPv6', 'MAC', 'SSH', 'TLS', 'SSL', 'JWT', 'API',
  'MIDI', 'QR', 'AES', 'RSA', 'SHA', 'MD5', 'HMAC', 'TOTP', 'UUID', 'ULID', 'CIDR', 'SQL', 'K8s',
]);

const slug = (text) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .slice(0, 5)
    .map((word, index) => (index ? word[0].toUpperCase() + word.slice(1) : word))
    .join('') || 'text';

const skip = (text) => {
  const clean = text.trim();
  if (!clean) return true;
  if (clean.includes('${') || clean.includes('`')) return true;
  if (SKIP_TEXT.has(clean)) return true;
  if (!/[A-Za-z]{2}/.test(clean)) return true;
  if (/^[-=+*/<>|·•✕✓×▾▸↑↓⇅⇄→←]+$/.test(clean)) return true;
  if (clean.length > 120) return true;
  if (/^(https?:\/\/|www\.|mailto:|tel:)/i.test(clean)) return true;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return true;
  if (/^[A-Za-z0-9_.-]+\.(com|org|net|io|dev|js|json|txt|css|html|svg|png)$/i.test(clean)) return true;
  return false;
};

// Collect the literal text spans of every html`...` template, skipping ${} expressions
// but recursing into them so nested html`` templates are found too.
const htmlSpans = (source) => {
  const spans = [];

  const scanTemplate = (start, collect) => {
    let i = start;
    while (i < source.length) {
      const char = source[i];
      if (char === '\\') {
        i += 2;
        continue;
      }
      if (char === '`') {
        if (collect && i > start) spans.push([start, i]);
        return i + 1;
      }
      if (char === '$' && source[i + 1] === '{') {
        if (collect && i > start) spans.push([start, i]);
        i = scanExpression(i + 2);
        start = i;
        continue;
      }
      i += 1;
    }
    if (collect && i > start) spans.push([start, i]);
    return i;
  };

  const scanExpression = (start) => {
    let i = start;
    let depth = 1;
    while (i < source.length) {
      const char = source[i];
      if (char === '\\') {
        i += 2;
        continue;
      }
      if (char === '{') depth += 1;
      else if (char === '}') {
        depth -= 1;
        if (!depth) return i + 1;
      } else if (char === '`') {
        const isHtml = /html\s*$/.test(source.slice(Math.max(0, i - 8), i));
        i = scanTemplate(i + 1, isHtml);
        continue;
      } else if (char === "'" || char === '"') {
        i = scanString(i + 1, char);
        continue;
      }
      i += 1;
    }
    return i;
  };

  const scanString = (start, quote) => {
    let i = start;
    while (i < source.length) {
      if (source[i] === '\\') {
        i += 2;
        continue;
      }
      if (source[i] === quote) return i + 1;
      i += 1;
    }
    return i;
  };

  let guard = 0;
  for (const match of source.matchAll(/\bhtml\s*`/g)) {
    const open = match.index + match[0].length;
    if (open < guard) continue;
    guard = scanTemplate(open, true);
  }

  return spans.sort((a, b) => a[0] - b[0]).filter(([start, end]) => end > start);
};

export const wrap = (source, appId) => {
  const strings = new Map();

  const key = (text) => {
    const base = `${appId}.${slug(text)}`;
    let candidate = base;
    let n = 2;
    while (strings.has(candidate) && strings.get(candidate) !== text) candidate = `${base}${n++}`;
    strings.set(candidate, text);
    return candidate;
  };

  const quote = (text) => text.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

  const translateMarkup = (chunk) => {
    let out = chunk.replace(
      /\b(placeholder|title|aria-label|label|hint|empty)="([^"<>${}\\]+)"/g,
      (match, attribute, text) => {
        if (skip(text)) return match;
        return `${attribute}="\${t('${key(text)}', '${quote(text)}')}"`;
      },
    );
    out = out.replace(/>([^<>${}\n]+)</g, (match, text) => {
      const trimmed = text.trim();
      if (skip(trimmed)) return match;
      const [, lead] = /^(\s*)/.exec(text);
      const [, tail] = /(\s*)$/.exec(text);
      return `>${lead}\${t('${key(trimmed)}', '${quote(trimmed)}')}${tail}<`;
    });
    return out;
  };

  const spans = htmlSpans(source);
  let out = '';
  let cursor = 0;
  for (const [start, end] of spans) {
    if (start < cursor) continue;
    out += source.slice(cursor, start);
    out += translateMarkup(source.slice(start, end));
    cursor = end;
  }
  out += source.slice(cursor);

  // label: 'Text' object properties are safe anywhere
  out = out.replace(/\blabel: '([^'\\${}]+)'/g, (match, text) => {
    if (skip(text)) return match;
    return `label: t('${key(text)}', '${quote(text)}')`;
  });

  if (strings.size && !out.includes("from '../core/i18n.js'")) {
    const first = out.indexOf('\n', out.indexOf('import '));
    out = `${out.slice(0, first + 1)}import { t } from '../core/i18n.js';\n${out.slice(first + 1)}`;
  }

  return { out, strings };
};

const files = process.argv.slice(2);
const manifest = {};
for (const file of files) {
  const source = await readFile(file, 'utf8');
  const appId = basename(file, '.js');
  const { out, strings } = wrap(source, appId);
  if (!strings.size) continue;
  await writeFile(file, out);
  for (const [k, v] of strings) manifest[k] = v;
  console.error(`${file}: ${strings.size} strings`);
}
console.log(JSON.stringify(manifest, null, 2));
