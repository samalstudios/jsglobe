import { raw } from '../core/dom.js';

const PATHS = {
  hash: '<path d="M5 9h14M5 15h14M10 3.5 8 20.5M16 3.5l-2 17"/>',
  key: '<circle cx="7.5" cy="16.5" r="3.6"/><path d="m10.1 14 9.4-9.4M16.5 7l2.5 2.5M13.8 9.7l2.5 2.5"/>',
  lock: '<rect x="4" y="10" width="16" height="10.5" rx="2.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><path d="M12 14v2.5"/>',
  asterisk: '<path d="M12 4v16M5 8l14 8M19 8 5 16"/>',
  timer: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4l2.8 1.7M9 2.5h6"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>',
  swap: '<path d="M4 8.5h14l-3.5-3.5M20 15.5H6l3.5 3.5"/>',
  palette:
    '<path d="M12 3.2c-5 0-8.8 3.9-8.8 8.8S7 20.8 12 20.8c1.2 0 2.1-.9 2.1-2 0-.5-.2-1-.6-1.4-.3-.3-.5-.7-.5-1.2 0-1 .9-1.7 1.9-1.7h1.2c2.6 0 4.7-2.1 4.7-4.7 0-3.7-3.7-6.6-8.8-6.6Z"/><circle cx="7.6" cy="11" r="1.15"/><circle cx="11.2" cy="7.6" r="1.15"/><circle cx="15.8" cy="9.4" r="1.15"/>',
  type: '<path d="M4.5 7.5V5h15v2.5M12 5v14M9 19h6"/>',
  clock: '<circle cx="12" cy="12" r="8.8"/><path d="M12 6.6V12l3.6 2.2"/>',
  calendar: '<rect x="3.2" y="5" width="17.6" height="16" rx="2.5"/><path d="M3.2 10h17.6M8 3v4M16 3v4"/>',
  binary: '<rect x="3.5" y="4" width="6" height="7" rx="1.6"/><rect x="3.5" y="13" width="6" height="7" rx="1.6"/><path d="M15.5 20V4l-2.2 1.8M13.3 20h4.8"/>',
  braces:
    '<path d="M9.5 3.5h-1a2.2 2.2 0 0 0-2.2 2.2v3.2c0 1.3-.9 2.4-2.1 2.6 1.2.2 2.1 1.3 2.1 2.6v3.2a2.2 2.2 0 0 0 2.2 2.2h1M14.5 3.5h1a2.2 2.2 0 0 1 2.2 2.2v3.2c0 1.3.9 2.4 2.1 2.6-1.2.2-2.1 1.3-2.1 2.6v3.2a2.2 2.2 0 0 1-2.2 2.2h-1"/>',
  code: '<path d="m8 8.5-4 3.5 4 3.5M16 8.5l4 3.5-4 3.5M13.6 4.5l-3.2 15"/>',
  percent: '<path d="M19 5 5 19"/><circle cx="7.6" cy="7.6" r="2.6"/><circle cx="16.4" cy="16.4" r="2.6"/>',
  link: '<path d="M9.6 14.4 14.4 9.6M8.5 11.5 6.6 13.4a3.6 3.6 0 0 0 5.1 5.1l1.9-1.9M15.5 12.5l1.9-1.9a3.6 3.6 0 0 0-5.1-5.1l-1.9 1.9"/>',
  shield: '<path d="M12 3 4.5 5.8V12c0 4.4 3.1 8 7.5 9.2 4.4-1.2 7.5-4.8 7.5-9.2V5.8L12 3Z"/><path d="m9.2 12 2 2 3.6-4"/>',
  keyboard:
    '<rect x="2.2" y="6" width="19.6" height="12" rx="2.4"/><path d="M6 10h.01M9.5 10h.01M13 10h.01M16.5 10h.01M6 13.6h.01M18 13.6h.01M9.2 13.6h5.6"/>',
  slug: '<path d="M15 3.4 9 20.6"/><path d="M3.6 8.4h4.2M6.4 15.6h4.2M13.4 8.4h4.2M16.2 15.6h4.2"/>',
  activity: '<path d="M3 12.5h3.6l2.6 6.4 4.4-14.4 2.6 8h4.8"/>',
  database:
    '<ellipse cx="12" cy="6" rx="7.8" ry="3"/><path d="M4.2 6v5.9c0 1.7 3.5 3 7.8 3s7.8-1.3 7.8-3V6M4.2 11.9V18c0 1.7 3.5 3 7.8 3s7.8-1.3 7.8-3v-6.1"/>',
  alarm: '<circle cx="12" cy="13.4" r="7.6"/><path d="M12 9.6v3.8l2.8 1.7M4.8 3.4 2.4 5.8M19.2 3.4l2.4 2.4"/>',
  fileLock:
    '<path d="M13.6 3H7.4A2.4 2.4 0 0 0 5 5.4v13.2A2.4 2.4 0 0 0 7.4 21h9.2a2.4 2.4 0 0 0 2.4-2.4V8.4L13.6 3Z"/><path d="M13.4 3.2v5.2h5.2"/><rect x="9.4" y="12.6" width="5.2" height="4.4" rx="1.1"/>',
  regex: '<path d="M12 4v7.4M8.8 5.8l6.4 3.7M15.2 5.8 8.8 9.5"/><rect x="4.2" y="15" width="4.4" height="4.4" rx="1.2"/><path d="M12 17.2h7.8"/>',
  network:
    '<rect x="9" y="3" width="6" height="5.2" rx="1.4"/><rect x="2.2" y="15.8" width="6" height="5.2" rx="1.4"/><rect x="15.8" y="15.8" width="6" height="5.2" rx="1.4"/><path d="M12 8.2v3.6M5.2 15.8v-4h13.6v4"/>',
  globe: '<circle cx="12" cy="12" r="8.8"/><path d="M3.2 12h17.6M12 3.2c2.4 2.5 3.7 5.6 3.7 8.8S14.4 18.3 12 20.8c-2.4-2.5-3.7-5.6-3.7-8.8S9.6 5.7 12 3.2Z"/>',
  router:
    '<rect x="2.6" y="12.4" width="18.8" height="8.2" rx="2.2"/><path d="M6.6 16.6h.01M10 16.6h.01M17.6 16.6v-1.4M12 9V5.4M8.6 8.6 6.2 6.2M15.4 8.6l2.4-2.4"/>',
  alignLeft: '<path d="M4 5.5h16M4 10.5h11.5M4 15.5h14M4 20.5h8"/>',
  chart: '<path d="M3.5 20.5h17M6.5 20.5V12M11.5 20.5V4.5M16.5 20.5v-5.5"/>',
  compare:
    '<path d="M9.5 3.5H5.6A1.6 1.6 0 0 0 4 5.1v13.8a1.6 1.6 0 0 0 1.6 1.6h3.9M14.5 3.5h3.9A1.6 1.6 0 0 1 20 5.1v13.8a1.6 1.6 0 0 1-1.6 1.6h-3.9M12 2.4v19.2"/>',
  fileText:
    '<path d="M13.6 3H7.4A2.4 2.4 0 0 0 5 5.4v13.2A2.4 2.4 0 0 0 7.4 21h9.2a2.4 2.4 0 0 0 2.4-2.4V8.4L13.6 3Z"/><path d="M13.4 3.2v5.2h5.2M8.6 13h6.8M8.6 16.6h4.4"/>',
  calculator:
    '<rect x="4.2" y="2.6" width="15.6" height="18.8" rx="2.4"/><path d="M8 6.8h8M8 11.4h.01M12 11.4h.01M16 11.4h.01M8 15h.01M12 15h.01M16 15v3.4M8 18.4h4.2"/>',
  ruler: '<rect x="2.2" y="8.2" width="19.6" height="7.6" rx="2.2"/><path d="M6.6 8.2v3M10.3 8.2v4M14 8.2v3M17.7 8.2v4"/>',
  qr: '<rect x="3.2" y="3.2" width="7" height="7" rx="1.4"/><rect x="13.8" y="3.2" width="7" height="7" rx="1.4"/><rect x="3.2" y="13.8" width="7" height="7" rx="1.4"/><path d="M6.2 6.2h1M16.8 6.2h1M6.2 16.8h1M13.8 13.8h3v3h-3zM20.8 13.8h-1M13.8 20.8h3M20.8 17.6v3.2"/>',
  fingerprint:
    '<path d="M8.6 11.4a3.4 3.4 0 0 1 6.8 0v2.2"/><path d="M5.6 11.4a6.4 6.4 0 0 1 12.8 0v1.8"/><path d="M12 11.4v3.4c0 1.9-.4 3.7-1.2 5.4"/><path d="M15.4 15.4c-.2 1.8-.7 3.5-1.5 5.1"/><path d="M3.4 7.4A9.6 9.6 0 0 1 12 2.4c1.9 0 3.6.5 5.1 1.4"/>',
  monitor: '<rect x="2.4" y="4" width="19.2" height="12.6" rx="2.4"/><path d="M8.4 20.6h7.2M12 16.6v4"/>',
  pencil: '<path d="M4 20h4.2l9.6-9.6a2.9 2.9 0 0 0-4.2-4.2L4 15.8V20Z"/><path d="m13.2 6.6 4.2 4.2"/>',
  checkSquare: '<rect x="3.4" y="3.4" width="17.2" height="17.2" rx="3.4"/><path d="m8 12.2 2.8 2.8 5.2-6"/>',
  gear: '<path d="M3.6 6.4h8.6M17.4 6.4h3M3.6 12h3.2M12.4 12h8M3.6 17.6h8.6M17.4 17.6h3"/><circle cx="14.6" cy="6.4" r="2.3"/><circle cx="9.6" cy="12" r="2.3"/><circle cx="14.6" cy="17.6" r="2.3"/>',
  repeat:
    '<path d="M4 9.4V7.6A2.6 2.6 0 0 1 6.6 5h11.2l-2.6-2.6M20 14.6v1.8a2.6 2.6 0 0 1-2.6 2.6H6.2l2.6 2.6"/>',
  landmark: '<path d="M3.6 20.6h16.8M6.2 20.6V9.4M10 20.6V9.4M14 20.6V9.4M17.8 20.6V9.4M3.6 9.4h16.8L12 3.4 3.6 9.4Z"/>',
  ampersand: '<path d="M18.6 20.4 8.2 9.2a2.9 2.9 0 1 1 4.4-3.8L5.9 14.5a3.7 3.7 0 0 0 2.9 5.9c2 0 3.6-1.1 5.1-3.2l2.8-3.9"/>',
  badge: '<path d="M12 2.8 14.6 5l3.3-.2.5 3.2 2.6 2-1.6 2.9 1.6 2.9-2.6 2-.5 3.2-3.3-.2L12 21.2 9.4 19l-3.3.2-.5-3.2-2.6-2 1.6-2.9L3 8.2l2.6-2 .5-3.2L9.4 5 12 2.8Z"/><path d="m9.4 12 1.9 1.9 3.6-4"/>',
  server:
    '<rect x="3" y="3.6" width="18" height="6.6" rx="2"/><rect x="3" y="13.8" width="18" height="6.6" rx="2"/><path d="M7 6.9h.01M7 17.1h.01M11 6.9h4M11 17.1h4"/>',
  scale: '<path d="M12 3.4v17.2M7 20.6h10M5.4 7.6h13.2M5.4 7.6 2.6 14a3 3 0 0 0 5.6 0L5.4 7.6ZM18.6 7.6 15.8 14a3 3 0 0 0 5.6 0l-2.8-6.4Z"/>',
  grid: '<rect x="3" y="3" width="7.4" height="7.4" rx="2"/><rect x="13.6" y="3" width="7.4" height="7.4" rx="2"/><rect x="3" y="13.6" width="7.4" height="7.4" rx="2"/><rect x="13.6" y="13.6" width="7.4" height="7.4" rx="2"/>',
  search: '<circle cx="10.8" cy="10.8" r="6.6"/><path d="m15.6 15.6 4.6 4.6"/>',
  widgets: '<rect x="3" y="3" width="7.4" height="7.4" rx="2"/><rect x="13.6" y="3" width="7.4" height="7.4" rx="2"/><rect x="3" y="13.6" width="7.4" height="7.4" rx="2"/><rect x="13.6" y="13.6" width="7.4" height="7.4" rx="2"/>',
  box: '<rect x="3.6" y="3.6" width="16.8" height="16.8" rx="3.2"/>',
};

