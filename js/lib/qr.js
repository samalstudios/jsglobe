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

const FORMAT_BITS = { L: 1, M: 0, Q: 3, H: 2 };

const rawDataModules = (version) => {
  let result = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const alignCount = Math.floor(version / 7) + 2;
    result -= (25 * alignCount - 10) * alignCount - 55;
    if (version >= 7) result -= 36;
  }
  return result;
};

const dataCodewords = (version, ecl) =>
  Math.floor(rawDataModules(version) / 8) - ECC_PER_BLOCK[ecl][version] * BLOCKS[ecl][version];

const alignmentPositions = (version) => {
  if (version === 1) return [];
  const count = Math.floor(version / 7) + 2;
  const step = version === 32 ? 26 : Math.ceil((version * 4 + 4) / (count * 2 - 2)) * 2;
  const result = [6];
  for (let position = version * 4 + 10; result.length < count; position -= step) result.splice(1, 0, position);
  return result;
};

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

const multiply = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

const generatorPolynomial = (degree) => {
  let result = [1];
  for (let i = 0; i < degree; i += 1) {
    const next = new Array(result.length + 1).fill(0);
    for (let j = 0; j < result.length; j += 1) {
      next[j] ^= multiply(result[j], EXP[i]);
      next[j + 1] ^= result[j];
    }
    result = next;
  }
  return result;
};

const remainder = (data, degree) => {
  const generator = generatorPolynomial(degree);
  const result = new Array(degree).fill(0);
  data.forEach((byte) => {
    const factor = byte ^ result.shift();
    result.push(0);
    generator.slice(1).forEach((coefficient, index) => {
      result[index] ^= multiply(coefficient, factor);
    });
  });
  return result;
};

const charCountBits = (version) => (version < 10 ? 8 : 16);

const buildCodewords = (bytes, version, ecl) => {
  const capacity = dataCodewords(version, ecl);
  const bits = [];
  const push = (value, length) => {
    for (let i = length - 1; i >= 0; i -= 1) bits.push((value >>> i) & 1);
  };

  push(0b0100, 4);
  push(bytes.length, charCountBits(version));
  bytes.forEach((byte) => push(byte, 8));

  const limit = capacity * 8;
  push(0, Math.min(4, limit - bits.length));
  while (bits.length % 8 !== 0) bits.push(0);

  const data = [];
  for (let i = 0; i < bits.length; i += 8) {
    data.push(bits.slice(i, i + 8).reduce((total, bit) => (total << 1) | bit, 0));
  }
  for (let pad = 0xec; data.length < capacity; pad ^= 0xec ^ 0x11) data.push(pad);

  const blockCount = BLOCKS[ecl][version];
  const eccLength = ECC_PER_BLOCK[ecl][version];
  const shortBlockLength = Math.floor(capacity / blockCount);
  const longBlocks = capacity % blockCount;

  const blocks = [];
  let offset = 0;
  for (let i = 0; i < blockCount; i += 1) {
    const length = shortBlockLength + (i >= blockCount - longBlocks ? 1 : 0);
    const block = data.slice(offset, offset + length);
    offset += length;
    blocks.push({ data: block, ecc: remainder(block, eccLength) });
  }

  const result = [];
  const maxData = Math.max(...blocks.map((block) => block.data.length));
  for (let i = 0; i < maxData; i += 1) {
    blocks.forEach((block) => {
      if (i < block.data.length) result.push(block.data[i]);
    });
  }
  for (let i = 0; i < eccLength; i += 1) {
    blocks.forEach((block) => result.push(block.ecc[i]));
  }
  return result;
};

