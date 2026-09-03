// Finding the passages of a document that answer a question, and building the
// prompt that asks a model to answer from those passages alone.
//
// Retrieval is lexical by default, which needs no model and no download and is
// hard to beat on names, codes and exact wording. Where a runtime can turn text
// into vectors, those scores blend in on top.

const STOP = new Set(
  ('a about above after again against all am an and any are as at be because been before being below between both but by ' +
    'can did do does doing down during each few for from further had has have having he her here hers him his how i if in ' +
    'into is it its itself just me more most my no nor not of off on once only or other our out over own same she should so ' +
    'some such than that the their them then there these they this those through to too under until up very was we were ' +
    'what when where which while who whom why will with you your').split(' '),
);

// enough of a stemmer to join plurals and common endings without a word list
const stem = (word) => {
  let out = word;
  if (out.length > 4 && out.endsWith('ies')) return `${out.slice(0, -3)}y`;
  for (const tail of ['ations', 'ation', 'ingly', 'edly', 'ings', 'ing', 'ers', 'er', 'ed', 'es', 's']) {
    if (out.length > tail.length + 2 && out.endsWith(tail)) {
      out = out.slice(0, -tail.length);
      break;
    }
  }
  return out;
};

export const tokenise = (text) =>
  String(text ?? '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}_'-]+/u)
    .map((word) => word.replace(/^['-]+|['-]+$/g, ''))
    .filter((word) => word.length > 1 && !STOP.has(word))
    .map(stem);

// break on paragraphs where possible, so a passage reads as something whole
export const chunkText = (text, { size = 900, overlap = 150 } = {}) => {
  const clean = String(text ?? '').replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!clean) return [];
  if (clean.length <= size) return [{ text: clean, from: 0, to: clean.length }];

  const chunks = [];
  let at = 0;
  while (at < clean.length) {
    let end = Math.min(clean.length, at + size);
    if (end < clean.length) {
      const window = clean.slice(at, end);
      const breaks = [window.lastIndexOf('\n\n'), window.lastIndexOf('\n'), window.lastIndexOf('. ')];
      const cut = breaks.find((mark) => mark > size * 0.45);
      if (cut !== undefined && cut > 0) end = at + cut + 1;
    }
    const body = clean.slice(at, end).trim();
    if (body) chunks.push({ text: body, from: at, to: end });
    if (end >= clean.length) break;
    at = Math.max(end - overlap, at + 1);
  }
  return chunks;
};

export const buildIndex = (passages) => {
  const postings = new Map();
  const lengths = [];

  passages.forEach((passage, at) => {
    const terms = tokenise(passage.text);
    lengths[at] = terms.length;
    const counts = new Map();
    for (const term of terms) counts.set(term, (counts.get(term) ?? 0) + 1);
    for (const [term, count] of counts) {
      const list = postings.get(term) ?? [];
      list.push([at, count]);
      postings.set(term, list);
    }
  });

  const total = lengths.reduce((sum, length) => sum + length, 0);
  return { postings, lengths, passages, average: passages.length ? total / passages.length : 0 };
};

const K1 = 1.4;
const B = 0.72;

export const searchIndex = (index, query, { limit = 6 } = {}) => {
  if (!index?.passages.length) return [];
  const terms = [...new Set(tokenise(query))];
  if (!terms.length) return [];

  const scores = new Map();
  const hits = new Map();

  for (const term of terms) {
    const list = index.postings.get(term);
    if (!list) continue;
    const idf = Math.log(1 + (index.passages.length - list.length + 0.5) / (list.length + 0.5));
    for (const [at, count] of list) {
      const length = index.lengths[at] || 1;
      const weight = (count * (K1 + 1)) / (count + K1 * (1 - B + (B * length) / (index.average || 1)));
      scores.set(at, (scores.get(at) ?? 0) + idf * weight);
      hits.set(at, (hits.get(at) ?? new Set()).add(term));
    }
  }

  return [...scores.entries()]
    .map(([at, score]) => ({
      at,
      passage: index.passages[at],
      score,
      // a passage that covers more of the question is worth more than one that
      // repeats a single word of it
      matched: [...(hits.get(at) ?? [])],
      coverage: (hits.get(at)?.size ?? 0) / terms.length,
    }))
    .map((hit) => ({ ...hit, score: hit.score * (0.55 + 0.45 * hit.coverage) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
};

export const cosine = (a, b) => {
  let dot = 0;
  let left = 0;
  let right = 0;
  for (let at = 0; at < a.length; at += 1) {
    dot += a[at] * b[at];
    left += a[at] * a[at];
    right += b[at] * b[at];
  }
  const size = Math.sqrt(left) * Math.sqrt(right);
  return size ? dot / size : 0;
};

// where vectors exist, mix the two rankings by where each passage placed rather
// than by raw scores, which are on different scales
export const blend = (lexical, vector, { limit = 6, weight = 0.5 } = {}) => {
  const places = new Map();
  const seen = new Map();
  const add = (list, share) => {
    list.forEach((hit, place) => {
      places.set(hit.at, (places.get(hit.at) ?? 0) + share / (place + 60));
      seen.set(hit.at, { ...(seen.get(hit.at) ?? {}), ...hit });
    });
  };
  add(lexical, 1 - weight);
  add(vector, weight);

  return [...places.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([at, score]) => ({ ...seen.get(at), at, score }));
};

export const SYSTEM = [
  'You answer questions using only the numbered sources given to you.',
  'Cite every claim with the number of the source it came from, written in square brackets, like [2].',
  'A sentence may cite more than one source, like [1][3].',
  'If the sources do not answer the question, say so plainly and do not guess.',
  'Keep the answer short and plain. Do not mention that you were given sources.',
].join(' ');

export const buildPrompt = (question, hits) => {
  const sources = hits
    .map((hit, at) => `[${at + 1}] ${hit.passage.title ? `${hit.passage.title}\n` : ''}${hit.passage.text}`)
    .join('\n\n');
  return [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: `Sources:\n\n${sources}\n\nQuestion: ${question}` },
  ];
};

// which sources the answer actually leaned on, in the order it cited them
export const citedIn = (answer, count) => {
  const found = [];
  for (const [, number] of String(answer ?? '').matchAll(/\[(\d{1,2})\]/g)) {
    const at = Number(number);
    if (at >= 1 && at <= count && !found.includes(at)) found.push(at);
  }
  return found;
};

// the sentence around the words the question was asking about, for a preview. A
// heading on its own says nothing, so it carries the line after it
export const bestLine = (text, terms = []) => {
  const lines = String(text)
    .split(/(?<=[.!?])\s+|\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return String(text).slice(0, 200);

  let best = 0;
  let top = -1;
  lines.forEach((line, at) => {
    const words = new Set(tokenise(line));
    const hits = terms.reduce((sum, term) => sum + (words.has(term) ? 1 : 0), 0);
    const score = hits * 10 + Math.min(line.length, 120) / 120;
    if (score > top) {
      top = score;
      best = at;
    }
  });

  let out = lines[best];
  let at = best;
  while (out.length < 60 && lines[at + 1]) {
    at += 1;
    out = `${out} ${lines[at]}`;
  }
  return out;
};
