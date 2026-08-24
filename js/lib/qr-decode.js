const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);

(() => {
  let value = 1;
  for (let i = 0; i < 255; i += 1) {
    EXP[i] = value;
    LOG[value] = i;
    value <<= 1;
    if (value & 0x100) value ^= 0x11d;
  }
  for (let i = 255; i < 512; i += 1) EXP[i] = EXP[i - 255];
})();

const mul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);
const inv = (a) => EXP[255 - LOG[a]];

const ECC_PER_BLOCK = {
  L: [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  M: [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  Q: [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  H: [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
};

const BLOCKS = {
  L: [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  M: [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  Q: [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  H: [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
};

const LEVEL_OF = { 1: 'L', 0: 'M', 3: 'Q', 2: 'H' };

const MASKS = [
  (x, y) => (x + y) % 2 === 0,
  (x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

const ALPHANUMERIC = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';

const COUNT_BITS = {
  numeric: [10, 12, 14],
  alphanumeric: [9, 11, 13],
  byte: [8, 16, 16],
  kanji: [8, 10, 12],
};

const countBits = (mode, version) => {
  const band = version < 10 ? 0 : version < 27 ? 1 : 2;
  return COUNT_BITS[mode][band];
};

const alignmentPositions = (version) => {
  if (version === 1) return [];
  const count = Math.floor(version / 7) + 2;
  const step = version === 32 ? 26 : Math.ceil((version * 4 + 4) / (count * 2 - 2)) * 2;
  const spots = [6];
  for (let at = version * 4 + 10; spots.length < count; at -= step) spots.splice(1, 0, at);
  return spots;
};

const functionMap = (version) => {
  const size = version * 4 + 17;
  const map = Array.from({ length: size }, () => new Array(size).fill(false));
  const fill = (x0, y0, w, h) => {
    for (let y = y0; y < y0 + h; y += 1) {
      for (let x = x0; x < x0 + w; x += 1) {
        if (x >= 0 && y >= 0 && x < size && y < size) map[y][x] = true;
      }
    }
  };
  fill(0, 0, 9, 9);
  fill(size - 8, 0, 8, 9);
  fill(0, size - 8, 9, 8);
  for (let i = 0; i < size; i += 1) {
    map[6][i] = true;
    map[i][6] = true;
  }
  const spots = alignmentPositions(version);
  for (const cy of spots) {
    for (const cx of spots) {
      if ((cx === 6 && cy === 6) || (cx === 6 && cy === size - 7) || (cx === size - 7 && cy === 6)) continue;
      fill(cx - 2, cy - 2, 5, 5);
    }
  }
  if (version >= 7) {
    for (let i = 0; i < 18; i += 1) {
      const a = Math.floor(i / 3);
      const b = size - 11 + (i % 3);
      map[b][a] = true;
      map[a][b] = true;
    }
  }
  return map;
};

const bitCount = (value) => {
  let total = 0;
  let rest = value;
  while (rest) {
    total += rest & 1;
    rest >>>= 1;
  }
  return total;
};

const readFormat = (modules, size) => {
  const first = [];
  for (let i = 0; i < 6; i += 1) first.push(modules[i][8] ? 1 : 0);
  first.push(modules[7][8] ? 1 : 0);
  first.push(modules[8][8] ? 1 : 0);
  first.push(modules[8][7] ? 1 : 0);
  for (let i = 9; i < 15; i += 1) first.push(modules[8][14 - i] ? 1 : 0);

  const second = [];
  for (let i = 0; i < 8; i += 1) second.push(modules[8][size - 1 - i] ? 1 : 0);
  for (let i = 8; i < 15; i += 1) second.push(modules[size - 15 + i][8] ? 1 : 0);

  let best = null;
  for (const bits of [first, second]) {
    let value = 0;
    bits.forEach((bit, index) => {
      value |= bit << index;
    });
    value ^= 0x5412;
    for (let candidate = 0; candidate < 32; candidate += 1) {
      let rest = candidate;
      for (let i = 0; i < 10; i += 1) rest = (rest << 1) ^ ((rest >>> 9) * 0x537);
      const apart = bitCount(((candidate << 10) | rest) ^ value);
      if (!best || apart < best.apart) best = { apart, candidate };
    }
  }
  if (!best || best.apart > 3) return null;
  return { level: LEVEL_OF[best.candidate >> 3], mask: best.candidate & 7 };
};

const readVersion = (modules, size) => {
  const guess = (size - 17) / 4;
  if (guess < 7) return guess;
  let best = null;
  for (let corner = 0; corner < 2; corner += 1) {
    let value = 0;
    for (let i = 0; i < 18; i += 1) {
      const a = Math.floor(i / 3);
      const b = size - 11 + (i % 3);
      const bit = corner === 0 ? modules[b][a] : modules[a][b];
      value |= (bit ? 1 : 0) << i;
    }
    for (let candidate = 7; candidate <= 40; candidate += 1) {
      let rest = candidate;
      for (let i = 0; i < 12; i += 1) rest = (rest << 1) ^ ((rest >>> 11) * 0x1f25);
      const apart = bitCount(((candidate << 12) | rest) ^ value);
      if (!best || apart < best.apart) best = { apart, candidate };
    }
  }
  return best && best.apart <= 3 ? best.candidate : guess;
};

const readCodewords = (modules, version, mask) => {
  const size = version * 4 + 17;
  const map = functionMap(version);
  const bits = [];
  let right = size - 1;
  while (right >= 1) {
    if (right === 6) right = 5;
    for (let vertical = 0; vertical < size; vertical += 1) {
      for (let offset = 0; offset < 2; offset += 1) {
        const x = right - offset;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vertical : vertical;
        if (map[y][x]) continue;
        let bit = modules[y][x] ? 1 : 0;
        if (MASKS[mask](x, y)) bit ^= 1;
        bits.push(bit);
      }
    }
    right -= 2;
  }
  const words = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    let byte = 0;
    for (let k = 0; k < 8; k += 1) byte = (byte << 1) | bits[i + k];
    words.push(byte);
  }
  return words;
};

export function correctBlock(message, eccLength) {
  const work = [...message];
  const syndromes = [];
  let broken = false;
  for (let i = 0; i < eccLength; i += 1) {
    let sum = 0;
    for (const byte of work) sum = mul(sum, EXP[i]) ^ byte;
    syndromes.push(sum);
    if (sum !== 0) broken = true;
  }
  if (!broken) return { data: work, fixed: 0 };

  let locator = [1];
  let previous = [1];
  let found = 0;
  let shift = 1;
  let last = 1;

  for (let step = 0; step < eccLength; step += 1) {
    let delta = syndromes[step];
    for (let i = 1; i <= found; i += 1) delta ^= mul(locator[i] ?? 0, syndromes[step - i]);
    if (delta === 0) {
      shift += 1;
      continue;
    }
    const scaled = mul(delta, inv(last));
    const before = [...locator];
    for (let i = 0; i < previous.length; i += 1) {
      const at = i + shift;
      while (locator.length <= at) locator.push(0);
      locator[at] ^= mul(scaled, previous[i]);
    }
    if (2 * found <= step) {
      found = step + 1 - found;
      previous = before;
      last = delta;
      shift = 1;
    } else {
      shift += 1;
    }
  }

  while (locator.length > 1 && locator[locator.length - 1] === 0) locator.pop();
  const degree = locator.length - 1;
  if (found !== degree || found === 0 || found * 2 > eccLength) return null;

  const positions = [];
  for (let i = 0; i < work.length; i += 1) {
    const at = inv(EXP[i % 255]);
    let sum = 0;
    for (let k = 0; k < locator.length; k += 1) sum ^= mul(locator[k], EXP[(LOG[at] * k) % 255]);
    if (sum === 0) positions.push(i);
  }
  if (positions.length !== found) return null;

  const omega = [];
  for (let i = 0; i < eccLength; i += 1) {
    let sum = 0;
    for (let k = 0; k <= i && k < locator.length; k += 1) sum ^= mul(locator[k], syndromes[i - k]);
    omega.push(sum);
  }

  for (const position of positions) {
    const root = EXP[position % 255];
    const rootInverse = inv(root);

    let top = 0;
    for (let i = 0; i < eccLength; i += 1) top ^= mul(omega[i], EXP[(LOG[rootInverse] * i) % 255]);

    let bottom = 0;
    for (let i = 1; i < locator.length; i += 2) {
      const power = i - 1;
      bottom ^= mul(locator[i], power === 0 ? 1 : EXP[(LOG[rootInverse] * power) % 255]);
    }
    if (bottom === 0) return null;

    const magnitude = mul(root, mul(top, inv(bottom)));
    work[work.length - 1 - position] ^= magnitude;
  }

  for (let i = 0; i < eccLength; i += 1) {
    let sum = 0;
    for (const byte of work) sum = mul(sum, EXP[i]) ^ byte;
    if (sum !== 0) return null;
  }

  return { data: work, fixed: positions.length };
}

const readSegments = (bytes, version) => {
  const bits = [];
  for (const byte of bytes) {
    for (let k = 7; k >= 0; k -= 1) bits.push((byte >>> k) & 1);
  }
  let at = 0;
  const left = () => bits.length - at;
  const take = (count) => {
    let value = 0;
    for (let i = 0; i < count; i += 1) value = (value << 1) | bits[at++];
    return value;
  };

  const out = [];
  const raw = [];
  while (left() >= 4) {
    const mode = take(4);
    if (mode === 0) break;

    if (mode === 7) {
      const lead = take(8);
      if (lead >= 0xc0) take(16);
      else if (lead >= 0x80) take(8);
      continue;
    }

    if (mode === 1) {
      let count = take(countBits('numeric', version));
      let text = '';
      while (count >= 3) {
        text += String(take(10)).padStart(3, '0');
        count -= 3;
      }
      if (count === 2) text += String(take(7)).padStart(2, '0');
      else if (count === 1) text += String(take(4));
      out.push(text);
      continue;
    }

    if (mode === 2) {
      let count = take(countBits('alphanumeric', version));
      let text = '';
      while (count >= 2) {
        const pair = take(11);
        text += ALPHANUMERIC[Math.floor(pair / 45)] + ALPHANUMERIC[pair % 45];
        count -= 2;
      }
      if (count === 1) text += ALPHANUMERIC[take(6)];
      out.push(text);
      continue;
    }

    if (mode === 4) {
      const count = take(countBits('byte', version));
      const chunk = [];
      for (let i = 0; i < count; i += 1) chunk.push(take(8));
      raw.push(...chunk);
      out.push(new TextDecoder().decode(Uint8Array.from(chunk)));
      continue;
    }

    if (mode === 8) {
      const count = take(countBits('kanji', version));
      let text = '';
      for (let i = 0; i < count; i += 1) {
        const packed = take(13);
        let value = (Math.floor(packed / 0xc0) << 8) | (packed % 0xc0);
        value += value < 0x1f00 ? 0x8140 : 0xc140;
        text += String.fromCharCode(value);
      }
      out.push(text);
      continue;
    }

    break;
  }

  return { text: out.join(''), bytes: raw };
};

export function decodeQrMatrix(modules) {
  const size = modules.length;
  if (!size || modules.some((row) => row.length !== size)) return null;
  if (size < 21 || size > 177 || (size - 17) % 4 !== 0) return null;

  const format = readFormat(modules, size);
  if (!format) return null;
  const version = readVersion(modules, size);
  if (version * 4 + 17 !== size) return null;

  const words = readCodewords(modules, version, format.mask);
  const level = format.level;
  const total = Math.floor(((16 * version + 128) * version + 64 - (version >= 2 ? (25 * (Math.floor(version / 7) + 2) - 10) * (Math.floor(version / 7) + 2) - 55 + (version >= 7 ? 36 : 0) : 0)) / 8) - ECC_PER_BLOCK[level][version] * BLOCKS[level][version];

  const count = BLOCKS[level][version];
  const eccLength = ECC_PER_BLOCK[level][version];
  const short = Math.floor(total / count);
  const longOnes = total % count;
  const lengths = Array.from({ length: count }, (unused, i) => short + (i >= count - longOnes ? 1 : 0));

  const blocks = Array.from({ length: count }, () => []);
  let cursor = 0;
  for (let i = 0; i < Math.max(...lengths); i += 1) {
    for (let b = 0; b < count; b += 1) {
      if (i < lengths[b]) blocks[b].push(words[cursor++] ?? 0);
    }
  }
  const eccs = Array.from({ length: count }, () => []);
  for (let i = 0; i < eccLength; i += 1) {
    for (let b = 0; b < count; b += 1) eccs[b].push(words[cursor++] ?? 0);
  }

  let repaired = 0;
  const healed = [];
  for (let b = 0; b < count; b += 1) {
    const outcome = correctBlock([...blocks[b], ...eccs[b]], eccLength);
    if (!outcome) return null;
    repaired += outcome.fixed;
    healed.push(outcome.data.slice(0, lengths[b]));
  }

  const stream = healed.flat();
  const read = readSegments(stream, version);
  if (!read.text && !read.bytes.length) return null;

  return { text: read.text, bytes: read.bytes, version, level, mask: format.mask, size, repaired };
}

export function binarize(image) {
  const { data, width, height } = image;
  const gray = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i += 1) {
    gray[i] = (data[i * 4] * 77 + data[i * 4 + 1] * 151 + data[i * 4 + 2] * 28) >> 8;
  }

  const block = 8;
  const across = Math.max(1, Math.ceil(width / block));
  const down = Math.max(1, Math.ceil(height / block));
  const averages = new Float32Array(across * down);

  for (let by = 0; by < down; by += 1) {
    for (let bx = 0; bx < across; bx += 1) {
      let sum = 0;
      let seen = 0;
      for (let y = by * block; y < Math.min(height, (by + 1) * block); y += 1) {
        for (let x = bx * block; x < Math.min(width, (bx + 1) * block); x += 1) {
          sum += gray[y * width + x];
          seen += 1;
        }
      }
      averages[by * across + bx] = seen ? sum / seen : 128;
    }
  }

  const bits = new Uint8Array(width * height);
  for (let by = 0; by < down; by += 1) {
    for (let bx = 0; bx < across; bx += 1) {
      let total = 0;
      let seen = 0;
      for (let dy = -2; dy <= 2; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) {
          const nx = bx + dx;
          const ny = by + dy;
          if (nx < 0 || ny < 0 || nx >= across || ny >= down) continue;
          total += averages[ny * across + nx];
          seen += 1;
        }
      }
      const cut = total / seen;
      for (let y = by * block; y < Math.min(height, (by + 1) * block); y += 1) {
        for (let x = bx * block; x < Math.min(width, (bx + 1) * block); x += 1) {
          bits[y * width + x] = gray[y * width + x] < cut ? 1 : 0;
        }
      }
    }
  }

  return { bits, width, height };
}

const dark = (bitmap, x, y) => {
  if (x < 0 || y < 0 || x >= bitmap.width || y >= bitmap.height) return 0;
  return bitmap.bits[y * bitmap.width + x];
};

const looksLikeFinder = (runs) => {
  const total = runs.reduce((sum, value) => sum + value, 0);
  if (total < 7) return false;
  const unit = total / 7;
  const slack = unit / 2;
  return (
    Math.abs(unit - runs[0]) < slack &&
    Math.abs(unit - runs[1]) < slack &&
    Math.abs(unit * 3 - runs[2]) < slack * 3 &&
    Math.abs(unit - runs[3]) < slack &&
    Math.abs(unit - runs[4]) < slack
  );
};

const runCentre = (runs, end) => end - runs[4] - runs[3] - runs[2] / 2;

const scanLine = (bitmap, length, read) => {
  const hits = [];
  const runs = [0, 0, 0, 0, 0];
  let stage = 0;
  for (let i = 0; i < length; i += 1) {
    const on = read(i);
    if (on) {
      if (stage % 2 === 1) stage += 1;
      runs[stage] += 1;
    } else if (stage % 2 === 0) {
      if (stage === 4) {
        if (looksLikeFinder(runs)) hits.push({ at: runCentre(runs, i), unit: runs.reduce((s, v) => s + v, 0) / 7 });
        runs[0] = runs[2];
        runs[1] = runs[3];
        runs[2] = runs[4];
        runs[3] = 1;
        runs[4] = 0;
        stage = 3;
      } else {
        stage += 1;
        runs[stage] += 1;
      }
    } else {
      runs[stage] += 1;
    }
  }
  if (stage === 4 && looksLikeFinder(runs)) {
    hits.push({ at: runCentre(runs, length), unit: runs.reduce((s, v) => s + v, 0) / 7 });
  }
  return hits;
};

export function findFinders(bitmap) {
  const raw = [];
  for (let y = 0; y < bitmap.height; y += 2) {
    for (const hit of scanLine(bitmap, bitmap.width, (x) => dark(bitmap, x, y))) {
      const x = Math.round(hit.at);
      const down = scanLine(bitmap, bitmap.height, (v) => dark(bitmap, x, v)).filter(
        (entry) => Math.abs(entry.at - y) < hit.unit * 4 && Math.abs(entry.unit - hit.unit) < hit.unit * 0.7,
      );
      if (!down.length) continue;
      raw.push({ x: hit.at, y: down[0].at, unit: (hit.unit + down[0].unit) / 2 });
    }
  }

  const groups = [];
  for (const point of raw) {
    const near = groups.find(
      (group) => Math.abs(group.x - point.x) < group.unit * 2 && Math.abs(group.y - point.y) < group.unit * 2,
    );
    if (near) {
      near.x = (near.x * near.seen + point.x) / (near.seen + 1);
      near.y = (near.y * near.seen + point.y) / (near.seen + 1);
      near.unit = (near.unit * near.seen + point.unit) / (near.seen + 1);
      near.seen += 1;
    } else {
      groups.push({ ...point, seen: 1 });
    }
  }

  return groups.filter((group) => group.seen >= 2).sort((a, b) => b.seen - a.seen);
}

const span = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

const orderCorners = (three) => {
  const [a, b, c] = three;
  const sides = [
    { corner: a, far: [b, c], length: span(b, c) },
    { corner: b, far: [a, c], length: span(a, c) },
    { corner: c, far: [a, b], length: span(a, b) },
  ];
  const origin = sides.reduce((best, entry) => (entry.length > best.length ? entry : best));
  const [one, two] = origin.far;
  const cross = (one.x - origin.corner.x) * (two.y - origin.corner.y) - (one.y - origin.corner.y) * (two.x - origin.corner.x);
  return cross < 0
    ? { topLeft: origin.corner, topRight: two, bottomLeft: one }
    : { topLeft: origin.corner, topRight: one, bottomLeft: two };
};

const transformFrom = (from, to) => {
  const matrix = [];
  const target = [];
  for (let i = 0; i < 4; i += 1) {
    const { x, y } = from[i];
    const { x: u, y: v } = to[i];
    matrix.push([x, y, 1, 0, 0, 0, -x * u, -y * u]);
    target.push(u);
    matrix.push([0, 0, 0, x, y, 1, -x * v, -y * v]);
    target.push(v);
  }

  const size = 8;
  for (let column = 0; column < size; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < size; row += 1) {
      if (Math.abs(matrix[row][column]) > Math.abs(matrix[pivot][column])) pivot = row;
    }
    if (Math.abs(matrix[pivot][column]) < 1e-9) return null;
    [matrix[column], matrix[pivot]] = [matrix[pivot], matrix[column]];
    [target[column], target[pivot]] = [target[pivot], target[column]];
    for (let row = 0; row < size; row += 1) {
      if (row === column) continue;
      const factor = matrix[row][column] / matrix[column][column];
      if (!factor) continue;
      for (let k = column; k < size; k += 1) matrix[row][k] -= factor * matrix[column][k];
      target[row] -= factor * target[column];
    }
  }

  const solved = target.map((value, index) => value / matrix[index][index]);
  const [a, b, c, d, e, f, g, h] = solved;
  return (x, y) => {
    const bottom = g * x + h * y + 1;
    return { x: (a * x + b * y + c) / bottom, y: (d * x + e * y + f) / bottom };
  };
};

const findAlignment = (bitmap, guess, unit) => {
  const reach = Math.max(6, Math.round(unit * 5));
  const step = Math.max(1, unit);
  let best = null;

  for (let dy = -reach; dy <= reach; dy += 1) {
    for (let dx = -reach; dx <= reach; dx += 1) {
      const x = Math.round(guess.x + dx);
      const y = Math.round(guess.y + dy);
      if (!dark(bitmap, x, y)) continue;

      let score = 0;
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        if (!dark(bitmap, Math.round(x + ox * step), Math.round(y + oy * step))) score += 1;
      }
      for (const [ox, oy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) {
        if (dark(bitmap, Math.round(x + ox * step), Math.round(y + oy * step))) score += 1;
      }
      if (score < 9) continue;

      const away = Math.hypot(dx, dy);
      if (!best || score > best.score || (score === best.score && away < best.away)) best = { x, y, score, away };
    }
  }
  return best;
};

export function estimateDimension(finders) {
  const { topLeft, topRight, bottomLeft } = orderCorners(finders);
  const unit = (topLeft.unit + topRight.unit + bottomLeft.unit) / 3;
  if (!unit) return null;
  const across = span(topLeft, topRight) / unit;
  const down = span(topLeft, bottomLeft) / unit;
  const rough = (across + down) / 2 + 7;
  const snapped = Math.round((rough - 17) / 4) * 4 + 17;
  return Math.min(177, Math.max(21, snapped));
}

export function sampleQr(bitmap, finders, options = {}) {
  const { topLeft, topRight, bottomLeft } = orderCorners(finders);
  const unit = (topLeft.unit + topRight.unit + bottomLeft.unit) / 3;
  if (!unit) return null;

  const dimension = options.dimension ?? estimateDimension(finders);
  if (!dimension || dimension < 21 || dimension > 177 || (dimension - 17) % 4 !== 0) return null;

  const version = (dimension - 17) / 4;
  const corner = {
    x: topRight.x + bottomLeft.x - topLeft.x,
    y: topRight.y + bottomLeft.y - topLeft.y,
  };

  const from = [
    { x: 3.5, y: 3.5 },
    { x: dimension - 3.5, y: 3.5 },
    { x: 3.5, y: dimension - 3.5 },
    { x: dimension - 3.5, y: dimension - 3.5 },
  ];
  const to = [topLeft, topRight, bottomLeft, corner];

  if (version >= 2 && options.useAlignment !== false) {
    const spots = alignmentPositions(version);
    const last = spots[spots.length - 1];
    const rough = transformFrom(from, to);
    if (!rough) return null;
    const guess = rough(last + 0.5, last + 0.5);
    const reach = span(topLeft, topRight) / dimension;
    const found = findAlignment(bitmap, guess, reach || unit);
    if (!found) return null;
    from[3] = { x: last + 0.5, y: last + 0.5 };
    to[3] = found;
  }

  const place = transformFrom(from, to);
  if (!place) return null;

  const modules = [];
  for (let y = 0; y < dimension; y += 1) {
    const row = [];
    for (let x = 0; x < dimension; x += 1) {
      let votes = 0;
      for (const [ox, oy] of [[0, 0], [-0.25, 0], [0.25, 0], [0, -0.25], [0, 0.25]]) {
        const near = place(x + 0.5 + ox, y + 0.5 + oy);
        votes += dark(bitmap, Math.round(near.x), Math.round(near.y));
      }
      row.push(votes >= 3);
    }
    modules.push(row);
  }
  return modules;
}

export function scanQrImage(image) {
  const bitmap = binarize(image);
  const finders = findFinders(bitmap);
  if (finders.length < 3) return null;

  const tries = [];
  const reach = Math.min(finders.length, 5);
  for (let a = 0; a < reach; a += 1) {
    for (let b = a + 1; b < reach; b += 1) {
      for (let c = b + 1; c < reach; c += 1) tries.push([finders[a], finders[b], finders[c]]);
    }
  }

  for (const three of tries) {
    const base = estimateDimension(three);
    if (!base) continue;
    const sizes = [];
    for (const delta of [0, 4, -4, 8, -8, 12, -12, 16, -16]) {
      const size = base + delta;
      if (size >= 21 && size <= 177 && (size - 17) % 4 === 0) sizes.push(size);
    }

    for (const dimension of sizes) {
      for (const useAlignment of [true, false]) {
        const modules = sampleQr(bitmap, three, { dimension, useAlignment });
        if (!modules) continue;
        const read = decodeQrMatrix(modules);
        if (read) return read;
        const flipped = modules.map((row) => row.map((value) => !value));
        const inverted = decodeQrMatrix(flipped);
        if (inverted) return inverted;
      }
    }
  }
  return null;
}