export const ACCENTS = {
  hash: '<path d="M5 9h14M5 15h14"/>',
  lock: '<path d="M12 14v2.5"/>',
  calendar: '<path d="M3.2 10h17.6"/>',
  clock: '<path d="M12 6.6V12l3.6 2.2"/>',
  timer: '<path d="M12 9.5v4l2.8 1.7"/>',
  database: '<path d="M4.2 11.9c0 1.7 3.5 3 7.8 3s7.8-1.3 7.8-3"/>',
  checkSquare: '<path d="m8 12.2 2.8 2.8 5.2-6"/>',
  shield: '<path d="m9.2 12 2 2 3.6-4"/>',
  badge: '<path d="m9.4 12 1.9 1.9 3.6-4"/>',
  pencil: '<path d="m13.2 6.6 4.2 4.2"/>',
  fileText: '<path d="M8.6 13h6.8M8.6 16.6h4.4"/>',
  fileLock: '<rect x="9.4" y="12.6" width="5.2" height="4.4" rx="1.1"/>',
  gear: '<circle cx="14.6" cy="6.4" r="2.3"/><circle cx="9.6" cy="12" r="2.3"/><circle cx="14.6" cy="17.6" r="2.3"/>',
  grid: '<rect x="13.6" y="3" width="7.4" height="7.4" rx="2"/><rect x="3" y="13.6" width="7.4" height="7.4" rx="2"/>',
  palette: '<circle cx="7.6" cy="11" r="1.15"/><circle cx="11.2" cy="7.6" r="1.15"/><circle cx="15.8" cy="9.4" r="1.15"/>',
  qr: '<rect x="13.8" y="13.8" width="3" height="3"/><path d="M20.8 13.8h-1M13.8 20.8h3M20.8 17.6v3.2"/>',
  key: '<path d="M16.5 7l2.5 2.5M13.8 9.7l2.5 2.5"/>',
  monitor: '<path d="M8.4 20.6h7.2M12 16.6v4"/>',
  calculator: '<path d="M8 6.8h8"/>',
  chart: '<path d="M11.5 20.5V4.5"/>',
  keyboard: '<path d="M9.2 13.6h5.6"/>',
  network: '<rect x="9" y="3" width="6" height="5.2" rx="1.4"/>',
  globe: '<path d="M3.2 12h17.6"/>',
  type: '<path d="M12 5v14M9 19h6"/>',
  percent: '<circle cx="7.6" cy="7.6" r="2.6"/><circle cx="16.4" cy="16.4" r="2.6"/>',
  ruler: '<path d="M10.3 8.2v4M17.7 8.2v4"/>',
  alignLeft: '<path d="M4 10.5h11.5M4 20.5h8"/>',
  compare: '<path d="M12 2.4v19.2"/>',
  user: '<circle cx="12" cy="8" r="4"/>',
  fingerprint: '<path d="M12 11.4v3.4c0 1.9-.4 3.7-1.2 5.4"/>',
};

export const iconNames = Object.keys(PATHS);

export const icon = (name, size = 24) => {
  const accent = ACCENTS[name];
  return raw(
    `<svg class="icon" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${
      PATHS[name] ?? PATHS.box
    }${accent ? `<g class="accent" stroke="var(--icon-accent, #ffd66b)">${accent}</g>` : ''}</svg>`,
  );
};