const createMatrix = (version) => {
  const size = version * 4 + 17;
  const modules = Array.from({ length: size }, () => new Array(size).fill(false));
  const reserved = Array.from({ length: size }, () => new Array(size).fill(false));

  const setFunction = (x, y, value) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    modules[y][x] = value;
    reserved[y][x] = true;
  };

  const drawFinder = (cx, cy) => {
    for (let dy = -4; dy <= 4; dy += 1) {
      for (let dx = -4; dx <= 4; dx += 1) {
        const distance = Math.max(Math.abs(dx), Math.abs(dy));
        setFunction(cx + dx, cy + dy, distance !== 2 && distance !== 4);
      }
    }
  };

  drawFinder(3, 3);
  drawFinder(size - 4, 3);
  drawFinder(3, size - 4);

  for (let i = 8; i < size - 8; i += 1) {
    setFunction(i, 6, i % 2 === 0);
    setFunction(6, i, i % 2 === 0);
  }

  const positions = alignmentPositions(version);
  positions.forEach((cy) => {
    positions.forEach((cx) => {
      if ((cx === 6 && cy === 6) || (cx === 6 && cy === size - 7) || (cx === size - 7 && cy === 6)) return;
      for (let dy = -2; dy <= 2; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) {
          setFunction(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
        }
      }
    });
  });

  for (let i = 0; i < 9; i += 1) {
    if (i === 6) continue;
    setFunction(i, 8, false);
    setFunction(8, i, false);
  }
  for (let i = 0; i < 8; i += 1) {
    setFunction(size - 1 - i, 8, false);
    setFunction(8, size - 1 - i, false);
  }
  setFunction(8, size - 8, true);

  if (version >= 7) {
    for (let i = 0; i < 18; i += 1) {
      setFunction(Math.floor(i / 3), size - 11 + (i % 3), false);
      setFunction(size - 11 + (i % 3), Math.floor(i / 3), false);
    }
  }

  return { size, modules, reserved };
};

const placeData = (matrix, codewords) => {
  const { size, modules, reserved } = matrix;
  let bitIndex = 0;

  let right = size - 1;
  while (right >= 1) {
    if (right === 6) right = 5;
    for (let vertical = 0; vertical < size; vertical += 1) {
      for (let offset = 0; offset < 2; offset += 1) {
        const x = right - offset;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vertical : vertical;
        if (reserved[y][x]) continue;
        const byte = codewords[bitIndex >>> 3];
        modules[y][x] = byte !== undefined && ((byte >>> (7 - (bitIndex & 7))) & 1) === 1;
        bitIndex += 1;
      }
    }
    right -= 2;
  }
};

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

const applyMask = (matrix, mask) => {
  const { size, modules, reserved } = matrix;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (!reserved[y][x] && MASKS[mask](x, y)) modules[y][x] = !modules[y][x];
    }
  }
};

const drawFormat = (matrix, ecl, mask) => {
  const { size, modules } = matrix;
  const data = (FORMAT_BITS[ecl] << 3) | mask;
  let rest = data;
  for (let i = 0; i < 10; i += 1) rest = (rest << 1) ^ ((rest >>> 9) * 0x537);
  const bits = ((data << 10) | rest) ^ 0x5412;

  const get = (index) => ((bits >>> index) & 1) === 1;

  for (let i = 0; i <= 5; i += 1) modules[i][8] = get(i);
  modules[7][8] = get(6);
  modules[8][8] = get(7);
  modules[8][7] = get(8);
  for (let i = 9; i < 15; i += 1) modules[8][14 - i] = get(i);

  for (let i = 0; i < 8; i += 1) modules[8][size - 1 - i] = get(i);
  for (let i = 8; i < 15; i += 1) modules[size - 15 + i][8] = get(i);
  modules[size - 8][8] = true;
};

const drawVersion = (matrix, version) => {
  if (version < 7) return;
  const { size, modules } = matrix;
  let rest = version;
  for (let i = 0; i < 12; i += 1) rest = (rest << 1) ^ ((rest >>> 11) * 0x1f25);
  const bits = (version << 12) | rest;

  for (let i = 0; i < 18; i += 1) {
    const bit = ((bits >>> i) & 1) === 1;
    const a = Math.floor(i / 3);
    const b = size - 11 + (i % 3);
    modules[b][a] = bit;
    modules[a][b] = bit;
  }
};

