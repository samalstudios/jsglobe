import { raw } from '../core/dom.js';
import { PATHS, ACCENTS, glyphNames, glyphPath } from '../lib/glyphs.js';

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
