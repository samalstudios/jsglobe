const clamp = (value) => Math.min(1, Math.max(0, value));

const gamma = (value) => (value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055);

const ungamma = (value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);

export const oklchToRgb = (lightness, chroma, hue) => {
  const angle = (hue * Math.PI) / 180;
  const a = chroma * Math.cos(angle);
  const b = chroma * Math.sin(angle);

  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;

  return {
    r: 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  };
};

export const rgbToOklch = ({ r, g, b }) => {
  const lr = ungamma(r / 255);
  const lg = ungamma(g / 255);
  const lb = ungamma(b / 255);

  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);

  const lightness = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;

  return {
    l: lightness,
    c: Math.hypot(a, bb),
    h: (Math.atan2(bb, a) * (180 / Math.PI) + 360) % 360,
  };
};

export const oklchToHex = (lightness, chroma, hue) => {
  let current = chroma;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const { r, g, b } = oklchToRgb(lightness, current, hue);
    const inGamut = [r, g, b].every((value) => value >= -0.0002 && value <= 1.0002);
    if (inGamut || current <= 0) {
      return `#${[r, g, b]
        .map((value) => Math.round(clamp(gamma(clamp(value))) * 255).toString(16).padStart(2, '0'))
        .join('')}`;
    }
    current *= 0.96;
  }
  return '#000000';
};

export const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

const LIGHTNESS = [0.971, 0.936, 0.885, 0.808, 0.723, 0.637, 0.577, 0.505, 0.444, 0.396, 0.264];
const GREY_LIGHTNESS = [0.984, 0.967, 0.928, 0.868, 0.71, 0.556, 0.449, 0.374, 0.283, 0.212, 0.135];
const WARM_BOOST = [0, 0.005, 0.016, 0.036, 0.066, 0.082, 0.07, 0.05, 0.03, 0.018, 0.008];
const CHROMA = [0.015, 0.036, 0.072, 0.122, 0.168, 0.192, 0.188, 0.168, 0.142, 0.122, 0.082];

export const HUES = [
  { id: 'red', name: 'Red', hue: 27, chroma: 1 },
  { id: 'orange', family: 'warm', name: 'Orange', hue: 55, chroma: 1 },
  { id: 'amber', family: 'warm', name: 'Amber', hue: 76, chroma: 1 },
  { id: 'yellow', family: 'warm', name: 'Yellow', hue: 95, chroma: 1 },
  { id: 'lime', family: 'warm', name: 'Lime', hue: 128, chroma: 1 },
  { id: 'green', name: 'Green', hue: 150, chroma: 0.96 },
  { id: 'emerald', name: 'Emerald', hue: 163, chroma: 0.92 },
  { id: 'teal', name: 'Teal', hue: 181, chroma: 0.9 },
  { id: 'cyan', name: 'Cyan', hue: 205, chroma: 0.92 },
  { id: 'sky', name: 'Sky', hue: 231, chroma: 0.94 },
  { id: 'blue', name: 'Blue', hue: 259, chroma: 1 },
  { id: 'indigo', name: 'Indigo', hue: 277, chroma: 1 },
  { id: 'violet', name: 'Violet', hue: 293, chroma: 1 },
  { id: 'purple', name: 'Purple', hue: 306, chroma: 1 },
  { id: 'fuchsia', name: 'Fuchsia', hue: 322, chroma: 1 },
  { id: 'pink', name: 'Pink', hue: 354, chroma: 0.98 },
  { id: 'rose', name: 'Rose', hue: 14, chroma: 1 },
  { id: 'slate', family: 'grey', name: 'Slate', hue: 257, chroma: 0.22 },
  { id: 'gray', family: 'grey', name: 'Gray', hue: 264, chroma: 0.18 },
  { id: 'zinc', family: 'grey', name: 'Zinc', hue: 286, chroma: 0.14 },
  { id: 'neutral', family: 'grey', name: 'Neutral', hue: 0, chroma: 0 },
  { id: 'stone', family: 'grey', name: 'Stone', hue: 58, chroma: 0.16 },
];

export const scaleFor = (hue, chromaScale = 1, family = 'colour') =>
  SHADES.map((shade, index) => {
    const base = family === 'grey' ? GREY_LIGHTNESS[index] : LIGHTNESS[index];
    const lightness = family === 'warm' ? Math.min(0.985, base + WARM_BOOST[index]) : base;
    return { shade, hex: oklchToHex(lightness, CHROMA[index] * chromaScale, hue) };
  });

export const palette = HUES.map((entry) => ({
  ...entry,
  shades: scaleFor(entry.hue, entry.chroma, entry.family ?? 'colour'),
}));

export const scaleFromHex = (hex) => {
  const value = hex.replace('#', '');
  const rgb = {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
  const { c, h } = rgbToOklch(rgb);
  const reference = CHROMA[5] || 0.192;
  const family = c < 0.045 ? 'grey' : h > 40 && h < 140 ? 'warm' : 'colour';
  return scaleFor(h, Math.min(1.35, Math.max(0.06, c / reference)), family);
};
