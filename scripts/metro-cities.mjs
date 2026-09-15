// The cities the metro importer builds maps for: where to look in
// OpenStreetMap, which kinds of route count as the metro there, and how to tidy
// the names it finds.
//
//   bbox     south, west, north, east
//   routes   OpenStreetMap route types: subway, light_rail, tram, train, monorail
//   network  only routes whose network, operator or line name matches
//   exclude  routes whose name or ref matches are left out
//   keep     a test on a route's tags, for when network names are not enough
//   rename   [pattern, replacement] pairs applied to station names
//   walks    [station, station, minutes] for changes made on foot
//   badges   false where line references are not short enough to tell lines apart
//   lineName (ref, name, tags) => the name a line is shown by
//   short    (ref, name) => the text on a line's badge, where its ref will not do
//   names    tags to read a station's name from, first found wins
//   spacing  the length of a hop on the map, 2 unless a network needs more room
//   room     how close two stations may sit, 1.7 unless set
//   fisheye  below 1 spreads a dense centre and pulls long outer lines in
//   rounds   layout passes, 900 unless a large network needs longer to settle
//   ring     the ref of a circle line to draw as a clean ring, with the city laid out
//            around it; ringStretch widens it, ringInside and ringOutside shape the
//            spread within it and the reach of the lines beyond
export default {
  montreal: {
    city: 'Montreal', country: 'Canada', flag: '🇨🇦', system: 'Métro',
    bbox: [45.40, -73.80, 45.62, -73.45], routes: ['subway'],
  },
  ottawa: {
    city: 'Ottawa', country: 'Canada', flag: '🇨🇦', system: 'O-Train',
    bbox: [45.25, -75.95, 45.50, -75.45], routes: ['light_rail', 'train', 'subway'], network: /O-Train|OC Transpo/i,
    // platforms are named for their direction, and many names are in English and French
    rename: [[/\s+O-Train.*$/i, ''], [/\s*\/\s*.*$/, ''], [/^(Lyon) [AB]$/, '$1']],
  },
  calgary: {
    city: 'Calgary', country: 'Canada', flag: '🇨🇦', system: 'CTrain',
    bbox: [50.84, -114.28, 51.20, -113.90], routes: ['light_rail'], network: /CTrain|Calgary Transit/i,
  },
  edmonton: {
    city: 'Edmonton', country: 'Canada', flag: '🇨🇦', system: 'LRT',
    bbox: [53.40, -113.65, 53.65, -113.35], routes: ['light_rail', 'tram'], network: /ETS|Edmonton/i,
    exclude: /Streetcar/i,
  },

  amsterdam: {
    city: 'Amsterdam', country: 'Netherlands', flag: '🇳🇱', system: 'Metro',
    bbox: [52.28, 4.72, 52.43, 5.05], routes: ['subway'], network: /GVB|Amsterdam/i,
  },
  rotterdam: {
    city: 'Rotterdam', country: 'Netherlands', flag: '🇳🇱', system: 'Metro',
    bbox: [51.80, 4.20, 52.10, 4.65], routes: ['subway'], network: /RET|Rotterdam/i,
  },
  'the-hague': {
    city: 'The Hague', country: 'Netherlands', flag: '🇳🇱', system: 'RandstadRail',
    bbox: [51.95, 4.20, 52.12, 4.55], routes: ['tram', 'subway'],
    // RandstadRail is HTM's lines 3, 4 and 34 with RET's metro line E
    keep: (tags) => (tags.operator === 'HTM' && /^(3|4|34)$/.test(tags.ref ?? '')) || (tags.operator === 'RET' && tags.ref === 'E'),
  },
  utrecht: {
    city: 'Utrecht', country: 'Netherlands', flag: '🇳🇱', system: 'Tram',
    bbox: [51.98, 5.02, 52.12, 5.22], routes: ['tram', 'light_rail'],
  },

  berlin: {
    city: 'Berlin', country: 'Germany', flag: '🇩🇪', system: 'U-Bahn and S-Bahn',
    // the S-Bahn is mapped as light rail and runs well past the city limits
    bbox: [52.25, 12.95, 52.78, 13.93], routes: ['subway', 'light_rail'], network: /BVG|VBB|Berlin/i,
    keep: (tags) => /^[US]\d+$/.test(tags.ref ?? ''),
    spacing: 3, room: 2.8, rounds: 1600, ring: 'S41', ringStretch: 1.3,
    rename: [[/^(S\+U|U|S)\s+/, ''], [/\s*\(Berlin\)\s*$/, ''], [/^Berlin[- ]/, '']],
  },
  munich: {
    city: 'Munich', country: 'Germany', flag: '🇩🇪', system: 'U-Bahn',
    bbox: [48.05, 11.40, 48.30, 11.75], routes: ['subway'], network: /MVV|MVG|Münch/i,
    rename: [[/^(U-Bahnhof|U)\s+/, '']],
  },
  hamburg: {
    city: 'Hamburg', country: 'Germany', flag: '🇩🇪', system: 'U-Bahn',
    bbox: [53.45, 9.80, 53.75, 10.25], routes: ['subway'], network: /HVV|Hochbahn|Hamburg/i,
    rename: [[/^(U|S\+U)\s+/, '']],
  },
  frankfurt: {
    city: 'Frankfurt', country: 'Germany', flag: '🇩🇪', system: 'U-Bahn',
    bbox: [50.05, 8.52, 50.25, 8.80], routes: ['light_rail', 'subway'],
    keep: (tags) => /^U\d$/.test(tags.ref ?? ''),
    rename: [[/^Frankfurt \(Main\)\s*/, ''], [/^(U|S\+U)\s+/, '']],
  },
  cologne: {
    city: 'Köln', country: 'Germany', flag: '🇩🇪', system: 'Stadtbahn',
    bbox: [50.83, 6.75, 51.08, 7.20], routes: ['light_rail', 'tram'], network: /KVB|VRS|Köln/i,
    keep: (tags) => /^1?\d$/.test(tags.ref ?? ''),
    rename: [[/^Köln[, ]+/, '']],
  },
  dusseldorf: {
    city: 'Düsseldorf', country: 'Germany', flag: '🇩🇪', system: 'Stadtbahn',
    bbox: [51.12, 6.68, 51.35, 6.95], routes: ['light_rail', 'tram', 'subway'],
    keep: (tags) => /^U7\d$/.test(tags.ref ?? ''),
    rename: [[/^Düsseldorf[, ]+/, '']],
  },
  nuremberg: {
    city: 'Nuremberg', country: 'Germany', flag: '🇩🇪', system: 'U-Bahn',
    bbox: [49.35, 10.95, 49.52, 11.20], routes: ['subway'], network: /VGN|VAG|Nürnberg/i,
    rename: [[/^(U|Nürnberg[, ]+)\s*/, '']],
  },
  stuttgart: {
    city: 'Stuttgart', country: 'Germany', flag: '🇩🇪', system: 'Stadtbahn',
    bbox: [48.65, 9.05, 48.90, 9.35], routes: ['light_rail', 'tram'],
    keep: (tags) => /^U\d{1,2}$/.test(tags.ref ?? ''),
    rename: [[/^Stuttgart[, ]+/, '']],
  },
  hannover: {
    city: 'Hannover', country: 'Germany', flag: '🇩🇪', system: 'Stadtbahn',
    bbox: [52.25, 9.55, 52.50, 9.95], routes: ['light_rail', 'tram'], network: /GVH|üstra|Hannover/i,
    rename: [[/^Hannover[, ]+/, '']],
  },

  london: {
    city: 'London', country: 'United Kingdom', flag: '🇬🇧', system: 'Underground',
    bbox: [51.40, -0.62, 51.72, 0.28], routes: ['subway'], network: /London Underground|Underground/i, badges: false,
    rename: [[/\s+Underground Station$/i, ''], [/\s+\((Bakerloo|Central|Circle|District|Hammersmith & City|Jubilee|Metropolitan|Northern|Piccadilly|Victoria|Waterloo & City)[^)]*\)$/i, '']],
  },
  manchester: {
    city: 'Manchester', country: 'United Kingdom', flag: '🇬🇧', system: 'Metrolink',
    bbox: [53.30, -2.45, 53.65, -2.05], routes: ['tram', 'light_rail'], network: /Metrolink/i, badges: false, exclude: /ECL/,
    // Metrolink routes are known by their two ends
    lineName: (ref, name) => ref || name,
    rename: [[/\s+(Metrolink|tram stop|Tram Stop)$/i, '']],
  },
  dublin: {
    city: 'Dublin', country: 'Ireland', flag: '🇮🇪', system: 'Luas',
    bbox: [53.25, -6.45, 53.40, -6.15], routes: ['tram', 'light_rail'], network: /Luas/i, badges: false,
    rename: [[/\s+Luas( Stop)?$/i, ''], [/\s+Tram Stop$/i, '']],
    // the Red and Green lines meet on foot in the city centre
    walks: [['Abbey Street', 'Marlborough', 2], ['Abbey Street', "O'Connell - GPO", 2]],
  },
  madrid: {
    city: 'Madrid', country: 'Spain', flag: '🇪🇸', system: 'Metro',
    bbox: [40.25, -3.85, 40.55, -3.50], routes: ['subway'], network: /Metro de Madrid|Madrid/i,
  },
  barcelona: {
    city: 'Barcelona', country: 'Spain', flag: '🇪🇸', system: 'Metro',
    bbox: [41.30, 2.00, 41.50, 2.30], routes: ['subway'], network: /TMB|FGC|Barcelona|ATM/i,
    // FGC and TMB name the stations they share differently
    rename: [[/^Barcelona-Plaça Catalunya$/, 'Catalunya']],
    walks: [['Provença', 'Diagonal', 3]],
  },
  zaragoza: {
    city: 'Zaragoza', country: 'Spain', flag: '🇪🇸', system: 'Tranvía',
    bbox: [41.60, -0.95, 41.72, -0.82], routes: ['tram', 'light_rail'],
  },
  rome: {
    city: 'Rome', country: 'Italy', flag: '🇮🇹', system: 'Metropolitana',
    bbox: [41.78, 12.35, 42.00, 12.65], routes: ['subway'],
    lineName: (ref, name) => (/^[A-C]1?$/.test(ref) ? `Linea ${ref}` : name),
  },
  milan: {
    city: 'Milan', country: 'Italy', flag: '🇮🇹', system: 'Metropolitana',
    bbox: [45.40, 9.05, 45.58, 9.30], routes: ['subway'],
  },
  paris: {
    city: 'Paris', country: 'France', flag: '🇫🇷', system: 'Métro',
    bbox: [48.78, 2.20, 48.95, 2.50], routes: ['subway'], network: /RATP|Paris|Île-de-France|IDFM/i,
  },

  istanbul: {
    city: 'Istanbul', country: 'Türkiye', flag: '🇹🇷', system: 'Metro',
    bbox: [40.85, 28.60, 41.15, 29.35], routes: ['subway', 'train'],
    // the metro on each side of the Bosphorus is joined by Marmaray's tunnel
    keep: (tags) => tags.route === 'subway' || /Marmaray/i.test(`${tags.name ?? ''} ${tags.network ?? ''} ${tags.ref ?? ''}`),
  },
  vienna: {
    city: 'Vienna', country: 'Austria', flag: '🇦🇹', system: 'U-Bahn',
    bbox: [48.10, 16.25, 48.30, 16.55], routes: ['subway'], network: /Wiener Linien|VOR|Wien/i,
    rename: [[/^Wien\s+/, '']],
  },
  prague: {
    city: 'Prague', country: 'Czechia', flag: '🇨🇿', system: 'Metro',
    bbox: [49.98, 14.25, 50.15, 14.65], routes: ['subway'], network: /Pražsk|PID|DPP|Praha|Prague/i,
  },
  lisbon: {
    city: 'Lisbon', country: 'Portugal', flag: '🇵🇹', system: 'Metro',
    bbox: [38.68, -9.25, 38.82, -9.05], routes: ['subway'], network: /Metropolitano|Lisboa|Lisbon/i, badges: false,
  },
  athens: {
    city: 'Athens', country: 'Greece', flag: '🇬🇷', system: 'Metro',
    bbox: [37.85, 23.55, 38.10, 23.95], routes: ['subway'], names: ['name:en', 'name'],
  },
  budapest: {
    city: 'Budapest', country: 'Hungary', flag: '🇭🇺', system: 'Metro',
    bbox: [47.40, 18.95, 47.60, 19.20], routes: ['subway'], network: /BKV|BKK|Budapest/i,
  },
  copenhagen: {
    city: 'Copenhagen', country: 'Denmark', flag: '🇩🇰', system: 'Metro',
    bbox: [55.60, 12.45, 55.75, 12.70], routes: ['subway'], network: /Metro|Metroselskabet|København|Copenhagen/i,
  },
  brussels: {
    city: 'Brussels', country: 'Belgium', flag: '🇧🇪', system: 'Metro',
    bbox: [50.78, 4.25, 50.92, 4.48], routes: ['subway'], network: /STIB|MIVB|Brussel|Bruxelles/i,
  },
  stockholm: {
    city: 'Stockholm', country: 'Sweden', flag: '🇸🇪', system: 'Tunnelbana',
    bbox: [59.20, 17.75, 59.45, 18.20], routes: ['subway'], network: /SL|Tunnelbana|Stockholm/i,
  },
  florence: {
    city: 'Florence', country: 'Italy', flag: '🇮🇹', system: 'Tramvia',
    bbox: [43.72, 11.15, 43.83, 11.30], routes: ['tram', 'light_rail'],
  },

  seoul: {
    city: 'Seoul', country: 'South Korea', flag: '🇰🇷', system: 'Subway',
    bbox: [37.42, 126.78, 37.70, 127.18], routes: ['subway'], names: ['name:en', 'name'],
    rename: [[/\s+Station$/i, '']],
    lineName: (ref, name) => (/^\d$/.test(ref) ? `Line ${ref}` : name.replace(/^Seoul Metropolitan Subway\s*/i, '')),
    short: (ref, name) => (/shinbundang/i.test(name) ? 'S' : undefined),
  },
  busan: {
    city: 'Busan', country: 'South Korea', flag: '🇰🇷', system: 'Metro',
    bbox: [35.05, 128.85, 35.35, 129.20], routes: ['subway', 'light_rail', 'monorail'], names: ['name:en', 'name'],
    rename: [[/\s+Station$/i, '']],
  },
};
