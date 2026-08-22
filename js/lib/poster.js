export const CANVAS_SIZES = {
  poster: { label: 'Poster A3', width: 1587, height: 2245 },
  flyer: { label: 'Flyer A5', width: 1123, height: 1587 },
  square: { label: 'Square post', width: 1080, height: 1080 },
  story: { label: 'Story', width: 1080, height: 1920 },
  wide: { label: 'Wide banner', width: 1920, height: 1005 },
  ticket: { label: 'Ticket', width: 1600, height: 640 },
};

export const THEMES = {
  ink: { label: 'Ink', paper: '#f6f4ef', ink: '#141414', accent: '#b4321f', muted: '#6d675e' },
  midnight: { label: 'Midnight', paper: '#12151f', ink: '#f2f4f8', accent: '#f0b429', muted: '#8b93a7' },
  bloom: { label: 'Bloom', paper: '#fdf1f4', ink: '#3d1424', accent: '#c2185b', muted: '#8a5c6d' },
  forest: { label: 'Forest', paper: '#eef3ec', ink: '#14261a', accent: '#2f6d44', muted: '#5c7263' },
  slate: { label: 'Slate', paper: '#eceff3', ink: '#1b2430', accent: '#2f6fb0', muted: '#5f6b7a' },
  sun: { label: 'Sun', paper: '#fff6e5', ink: '#2b1c05', accent: '#e07a00', muted: '#8a6f45' },
  coral: { label: 'Coral', paper: '#fff1ec', ink: '#33140c', accent: '#e2523b', muted: '#96695e' },
  mint: { label: 'Mint', paper: '#eaf5f1', ink: '#0f2a24', accent: '#0f8f6f', muted: '#5c7d75' },
  noir: { label: 'Noir', paper: '#0e0e0f', ink: '#f4f2ee', accent: '#e8e2d4', muted: '#7d7a74' },
  violet: { label: 'Violet', paper: '#f2eefb', ink: '#221436', accent: '#6b3fd4', muted: '#6f6288' },
  sand: { label: 'Sand', paper: '#efe7da', ink: '#2a2419', accent: '#a2703b', muted: '#7d715e' },
  ice: { label: 'Ice', paper: '#eef4f8', ink: '#12242e', accent: '#0d7c93', muted: '#5d7480' },
};

export const FRAMES = {
  none: { label: 'None' },
  hairline: { label: 'Hairline', inset: 34, width: 2 },
  double: { label: 'Double rule', inset: 30, width: 3, second: 12 },
  bold: { label: 'Bold band', inset: 0, width: 44, solid: true },
  corners: { label: 'Corner marks', inset: 30, width: 3, corners: true },
};

const uid = () => Math.random().toString(36).slice(2, 9);

const text = (spec) => ({
  id: uid(),
  kind: 'text',
  x: spec.x,
  y: spec.y,
  width: spec.width,
  height: spec.height ?? 0,
  angle: spec.angle ?? 0,
  value: spec.value,
  size: spec.size,
  weight: spec.weight ?? 600,
  align: spec.align ?? 'left',
  family: spec.family ?? 'sans',
  tone: spec.tone ?? 'ink',
  spacing: spec.spacing ?? 0,
  leading: spec.leading ?? 1.14,
  caps: spec.caps ?? false,
});

const shape = (spec) => ({
  id: uid(),
  kind: 'shape',
  form: spec.form ?? 'rect',
  x: spec.x,
  y: spec.y,
  width: spec.width,
  height: spec.height,
  angle: spec.angle ?? 0,
  tone: spec.tone ?? 'accent',
  radius: spec.radius ?? 0,
  opacity: spec.opacity ?? 1,
});

