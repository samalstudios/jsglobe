// Builds the country outlines for True Size from Natural Earth's 1:50m
// countries, which are in the public domain.
//
//   node scripts/countries-import.mjs path/to/ne_50m_admin_0_countries.geojson
//
// Outlines are thinned and packed as hundredths of a degree; each country keeps
// the area worked out from its full outline, and its name in the languages the
// site speaks. The result is js/apps/true-size/countries.js.
import { readFile, writeFile } from 'node:fs/promises';
import { packRings, polygonsArea, simplifyRing } from '../js/lib/geo.js';

const source = process.argv[2];
if (!source) {
  console.error('which file? node scripts/countries-import.mjs ne_50m_admin_0_countries.geojson');
  process.exit(1);
}
const data = JSON.parse(await readFile(source, 'utf8'));
const LANGS = { en: 'NAME_EN', de: 'NAME_DE', es: 'NAME_ES', zh: 'NAME_ZH', fr: 'NAME_FR', pt: 'NAME_PT', ja: 'NAME_JA', ko: 'NAME_KO', nl: 'NAME_NL', sv: 'NAME_SV', pl: 'NAME_PL', uk: 'NAME_UK' };

const ringBounds = (ring) => {
  let w = Infinity;
  let e = -Infinity;
  let s = Infinity;
  let n = -Infinity;
  for (const [x, y] of ring) {
    w = Math.min(w, x);
    e = Math.max(e, x);
    s = Math.min(s, y);
    n = Math.max(n, y);
  }
  return Math.max(e - w, n - s);
};

const countries = [];
let points = 0;
for (const feature of data.features) {
  const p = feature.properties;
  const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
  const area = polygonsArea(polygons);
  // Small countries keep their detail; big ones lose what cannot be seen.
  // Specks of islands go, unless they are all there is.
  const size = Math.sqrt(area);
  const tolerance = size > 1500 ? 0.08 : size > 400 ? 0.04 : 0.01;
  const biggest = Math.max(...polygons.map((polygon) => ringBounds(polygon[0])));
  const rings = [];
  for (const polygon of polygons) {
    for (const ring of polygon) {
      if (biggest > 1 && ringBounds(ring) < biggest * 0.004 && ringBounds(ring) < 0.15) continue;
      const thin = simplifyRing(ring.slice(0, -1), tolerance);
      if (thin.length >= 3) rings.push(thin);
    }
  }
  if (!rings.length) continue;
  const packed = packRings(rings).filter((flat) => flat.length >= 6);
  points += packed.reduce((sum, flat) => sum + flat.length / 2, 0);
  const names = {};
  for (const [lang, key] of Object.entries(LANGS)) if (p[key] && (lang === 'en' || p[key] !== p.NAME_EN)) names[lang] = p[key];
  countries.push({
    id: p.ADM0_A3.toLowerCase(),
    names,
    area: Math.round(area),
    continent: p.CONTINENT,
    label: [Math.round(p.LABEL_X * 100) / 100, Math.round(p.LABEL_Y * 100) / 100],
    rings: packed,
  });
}
countries.sort((a, b) => a.names.en.localeCompare(b.names.en));
const ids = new Set();
for (const country of countries) {
  let id = country.id;
  for (let n = 2; ids.has(id); n += 1) id = `${country.id}-${n}`;
  ids.add(id);
  country.id = id;
}

const today = new Date().toISOString().slice(0, 10);
const body = countries.map((country) => `  ${JSON.stringify(country)},`).join('\n');
await writeFile(
  'js/apps/true-size/countries.js',
  `// Country outlines from Natural Earth (public domain, naturalearthdata.com), 1:50m,
// thinned by scripts/countries-import.mjs on ${today}. Points are hundredths of
// a degree, each the difference from the one before; areas are square
// kilometres worked out from the full outlines.
export default [
${body}
];
`,
);
console.log(`${countries.length} countries, ${points} points`);
