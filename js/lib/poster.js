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
  angle: 0,
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

export const TEMPLATES = {
  gig: {
    label: 'Gig night',
    theme: 'midnight',
    frame: 'hairline',
    size: 'poster',
    build: (w, h) => [
      shape({ form: 'rect', x: w * 0.5, y: h * 0.27, width: w * 0.72, height: h * 0.006, tone: 'accent' }),
      text({ value: 'LIVE AT\nTHE UNION', x: w * 0.5, y: h * 0.16, width: w * 0.8, size: h * 0.075, align: 'center', caps: true, weight: 800, spacing: 2 }),
      text({ value: 'Friday 12 September · 8pm', x: w * 0.5, y: h * 0.31, width: w * 0.8, size: h * 0.026, align: 'center', tone: 'accent', weight: 600 }),
      text({ value: 'THE\nPAPER\nKITES', x: w * 0.5, y: h * 0.46, width: w * 0.86, size: h * 0.11, align: 'center', caps: true, weight: 800, leading: 0.95 }),
      text({ value: 'with Sea Change and Novak', x: w * 0.5, y: h * 0.72, width: w * 0.8, size: h * 0.024, align: 'center', tone: 'muted' }),
      text({ value: 'Tickets £14 · union.example.com', x: w * 0.5, y: h * 0.88, width: w * 0.8, size: h * 0.022, align: 'center', tone: 'muted' }),
    ],
  },
  talk: {
    label: 'Talk',
    theme: 'slate',
    frame: 'double',
    size: 'poster',
    build: (w, h) => [
      text({ value: 'Public lecture', x: w * 0.5, y: h * 0.14, width: w * 0.8, size: h * 0.024, align: 'center', tone: 'accent', caps: true, spacing: 4 }),
      text({ value: 'What the sea\nremembers', x: w * 0.5, y: h * 0.26, width: w * 0.82, size: h * 0.068, align: 'center', weight: 700, family: 'serif' }),
      shape({ form: 'rect', x: w * 0.5, y: h * 0.42, width: w * 0.18, height: h * 0.004, tone: 'ink' }),
      text({ value: 'Dr Amara Osei', x: w * 0.5, y: h * 0.5, width: w * 0.8, size: h * 0.034, align: 'center', weight: 600 }),
      text({ value: 'Thursday 4 October, 18:30\nLecture Theatre B, Main Building', x: w * 0.5, y: h * 0.62, width: w * 0.8, size: h * 0.024, align: 'center', tone: 'muted', leading: 1.5 }),
      text({ value: 'Free · no booking needed', x: w * 0.5, y: h * 0.86, width: w * 0.8, size: h * 0.022, align: 'center', tone: 'accent' }),
    ],
  },
  market: {
    label: 'Market day',
    theme: 'sun',
    frame: 'bold',
    size: 'poster',
    build: (w, h) => [
      text({ value: 'SATURDAY', x: w * 0.5, y: h * 0.2, width: w * 0.8, size: h * 0.038, align: 'center', caps: true, spacing: 8, tone: 'muted' }),
      text({ value: 'FARMERS\nMARKET', x: w * 0.5, y: h * 0.36, width: w * 0.84, size: h * 0.105, align: 'center', caps: true, weight: 800, leading: 0.95, tone: 'accent' }),
      shape({ form: 'circle', x: w * 0.5, y: h * 0.6, width: h * 0.14, height: h * 0.14, tone: 'ink', opacity: 0.08 }),
      text({ value: '7am – 1pm\nRiverside Square', x: w * 0.5, y: h * 0.62, width: w * 0.8, size: h * 0.03, align: 'center', leading: 1.4 }),
      text({ value: 'Bread · Cheese · Flowers · Coffee', x: w * 0.5, y: h * 0.86, width: w * 0.86, size: h * 0.022, align: 'center', tone: 'muted' }),
    ],
  },
  exhibit: {
    label: 'Exhibition',
    theme: 'ink',
    frame: 'corners',
    size: 'poster',
    build: (w, h) => [
      shape({ form: 'rect', x: w * 0.5, y: h * 0.36, width: w * 0.7, height: h * 0.32, tone: 'accent', opacity: 0.14, radius: 8 }),
      text({ value: 'New work by\nElin Marsh', x: w * 0.5, y: h * 0.36, width: w * 0.66, size: h * 0.052, align: 'center', family: 'serif', weight: 600 }),
      text({ value: 'STILL\nWATER', x: w * 0.5, y: h * 0.63, width: w * 0.86, size: h * 0.1, align: 'center', caps: true, weight: 800, leading: 0.95 }),
      text({ value: '2 – 30 November · Gallery Two', x: w * 0.5, y: h * 0.83, width: w * 0.8, size: h * 0.024, align: 'center', tone: 'muted' }),
    ],
  },
  minimal: {
    label: 'Plain',
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
