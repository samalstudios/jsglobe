// A page for each city, written by scripts/build-seo.mjs, so a search for a
// city's metro map finds its map. It is never loaded in the browser.
import { buildNetwork } from '../../lib/metro.js';
import MAPS from './maps/index.js';

const networks = new Map();
const networkOf = async (entry) => {
  if (!networks.has(entry.id)) networks.set(entry.id, buildNetwork((await entry.load()).default));
  return networks.get(entry.id);
};

/** Every station once, line by line, in the order the line calls at them. */
const stationsOf = (network, line) => {
  const seen = new Set();
  const names = [];
  for (const branch of line.branches) {
    for (const id of branch) {
      if (seen.has(id)) continue;
      seen.add(id);
      names.push(network.stations.get(id).name);
    }
  }
  return names;
};

export const listHeading = (t) => t('metro-maps.allMaps', 'Metro maps');

export const othersHeading = (t) => t('metro-maps.otherMaps', 'Other metro maps');

export const pages = async (t) => {
  const list = [];
  for (const entry of MAPS) {
    const network = await networkOf(entry);
    const vars = {
      city: entry.city,
      system: entry.system,
      country: entry.country,
      lines: network.lines.length,
      stations: network.stations.size,
    };
    list.push({
      slug: entry.id,
      title: t('metro-maps.seoTitle', '{city} {system} map and route planner', vars),
      description: t(
        'metro-maps.seoDescription',
        'Animated {system} map of {city}, {country}: {lines} lines and {stations} stations. Find the route between any two stations, free in your browser.',
        vars,
      ),
      heading: t('metro-maps.seoHeading', '{city} {system} map', vars),
      keywords: [
        `${entry.city} metro map`,
        `${entry.city} ${entry.system} map`,
        `${entry.city} subway map`,
        `${entry.city} route planner`,
        `${entry.system} stations`,
        entry.country,
      ],
      paragraphs: [
        t(
          'metro-maps.seoIntro',
          'Every {system} line in {city} on one animated map. Pick two stations to see the route, where to change and roughly how long it takes.',
          vars,
        ),
        t('metro-maps.disclaimer', 'Map data may be incomplete or out of date, and travel times are estimates. This is not an official map.'),
        ...(network.credit ? [t('metro-maps.dataFrom', 'Map data {credit}', { credit: network.credit })] : []),
      ],
      lists: network.lines.map((line) => ({
        heading: `${line.name} · ${t('metro-maps.stationCount', '{count} stations', { count: stationsOf(network, line).length })}`,
        items: stationsOf(network, line),
      })),
      others: MAPS.filter((other) => other.id !== entry.id).map((other) => ({ slug: other.id, text: `${other.city} ${other.system}` })),
    });
  }
  return list;
};
