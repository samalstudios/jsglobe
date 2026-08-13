const SHIFTS = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
];

const TABLE = Uint32Array.from({ length: 64 }, (unused, index) =>
  Math.floor(Math.abs(Math.sin(index + 1)) * 4294967296),
);

const hexWord = (word) =>
  [0, 8, 16, 24].map((shift) => ((word >>> shift) & 255).toString(16).padStart(2, '0')).join('');

export function md5(input) {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input);
  const length = bytes.length;
  const padded = new Uint8Array(((((length + 8) >> 6) << 6) + 64));
  padded.set(bytes);
  padded[length] = 0x80;

  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, (length << 3) >>> 0, true);
  view.setUint32(padded.length - 4, Math.floor(length / 536870912), true);

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  const block = new Uint32Array(16);

  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i += 1) block[i] = view.getUint32(offset + i * 4, true);

    let a = a0;
    let b = b0;
    let c = c0;
    let d = d0;

    for (let i = 0; i < 64; i += 1) {
      let mix;
      let index;
      if (i < 16) {
        mix = (b & c) | (~b & d);
        index = i;
      } else if (i < 32) {
        mix = (d & b) | (~d & c);
        index = (5 * i + 1) % 16;
      } else if (i < 48) {
        mix = b ^ c ^ d;
        index = (3 * i + 5) % 16;
      } else {
        mix = c ^ (b | ~d);
        index = (7 * i) % 16;
      }

      const sum = (mix + a + TABLE[i] + block[index]) | 0;
      a = d;
      d = c;
      c = b;
      b = (b + ((sum << SHIFTS[i]) | (sum >>> (32 - SHIFTS[i])))) | 0;
    }

    a0 = (a0 + a) | 0;
    b0 = (b0 + b) | 0;
    c0 = (c0 + c) | 0;
    d0 = (d0 + d) | 0;
  }

  return [a0, b0, c0, d0].map(hexWord).join('');
}
