// Inflate, the decompressing half of deflate (RFC 1951), with the zlib
// wrapper (RFC 1950) around it.
//
// The browser's DecompressionStream needs to be handed exactly one stream and
// is asynchronous. Git packs many streams end to end with no lengths between
// them, so this reads one stream, stops at its end and says where that was.
//
//   const { data, end } = inflateZlib(bytes, 0, expectedSize);

const LENGTH_BASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
const LENGTH_EXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
const DISTANCE_BASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
const DISTANCE_EXTRA = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
const CODE_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

// a canonical Huffman code as the count of codes of each length and the
// symbols in code order
const table = (lengths, from, count) => {
  const counts = new Uint16Array(16);
  const symbols = new Uint16Array(count);
  for (let index = 0; index < count; index += 1) counts[lengths[from + index]] += 1;
  counts[0] = 0;
  const offsets = new Uint16Array(16);
  for (let length = 1; length < 16; length += 1) offsets[length] = offsets[length - 1] + counts[length - 1];
  for (let index = 0; index < count; index += 1) {
    const length = lengths[from + index];
    if (length) symbols[offsets[length]++] = index;
  }
  return { counts, symbols };
};

let fixed = null;
const fixedTables = () => {
  if (fixed) return fixed;
  const lengths = new Uint8Array(320);
  lengths.fill(8, 0, 144);
  lengths.fill(9, 144, 256);
  lengths.fill(7, 256, 280);
  lengths.fill(8, 280, 288);
  lengths.fill(5, 288, 318);
  fixed = { literals: table(lengths, 0, 288), distances: table(lengths, 288, 30) };
  return fixed;
};

export class InflateError extends Error {}

/**
 * Inflates a raw deflate stream starting at offset. Returns the bytes and the
 * offset just past the stream. size, when known, sizes the output up front.
 */
export const inflateRaw = (input, offset = 0, size = 0) => {
  let position = offset;
  let tag = 0;
  let count = 0;
  let output = new Uint8Array(size > 0 ? size : Math.max(1024, (input.length - offset) * 4));
  let length = 0;

  const bit = () => {
    if (!count) {
      if (position >= input.length) throw new InflateError('The compressed data ends too soon');
      tag = input[position++];
      count = 8;
    }
    count -= 1;
    const value = tag & 1;
    tag >>>= 1;
    return value;
  };
  const bits = (wanted) => {
    let value = 0;
    for (let index = 0; index < wanted; index += 1) value |= bit() << index;
    return value;
  };
  const decode = ({ counts, symbols }) => {
    let sum = 0;
    let code = 0;
    let bitLength = 0;
    do {
      code = 2 * code + bit();
      bitLength += 1;
      if (bitLength > 15) throw new InflateError('A code in the compressed data is not valid');
      sum += counts[bitLength];
      code -= counts[bitLength];
    } while (code >= 0);
    return symbols[sum + code];
  };
  const room = (extra) => {
    if (length + extra <= output.length) return;
    const grown = new Uint8Array(Math.max(output.length * 2, length + extra));
    grown.set(output.subarray(0, length));
    output = grown;
  };

  let last = 0;
  do {
    last = bit();
    const type = bits(2);
    if (type === 0) {
      count = 0;
      if (position + 4 > input.length) throw new InflateError('The compressed data ends too soon');
      const stored = input[position] | (input[position + 1] << 8);
      position += 4;
      if (position + stored > input.length) throw new InflateError('The compressed data ends too soon');
      room(stored);
      output.set(input.subarray(position, position + stored), length);
      length += stored;
      position += stored;
      continue;
    }
    let literals;
    let distances;
    if (type === 1) ({ literals, distances } = fixedTables());
    else if (type === 2) {
      const literalCount = bits(5) + 257;
      const distanceCount = bits(5) + 1;
      const codeCount = bits(4) + 4;
      const codeLengths = new Uint8Array(19);
      for (let index = 0; index < codeCount; index += 1) codeLengths[CODE_ORDER[index]] = bits(3);
      const codes = table(codeLengths, 0, 19);
      const lengths = new Uint8Array(literalCount + distanceCount);
      for (let index = 0; index < literalCount + distanceCount; ) {
        const symbol = decode(codes);
        if (symbol < 16) lengths[index++] = symbol;
        else if (symbol === 16) {
          if (!index) throw new InflateError('A repeat has nothing to repeat');
          const previous = lengths[index - 1];
          for (let repeat = bits(2) + 3; repeat > 0; repeat -= 1) lengths[index++] = previous;
        } else if (symbol === 17) index += bits(3) + 3;
        else index += bits(7) + 11;
      }
      literals = table(lengths, 0, literalCount);
      distances = table(lengths, literalCount, distanceCount);
    } else throw new InflateError('The compressed data uses an unknown block type');

    for (;;) {
      const symbol = decode(literals);
      if (symbol < 256) {
        room(1);
        output[length++] = symbol;
      } else if (symbol === 256) break;
      else {
        const lengthIndex = symbol - 257;
        const run = LENGTH_BASE[lengthIndex] + bits(LENGTH_EXTRA[lengthIndex]);
        const distanceIndex = decode(distances);
        const distance = DISTANCE_BASE[distanceIndex] + bits(DISTANCE_EXTRA[distanceIndex]);
        if (distance > length) throw new InflateError('A back reference points before the start');
        room(run);
        for (let index = 0; index < run; index += 1) output[length + index] = output[length - distance + index];
        length += run;
      }
    }
  } while (!last);

  return { data: length === output.length ? output : output.slice(0, length), end: position };
};

/** Inflates a zlib stream: a two byte header, deflate data and a checksum. */
export const inflateZlib = (input, offset = 0, size = 0) => {
  const method = input[offset];
  if ((method & 0x0f) !== 8 || ((method << 8) | input[offset + 1]) % 31 !== 0) throw new InflateError('This is not zlib data');
  const { data, end } = inflateRaw(input, offset + 2, size);
  return { data, end: end + 4 };
};