export const GALLERY = {
  concert: {
    label: 'Concert',
    group: 'Events',
    keywords: 'gig band live music night club show gig',
    theme: 'midnight',
    frame: 'hairline',
    size: 'poster',
    build: (w, h) => [
      text({ value: 'Friday 12 September · doors 8pm', x: w * 0.5, y: h * 0.13, width: w * 0.82, size: h * 0.021, align: 'center', tone: 'accent', caps: true, spacing: 5 }),
      shape({ form: 'rect', x: w * 0.5, y: h * 0.175, width: w * 0.74, height: h * 0.005, tone: 'accent' }),
      text({ value: 'HANS\nMUSTERMANN', x: w * 0.5, y: h * 0.38, width: w * 0.88, size: h * 0.105, align: 'center', caps: true, weight: 800, leading: 0.93 }),
      shape({ form: 'circle', x: w * 0.5, y: h * 0.63, width: h * 0.2, height: h * 0.2, tone: 'accent', opacity: 0.16 }),
      text({ value: 'with Jane Doe\nand the Erika Mustermann Trio', x: w * 0.5, y: h * 0.63, width: w * 0.78, size: h * 0.026, align: 'center', leading: 1.5 }),
      text({ value: 'The Union · Tickets 14', x: w * 0.5, y: h * 0.88, width: w * 0.8, size: h * 0.022, align: 'center', tone: 'muted' }),
    ],
  },
  splitBlock: {
    label: 'Split block',
    group: 'Talks and courses',
    keywords: 'course class school workshop teaching enrol term',
    theme: 'coral',
    frame: 'none',
    size: 'poster',
    build: (w, h) => [
      shape({ form: 'rect', x: w * 0.5, y: h * 0.25, width: w, height: h * 0.5, tone: 'accent' }),
      text({ value: 'SUMMER\nSCHOOL', x: w * 0.5, y: h * 0.22, width: w * 0.86, size: h * 0.1, align: 'center', caps: true, weight: 800, leading: 0.94, tone: 'paper' }),
      text({ value: 'Six evenings of drawing', x: w * 0.5, y: h * 0.4, width: w * 0.8, size: h * 0.024, align: 'center', tone: 'paper' }),
      text({ value: 'Taught by\nErika Mustermann', x: w * 0.5, y: h * 0.63, width: w * 0.8, size: h * 0.05, align: 'center', weight: 700, leading: 1.15, family: 'serif' }),
      shape({ form: 'rect', x: w * 0.5, y: h * 0.75, width: w * 0.16, height: h * 0.004, tone: 'ink' }),
      text({ value: 'Begins 4 October · Studio Two\nEnrol at the front desk', x: w * 0.5, y: h * 0.85, width: w * 0.8, size: h * 0.022, align: 'center', tone: 'muted', leading: 1.5 }),
    ],
  },
  sunrise: {
    label: 'Sunrise',
    group: 'Exhibitions',
    keywords: 'art show gallery summer opening private view',
    theme: 'sun',
    frame: 'none',
    size: 'poster',
    build: (w, h) => [
      shape({ form: 'circle', x: w * 0.5, y: h * 0.42, width: w * 0.72, height: w * 0.72, tone: 'accent', opacity: 0.9 }),
      text({ value: 'LONG\nDAYS', x: w * 0.5, y: h * 0.4, width: w * 0.8, size: h * 0.11, align: 'center', caps: true, weight: 800, leading: 0.92, tone: 'paper' }),
      text({ value: 'An exhibition by Jane Doe', x: w * 0.5, y: h * 0.68, width: w * 0.8, size: h * 0.032, align: 'center', family: 'serif' }),
      shape({ form: 'rect', x: w * 0.5, y: h * 0.76, width: w * 0.5, height: h * 0.003, tone: 'ink' }),
      text({ value: '2 – 30 November · Gallery Two · Free', x: w * 0.5, y: h * 0.85, width: w * 0.84, size: h * 0.021, align: 'center', tone: 'muted', caps: true, spacing: 2 }),
    ],
  },
  diagonal: {
    label: 'Diagonal',
    group: 'Events',
    keywords: 'festival conference week programme lineup speakers',
    theme: 'violet',
    frame: 'none',
    size: 'poster',
    build: (w, h) => [
      shape({ form: 'rect', x: w * 0.5, y: h * 0.47, width: w * 1.7, height: h * 0.12, tone: 'accent', angle: -0.35 }),
      text({ value: 'DESIGN\nWEEK', x: w * 0.5, y: h * 0.22, width: w * 0.86, size: h * 0.09, align: 'center', caps: true, weight: 800, leading: 0.95 }),
      text({ value: 'Talks · Workshops · Studio visits', x: w * 0.5, y: h * 0.465, width: w * 0.66, size: h * 0.026, align: 'center', tone: 'paper', weight: 700, angle: -0.35 }),
      text({ value: 'John Doe\nErika Mustermann\nHans Mustermann', x: w * 0.5, y: h * 0.7, width: w * 0.8, size: h * 0.03, align: 'center', leading: 1.5 }),
      text({ value: '18 – 24 March', x: w * 0.5, y: h * 0.88, width: w * 0.8, size: h * 0.024, align: 'center', tone: 'muted', caps: true, spacing: 4 }),
    ],
  },
  stripes: {
    label: 'Stripes',
    group: 'Talks and courses',
    keywords: 'reading talk lecture literature author evening',
    theme: 'ice',
    frame: 'none',
    size: 'poster',
    build: (w, h) => [
      ...[0.14, 0.175, 0.21].map((at, index) =>
        shape({ form: 'rect', x: w * 0.5, y: h * at, width: w * 0.8, height: h * (0.004 + index * 0.004), tone: 'accent' }),
      ),
      text({ value: 'THE\nQUIET\nHOUR', x: w * 0.5, y: h * 0.42, width: w * 0.86, size: h * 0.105, align: 'center', caps: true, weight: 800, leading: 0.94 }),
      ...[0.6, 0.635, 0.67].map((at, index) =>
        shape({ form: 'rect', x: w * 0.5, y: h * at, width: w * 0.8, height: h * (0.012 - index * 0.004), tone: 'accent' }),
      ),
      text({ value: 'A reading by Jane Doe', x: w * 0.5, y: h * 0.76, width: w * 0.8, size: h * 0.03, align: 'center', family: 'serif' }),
      text({ value: 'Thursday 7pm · Room 4', x: w * 0.5, y: h * 0.87, width: w * 0.8, size: h * 0.021, align: 'center', tone: 'muted' }),
    ],
  },
  editorial: {
    label: 'Editorial',
    group: 'Talks and courses',
    keywords: 'lecture academic seminar university serif formal',
    theme: 'sand',
    frame: 'double',
    size: 'poster',
    build: (w, h) => [
      text({ value: 'Public lecture', x: w * 0.5, y: h * 0.15, width: w * 0.8, size: h * 0.022, align: 'center', tone: 'accent', caps: true, spacing: 6 }),
      text({ value: 'What the\nsea remembers', x: w * 0.5, y: h * 0.31, width: w * 0.84, size: h * 0.062, align: 'center', weight: 600, family: 'serif', leading: 1.2 }),
      shape({ form: 'rect', x: w * 0.5, y: h * 0.45, width: w * 0.14, height: h * 0.003, tone: 'ink' }),
      text({ value: 'Dr Erika Mustermann', x: w * 0.5, y: h * 0.55, width: w * 0.8, size: h * 0.034, align: 'center', weight: 600 }),
      text({ value: 'Thursday 4 October, 18:30\nLecture Theatre B', x: w * 0.5, y: h * 0.68, width: w * 0.8, size: h * 0.023, align: 'center', tone: 'muted', leading: 1.6 }),
      text({ value: 'Free · no booking needed', x: w * 0.5, y: h * 0.86, width: w * 0.8, size: h * 0.021, align: 'center', tone: 'accent' }),
    ],
  },
  grid: {
    label: 'Grid',
    group: 'Exhibitions',
    keywords: 'open studios makers craft pattern squares',
    theme: 'forest',
    frame: 'hairline',
    size: 'poster',
    build: (w, h) => {
      const cells = [];
      for (let row = 0; row < 4; row += 1) {
        for (let column = 0; column < 4; column += 1) {
          cells.push(
            shape({
              form: (row + column) % 3 === 0 ? 'circle' : 'rect',
              x: w * (0.24 + column * 0.174),
              y: h * (0.17 + row * 0.086),
              width: w * 0.1,
              height: w * 0.1,
              tone: 'accent',
              opacity: 0.18 + ((row + column) % 4) * 0.2,
              radius: 6,
            }),
          );
        }
      }
      return [
        ...cells,
        text({ value: 'OPEN\nSTUDIOS', x: w * 0.5, y: h * 0.62, width: w * 0.86, size: h * 0.085, align: 'center', caps: true, weight: 800, leading: 0.95 }),
        text({ value: 'Twenty makers · one building', x: w * 0.5, y: h * 0.76, width: w * 0.8, size: h * 0.026, align: 'center' }),
        text({ value: 'Saturday and Sunday · 11am – 6pm', x: w * 0.5, y: h * 0.87, width: w * 0.84, size: h * 0.021, align: 'center', tone: 'muted' }),
      ];
    },
  },
  numeral: {
    label: 'Numeral',
    group: 'Events',
    keywords: 'anniversary birthday number date late show radio',
    theme: 'noir',
    frame: 'none',
    size: 'poster',
    build: (w, h) => [
      text({ value: '09', x: w * 0.5, y: h * 0.36, width: w * 0.9, size: h * 0.32, align: 'center', weight: 800, tone: 'accent', leading: 0.9 }),
      shape({ form: 'rect', x: w * 0.5, y: h * 0.55, width: w * 0.62, height: h * 0.004, tone: 'ink' }),
      text({ value: 'NINE YEARS OF\nTHE LATE SHOW', x: w * 0.5, y: h * 0.66, width: w * 0.84, size: h * 0.045, align: 'center', caps: true, weight: 700, leading: 1.2 }),
      text({ value: 'Hosted by John Doe', x: w * 0.5, y: h * 0.79, width: w * 0.8, size: h * 0.024, align: 'center', tone: 'muted' }),
      text({ value: 'Every Thursday · 10pm', x: w * 0.5, y: h * 0.89, width: w * 0.8, size: h * 0.02, align: 'center', tone: 'muted', caps: true, spacing: 3 }),
    ],
  },
  framed: {
    label: 'Framed',
    group: 'Exhibitions',
    keywords: 'artist solo show painting gallery new work',
    theme: 'bloom',
    frame: 'corners',
    size: 'poster',
    build: (w, h) => [
      shape({ form: 'rect', x: w * 0.5, y: h * 0.42, width: w * 0.68, height: h * 0.36, tone: 'accent', opacity: 0.13, radius: 10 }),
      text({ value: 'New work by\nJane Doe', x: w * 0.5, y: h * 0.36, width: w * 0.62, size: h * 0.048, align: 'center', family: 'serif', weight: 600, leading: 1.25 }),
      text({ value: 'STILL\nWATER', x: w * 0.5, y: h * 0.66, width: w * 0.86, size: h * 0.1, align: 'center', caps: true, weight: 800, leading: 0.95 }),
      text({ value: '2 – 30 November · Gallery Two', x: w * 0.5, y: h * 0.85, width: w * 0.82, size: h * 0.023, align: 'center', tone: 'muted' }),
    ],
  },
  market: {
    label: 'Market day',
    group: 'Events',
    keywords: 'market fair stall food farmers weekend shop',
    theme: 'mint',
    frame: 'bold',
    size: 'poster',
    build: (w, h) => [
      text({ value: 'SATURDAY', x: w * 0.5, y: h * 0.19, width: w * 0.8, size: h * 0.034, align: 'center', caps: true, spacing: 9, tone: 'muted' }),
      text({ value: 'FARMERS\nMARKET', x: w * 0.5, y: h * 0.36, width: w * 0.84, size: h * 0.105, align: 'center', caps: true, weight: 800, leading: 0.94, tone: 'accent' }),
      shape({ form: 'circle', x: w * 0.3, y: h * 0.58, width: h * 0.09, height: h * 0.09, tone: 'accent', opacity: 0.2 }),
      shape({ form: 'circle', x: w * 0.7, y: h * 0.58, width: h * 0.09, height: h * 0.09, tone: 'accent', opacity: 0.2 }),
      text({ value: '7am – 1pm\nRiverside Square', x: w * 0.5, y: h * 0.62, width: w * 0.8, size: h * 0.03, align: 'center', leading: 1.4 }),
      text({ value: 'Bread · Cheese · Flowers · Coffee', x: w * 0.5, y: h * 0.86, width: w * 0.86, size: h * 0.021, align: 'center', tone: 'muted' }),
    ],
  },
  story: {
    label: 'Story post',
    group: 'Social',
    keywords: 'instagram story vertical booking promo portrait',
    theme: 'slate',
    frame: 'none',
    size: 'story',
    build: (w, h) => [
      shape({ form: 'rect', x: w * 0.5, y: h * 0.5, width: w * 0.86, height: h * 0.62, tone: 'accent', opacity: 0.12, radius: 24 }),
      text({ value: 'NOW\nBOOKING', x: w * 0.5, y: h * 0.3, width: w * 0.82, size: h * 0.075, align: 'center', caps: true, weight: 800, leading: 0.95 }),
      text({ value: 'Portraits with\nHans Mustermann', x: w * 0.5, y: h * 0.5, width: w * 0.78, size: h * 0.032, align: 'center', family: 'serif', leading: 1.35 }),
      shape({ form: 'rect', x: w * 0.5, y: h * 0.6, width: w * 0.24, height: h * 0.003, tone: 'ink' }),
      text({ value: 'Studio dates in March', x: w * 0.5, y: h * 0.68, width: w * 0.8, size: h * 0.024, align: 'center', tone: 'muted' }),
    ],
  },
  ticket: {
    label: 'Ticket',
    group: 'Events',
    keywords: 'ticket admission entry pass stub seat',
    theme: 'ink',
    frame: 'hairline',
    size: 'ticket',
    build: (w, h) => [
      shape({ form: 'rect', x: w * 0.27, y: h * 0.5, width: w * 0.004, height: h * 0.64, tone: 'muted', opacity: 0.5 }),
      text({ value: 'ADMIT\nONE', x: w * 0.135, y: h * 0.5, width: w * 0.2, size: h * 0.12, align: 'center', caps: true, weight: 800, leading: 0.95, tone: 'accent' }),
      text({ value: 'An evening with Erika Mustermann', x: w * 0.62, y: h * 0.34, width: w * 0.62, size: h * 0.085, align: 'center', weight: 700 }),
      text({ value: 'Friday 12 September · 8pm · The Union', x: w * 0.62, y: h * 0.58, width: w * 0.62, size: h * 0.055, align: 'center', tone: 'muted' }),
      text({ value: 'Row C · Seat 14', x: w * 0.62, y: h * 0.75, width: w * 0.62, size: h * 0.05, align: 'center', tone: 'accent', caps: true, spacing: 3 }),
    ],
  },
  plain: {
    label: 'Plain',
    group: 'Blank',
    keywords: 'empty simple start scratch minimal',
    theme: 'ink',
    frame: 'none',
    size: 'poster',
    build: (w, h) => [
      text({ value: 'Your headline', x: w * 0.5, y: h * 0.4, width: w * 0.8, size: h * 0.07, align: 'center', weight: 700 }),
      text({ value: 'Add the details here', x: w * 0.5, y: h * 0.55, width: w * 0.8, size: h * 0.026, align: 'center', tone: 'muted' }),
    ],
  },
};

export const makeText = text;
export const makeShape = shape;
export const newId = uid;

export const icsFor = (event) => {
  const stamp = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return `${date.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;
  };
  const start = stamp(event.start);
  if (!start) return null;
  const end = stamp(event.end) ?? start;
  const escape = (value) => String(value ?? '').replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Toolbox//Poster//EN',
    'BEGIN:VEVENT',
    `UID:${uid()}@toolbox`,
    `DTSTAMP:${start}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escape(event.title)}`,
    event.place ? `LOCATION:${escape(event.place)}` : null,
    event.notes ? `DESCRIPTION:${escape(event.notes)}` : null,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n');
};
