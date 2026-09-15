import { raw } from '../core/dom.js';
import { settings, resolvedTheme } from '../core/settings.js';
import { PATHS, ACCENTS, glyphNames, glyphPath } from '../lib/glyphs.js';
import { SQUIRCLE, appArt } from '../lib/app-art.js';

export { PATHS, ACCENTS };

export const iconNames = glyphNames;

export const iconPath = glyphPath;

export const icon = (name, size = 24) => {
  const accent = ACCENTS[name];
  return raw(
    `<svg class="icon" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${
      PATHS[name] ?? PATHS.box
    }${accent ? `<g class="accent" stroke="var(--icon-accent, #ffd66b)">${accent}</g>` : ''}</svg>`,
  );
};

let drawnCount = 0;

// An app's drawn icon when the skeuomorphic style is on and the app has a
// drawing, following the light or dark theme; otherwise null, and the caller
// shows the flat glyph. Each copy gets its own ids, so one shadow root can hold
// many icons.
export const drawnIcon = (app, size = 62) => {
  if (settings.get('appearance.icons') !== 'skeuomorphic') return null;
  const art = appArt(app.id, { dark: resolvedTheme() === 'dark' });
  if (!art) return null;
  const tone = settings.get('appearance.iconTint');
  const wash = tone === 'accent' ? `<path d="${SQUIRCLE}" fill="var(--ring)" opacity=".85" style="mix-blend-mode:color"/>` : '';
  const style = tone === 'neutral' ? ' style="filter:grayscale(1)"' : '';
  const prefix = `ai${(drawnCount++).toString(36)}-`;
  return raw(
    `<svg class="app-art" viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true"${style}>${(art + wash).replaceAll('@', prefix)}</svg>`,
  );
};
