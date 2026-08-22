// Turning words into an icon. The model is asked for a short layer list built
// only from parts that exist; when there is no model, a keyword match picks
// something sensible so the button always does something.
import { parts, searchParts } from './icon-parts.js';

export const PALETTES = {
  ink: ['#111318', '#3b3f4a', '#8b90a0'],
  sky: ['#1e6fd9', '#4f9bf0', '#a9cdf7'],
  moss: ['#2c6e49', '#4c956c', '#a8d5b5'],
  ember: ['#b4341f', '#e2683f', '#f4b183'],
  plum: ['#6a2c70', '#a24d7a', '#d78ca8'],
  sand: ['#8a6a3a', '#c19a5b', '#e6d3a3'],
  slate: ['#33404f', '#5b6b7d', '#9aa7b6'],
  candy: ['#c62368', '#f0669a', '#ffc2d6'],
};

const WORDS = [
  { match: /star|favourite|favorite|rate|award|premium/, want: ['star'] },
  { match: /gear|cog|setting|engine|machine|config/, want: ['gear'] },
  { match: /sun|solar|bright|day|shine|light/, want: ['rays', 'hoop'] },
  { match: /flower|bloom|petal|garden|spring|plant/, want: ['petal'] },
  { match: /arrow|send|next|forward|go|direction|move/, want: ['arrow'] },
  { match: /chart|graph|stats|data|report|analytic/, want: ['bars'] },
  { match: /wave|sound|audio|music|signal|radio/, want: ['wave'] },
  { match: /shield|secure|safe|guard|protect|privacy/, want: ['shield'] },
  { match: /drop|water|rain|liquid|ink|oil/, want: ['droplet'] },
  { match: /grid|layout|dashboard|tile|table/, want: ['lattice', 'dots'] },
  { match: /ring|circle|round|orbit|loop|cycle/, want: ['hoop', 'rings'] },
  { match: /pie|slice|share|portion|segment/, want: ['pie'] },
  { match: /cross|plus|add|health|medical|clinic/, want: ['cross'] },
  { match: /badge|shape|block|hex|polygon|token/, want: ['poly'] },
  { match: /blob|organic|soft|fluid|cloud/, want: ['blob'] },
  { match: /bolt|zig|energy|power|fast|flash/, want: ['zigzag'] },
  { match: /halo|crown|spark|magic|glow/, want: ['halo', 'rays'] },
];

const pickFrom = (family, seed) => {
  const list = parts().filter((part) => part.family === family);
  if (!list.length) return null;
  return list[seed % list.length];
};

const hash = (text) => {
  let value = 7;
  for (const letter of text) value = (value * 31 + letter.charCodeAt(0)) % 100000;
  return value;
};

// Build something reasonable without a model at all.
export function composeFromWords(prompt) {
  const text = prompt.toLowerCase();
  const seed = hash(text || 'icon');
  const families = [];
  for (const rule of WORDS) {
    if (rule.match.test(text)) families.push(...rule.want);
  }
  if (!families.length) families.push('poly', 'star');

  const palette = Object.keys(PALETTES)[seed % Object.keys(PALETTES).length];
  const colours = PALETTES[palette];

  const layers = [];
  const backdrop = pickFrom('poly', seed);
  if (backdrop && !families.includes('poly')) {
    layers.push({ part: backdrop.id, fill: colours[2], scale: 1, x: 0, y: 0, rotate: 0 });
  }

  families.slice(0, 3).forEach((family, index) => {
    const chosen = pickFrom(family, seed + index * 37);
    if (!chosen) return;
    layers.push({
      part: chosen.id,
      fill: colours[Math.min(index, colours.length - 1)],
      scale: index === 0 ? 1 : 0.62 - index * 0.12,
      x: 0,
      y: 0,
      rotate: 0,
    });
  });

  return { layers, palette, source: 'words' };
}

export const vocabulary = (limit = 90) => {
  const seen = new Map();
  for (const part of parts()) {
    if (!seen.has(part.family)) seen.set(part.family, { family: part.family, name: part.name, sample: part.id, count: 0 });
    seen.get(part.family).count += 1;
  }
  return [...seen.values()].slice(0, limit);
};

export const SYSTEM = `You design small icons by stacking existing parts.
Reply with JSON only, no prose and no code fence, shaped like:
{"layers":[{"part":"poly:6-0-0","fill":"#1e6fd9","scale":1,"x":0,"y":0,"rotate":0}]}
Rules:
- between one and four layers, back to front
- "part" must be an id from the list you are given
- "fill" is a hex colour
- "scale" is 0.2 to 1.2, "x" and "y" are -30 to 30, "rotate" is -180 to 180
- the first layer is usually a large background shape, later layers sit on top`;

// Only accept a layer that names a part that really exists.
export function readLayers(text) {
  const cleaned = String(text).replace(/```[a-z]*|```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) return null;

  let parsed;
  try {
    parsed = JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!Array.isArray(parsed?.layers)) return null;

  const known = new Set(parts().map((part) => part.id));
  const clamp = (value, low, high, fallback) => {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(high, Math.max(low, number)) : fallback;
  };

  const layers = parsed.layers
    .filter((layer) => layer && known.has(layer.part))
    .slice(0, 4)
    .map((layer) => ({
      part: layer.part,
      fill: /^#[0-9a-f]{3,8}$/i.test(layer.fill ?? '') ? layer.fill : '#333333',
      scale: clamp(layer.scale, 0.2, 1.2, 1),
      x: clamp(layer.x, -30, 30, 0),
      y: clamp(layer.y, -30, 30, 0),
      rotate: clamp(layer.rotate, -180, 180, 0),
    }));

  return layers.length ? { layers, source: 'model' } : null;
}

// A short menu of ids to show the model, biased towards anything the words hint at.
export function shortlist(prompt, size = 70) {
  const text = prompt.toLowerCase();
  const wanted = new Set();
  for (const rule of WORDS) {
    if (rule.match.test(text)) rule.want.forEach((family) => wanted.add(family));
  }

  const all = parts();
  const picked = [];
  const seen = new Set();

  const take = (part) => {
    if (!part || seen.has(part.id)) return;
    seen.add(part.id);
    picked.push(part);
  };

  for (const family of wanted) {
    all.filter((part) => part.family === family).slice(0, 12).forEach(take);
  }
  for (const word of text.split(/[^a-z0-9]+/).filter((entry) => entry.length > 2)) {
    searchParts(word, 6).forEach(take);
  }
  // always offer a spread of the basics
  for (const family of ['poly', 'star', 'hoop', 'arrow', 'blob', 'cross', 'rays', 'wave']) {
    all.filter((part) => part.family === family).slice(0, 5).forEach(take);
  }

  return picked.slice(0, size);
}