const penalty = (matrix) => {
  const { size, modules } = matrix;
  let score = 0;

  const runScore = (run) => (run >= 5 ? 3 + (run - 5) : 0);

  for (let y = 0; y < size; y += 1) {
    let run = 1;
    for (let x = 1; x < size; x += 1) {
      if (modules[y][x] === modules[y][x - 1]) run += 1;
      else {
        score += runScore(run);
        run = 1;
      }
    }
    score += runScore(run);
  }

  for (let x = 0; x < size; x += 1) {
    let run = 1;
    for (let y = 1; y < size; y += 1) {
      if (modules[y][x] === modules[y - 1][x]) run += 1;
      else {
        score += runScore(run);
        run = 1;
      }
    }
    score += runScore(run);
  }

  for (let y = 0; y < size - 1; y += 1) {
    for (let x = 0; x < size - 1; x += 1) {
      const value = modules[y][x];
      if (value === modules[y][x + 1] && value === modules[y + 1][x] && value === modules[y + 1][x + 1]) score += 3;
    }
  }

  const patterns = [
    [true, false, true, true, true, false, true, false, false, false, false],
    [false, false, false, false, true, false, true, true, true, false, true],
  ];

  const matches = (cells) => patterns.some((pattern) => pattern.every((bit, index) => bit === cells[index]));

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x <= size - 11; x += 1) {
      if (matches(modules[y].slice(x, x + 11))) score += 40;
    }
  }
  for (let x = 0; x < size; x += 1) {
    for (let y = 0; y <= size - 11; y += 1) {
      if (matches(Array.from({ length: 11 }, (unused, index) => modules[y + index][x]))) score += 40;
    }
  }

  const dark = modules.flat().filter(Boolean).length;
  const total = size * size;
  score += Math.floor(Math.abs((dark * 100) / total - 50) / 5) * 10;

  return score;
};

export function encodeQr(text, ecl = 'M') {
  const bytes = [...new TextEncoder().encode(text)];
  if (!bytes.length) throw new Error('Nothing to encode');

  let version = 1;
  while (version <= 40) {
    const capacity = dataCodewords(version, ecl) * 8;
    if (4 + charCountBits(version) + bytes.length * 8 <= capacity) break;
    version += 1;
  }
  if (version > 40) throw new Error('Content is too long for a QR code');

  const codewords = buildCodewords(bytes, version, ecl);

  let best = null;
  for (let mask = 0; mask < 8; mask += 1) {
    const matrix = createMatrix(version);
    placeData(matrix, codewords);
    drawFormat(matrix, ecl, mask);
    drawVersion(matrix, version);
    applyMask(matrix, mask);
    const score = penalty(matrix);
    if (!best || score < best.score) best = { score, matrix, mask };
  }

  return {
    version,
    ecl,
    mask: best.mask,
    size: best.matrix.size,
    modules: best.matrix.modules,
    capacity: dataCodewords(version, ecl),
    used: bytes.length,
  };
}

export const qrToSvg = (code, { scale = 8, margin = 4, dark = '#000000', light = '#ffffff' } = {}) => {
  const dimension = (code.size + margin * 2) * scale;
  const path = [];
  code.modules.forEach((row, y) => {
    row.forEach((filled, x) => {
      if (filled) path.push(`M${(x + margin) * scale} ${(y + margin) * scale}h${scale}v${scale}h-${scale}z`);
    });
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${dimension}" height="${dimension}" viewBox="0 0 ${dimension} ${dimension}" shape-rendering="crispEdges"><rect width="${dimension}" height="${dimension}" fill="${light}"/><path d="${path.join('')}" fill="${dark}"/></svg>`;
};
