import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { LANGUAGES } from '../js/core/languages.js';

const root = resolve(process.argv[2] ?? '.');
if (!root.startsWith(process.cwd())) {
  console.error(`Error: serve root "${root}" is outside the current working directory.`);
  process.exit(1);
}
const port = Number(process.env.PORT ?? 4173);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

const send = (response, status, body, type) => {
  response.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': 'no-cache',
  });
  response.end(body);
};

const readIfFile = async (path) => {
  try {
    const info = await stat(path);
    if (!info.isFile()) return null;
    return await readFile(path);
  } catch {
    return null;
  }
};

const LANGUAGE_PATHS = new Set(LANGUAGES.map((entry) => entry.path).filter(Boolean));

createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const requested = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
  const target = join(root, requested);

  if (!target.startsWith(root)) return send(response, 403, 'Forbidden', 'text/plain');

  const direct = await readIfFile(target);
  if (direct) return send(response, 200, direct, TYPES[extname(target)] ?? 'application/octet-stream');

  if (extname(requested)) return send(response, 404, `Not found: ${requested}`, 'text/plain');

  const indexed = await readIfFile(join(target, 'index.html'));
  if (indexed) return send(response, 200, indexed, TYPES['.html']);

  const language = requested.split('/').filter(Boolean)[0];
  if (language && LANGUAGE_PATHS.has(language)) {
    const localised = await readIfFile(join(root, language, 'index.html'));
    if (localised) return send(response, 200, localised, TYPES['.html']);
  }

  const shell = await readIfFile(join(root, 'index.html'));
  if (shell) return send(response, 200, shell, TYPES['.html']);

  send(response, 404, 'Not found', 'text/plain');
}).listen(port, () => {
  console.log(`jsglobe dev server running at http://localhost:${port}`);
  console.log(`serving ${root} with SPA fallback to index.html`);
});
