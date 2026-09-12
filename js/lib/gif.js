// Writing and reading animated GIFs.
//
// A GIF holds at most 256 colours, so every frame is first reduced to one
// shared palette, then each frame's colour numbers are packed with LZW. Only
// the part of a frame that changed is stored, which is most of what keeps a
// GIF small. Reading does all of it backwards, which is also how the writing
// is checked.

// ---- choosing the colours -----------------------------------------------

// colours are counted in boxes five bits wide per channel: fine enough to tell
// colours apart, coarse enough to count a whole video in one pass
const BINS = 32768;
const binOf = (r, g, b) => ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);

/** Whether any pixel in any frame is more than half see-through. */
export const hasTransparency = (frames) =>
  frames.some(({ data }) => {
    for (let at = 3; at < data.length; at += 4) if (data[at] < 128) return true;
    return false;
  });

/**
 * A palette of at most `colours` colours for these frames, by median cut: the
 * box of colours holding the most pixels over the widest spread is split at
 * its middle, again and again, and each box becomes the average of what fell
 * in it.
 */
export const buildPalette = (frames, colours = 256) => {
  const count = new Float64Array(BINS);
  const red = new Float64Array(BINS);
  const green = new Float64Array(BINS);
  const blue = new Float64Array(BINS);

  // a long video is sampled rather than counted in full; the palette barely
  // changes and the wait does
  const total = frames.reduce((sum, frame) => sum + frame.data.length / 4, 0);
  const step = Math.max(1, Math.floor(total / 2_000_000));
  for (const { data } of frames) {
    for (let at = 0; at < data.length; at += 4 * step) {
      if (data[at + 3] < 128) continue;
      const bin = binOf(data[at], data[at + 1], data[at + 2]);
      count[bin] += 1;
      red[bin] += data[at];
      green[bin] += data[at + 1];
      blue[bin] += data[at + 2];
    }
  }

  const filled = [];
  for (let bin = 0; bin < BINS; bin += 1) if (count[bin]) filled.push(bin);
  if (!filled.length) return [[0, 0, 0]];

  const channel = (bin, axis) => (axis === 0 ? bin >> 10 : axis === 1 ? (bin >> 5) & 31 : bin & 31);
  const describe = (bins) => {
    let pixels = 0;
    const low = [31, 31, 31];
    const high = [0, 0, 0];
    for (const bin of bins) {
      pixels += count[bin];
      for (let axis = 0; axis < 3; axis += 1) {
        const value = channel(bin, axis);
        if (value < low[axis]) low[axis] = value;
        if (value > high[axis]) high[axis] = value;
      }
    }
    const spans = [0, 1, 2].map((axis) => high[axis] - low[axis]);
    const axis = spans.indexOf(Math.max(...spans));
    return { bins, pixels, axis, span: spans[axis] };
  };

  const boxes = [describe(filled)];
  while (boxes.length < colours) {
    let pick = -1;
    let best = -1;
    boxes.forEach((box, index) => {
      if (box.span === 0 || box.bins.length < 2) return;
      const score = box.pixels * (box.span + 1);
      if (score > best) {
        best = score;
        pick = index;
      }
    });
    if (pick < 0) break;

    const box = boxes[pick];
    const sorted = box.bins.slice().sort((a, b) => channel(a, box.axis) - channel(b, box.axis));
    // split where half the pixels are on each side, not half the bins
    let seen = 0;
    let cut = 1;
    for (let index = 0; index < sorted.length - 1; index += 1) {
      seen += count[sorted[index]];
      cut = index + 1;
      if (seen >= box.pixels / 2) break;
    }
    boxes.splice(pick, 1, describe(sorted.slice(0, cut)), describe(sorted.slice(cut)));
  }

  return boxes.map(({ bins, pixels }) => {
    let r = 0;
    let g = 0;
    let b = 0;
    for (const bin of bins) {
      r += red[bin];
      g += green[bin];
      b += blue[bin];
    }
    return [Math.round(r / pixels), Math.round(g / pixels), Math.round(b / pixels)];
  });
};

/** Nearest palette entry for a colour, remembered per box of colours so each is only searched for once. */
const matcher = (palette) => {
  const known = new Int16Array(BINS).fill(-1);
  return (r, g, b) => {
    const bin = binOf(r, g, b);
    if (known[bin] >= 0) return known[bin];
    let best = 0;
    let gap = Infinity;
    for (let index = 0; index < palette.length; index += 1) {
      const [pr, pg, pb] = palette[index];
      const distance = (pr - r) ** 2 + (pg - g) ** 2 + (pb - b) ** 2;
      if (distance < gap) {
        gap = distance;
        best = index;
      }
    }
    known[bin] = best;
    return best;
  };
};

/**
 * A frame as palette numbers. With dithering, what each pixel misses by is
 * passed on to its neighbours, so a smooth gradient comes out as a fine
 * speckle rather than bands.
 */
export const mapFrame = (data, width, height, palette, { dither = false, transparent = -1, nearest = matcher(palette) } = {}) => {
  const indices = new Uint8Array(width * height);
  const clamp = (value) => (value < 0 ? 0 : value > 255 ? 255 : value);

  if (!dither) {
    for (let index = 0, at = 0; index < indices.length; index += 1, at += 4) {
      indices[index] = transparent >= 0 && data[at + 3] < 128 ? transparent : nearest(data[at], data[at + 1], data[at + 2]);
    }
    return indices;
  }

  // Floyd and Steinberg's weights: seven sixteenths ahead, the rest below
  let here = new Float32Array((width + 2) * 3);
  let below = new Float32Array((width + 2) * 3);
  for (let y = 0; y < height; y += 1) {
    below.fill(0);
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const at = index * 4;
      if (transparent >= 0 && data[at + 3] < 128) {
        indices[index] = transparent;
        continue;
      }
      const slot = (x + 1) * 3;
      const r = clamp(data[at] + here[slot]);
      const g = clamp(data[at + 1] + here[slot + 1]);
      const b = clamp(data[at + 2] + here[slot + 2]);
      const chosen = nearest(Math.round(r), Math.round(g), Math.round(b));
      indices[index] = chosen;
      const [pr, pg, pb] = palette[chosen];
      const miss = [r - pr, g - pg, b - pb];
      for (let c = 0; c < 3; c += 1) {
        here[slot + 3 + c] += (miss[c] * 7) / 16;
        below[slot - 3 + c] += (miss[c] * 3) / 16;
        below[slot + c] += (miss[c] * 5) / 16;
        below[slot + 3 + c] += miss[c] / 16;
      }
    }
    [here, below] = [below, here];
  }
  return indices;
};

// ---- packing the numbers ------------------------------------------------

const MAX_CODE = 4096;
// the string table as an open hash: 4096 entries in 16384 slots stays quick to
// probe, and is quick to wipe each time the table fills
const SLOTS = 1 << 14;

/** GIF's LZW, least significant bit first, codes growing from the minimum size up to twelve bits. */
export const lzwEncode = (indices, minCodeSize) => {
  const clear = 1 << minCodeSize;
  const end = clear + 1;
  const out = new Writer(Math.max(64, indices.length >> 1));
  let codeSize = minCodeSize + 1;
  let next = end + 1;
  const keys = new Int32Array(SLOTS).fill(-1);
  const codes = new Int16Array(SLOTS);
  const emit = (code) => out.code(code, codeSize);

  emit(clear);
  if (!indices.length) {
    emit(end);
    out.flush();
    return out.bytes();
  }

  let prefix = indices[0];
  for (let index = 1; index < indices.length; index += 1) {
    const value = indices[index];
    const key = (prefix << 8) | value;
    let slot = Math.imul(key, 0x9e3779b1) >>> 18;
    while (keys[slot] !== -1 && keys[slot] !== key) slot = (slot + 1) & (SLOTS - 1);
    if (keys[slot] === key) {
      prefix = codes[slot];
      continue;
    }
    emit(prefix);
    if (next < MAX_CODE) {
      keys[slot] = key;
      codes[slot] = next;
      next += 1;
      // The reader grows its codes one entry behind this side, so this side
      // grows once the entry after the power of two has been handed out.
      if (next > 1 << codeSize && codeSize < 12) codeSize += 1;
    } else {
      emit(clear);
      keys.fill(-1);
      codeSize = minCodeSize + 1;
      next = end + 1;
    }
    prefix = value;
  }
  emit(prefix);
  emit(end);
  out.flush();
  return out.bytes();
};

export const lzwDecode = (data, minCodeSize, pixels) => {
  const clear = 1 << minCodeSize;
  const end = clear + 1;
  const out = new Uint8Array(pixels);
  const prefix = new Int16Array(MAX_CODE);
  const suffix = new Uint8Array(MAX_CODE);
  const first = new Uint8Array(MAX_CODE);
  const stack = new Uint8Array(MAX_CODE + 1);
  for (let code = 0; code < clear; code += 1) {
    prefix[code] = -1;
    suffix[code] = code;
    first[code] = code;
  }

  let codeSize = minCodeSize + 1;
  let next = end + 1;
  let previous = -1;
  let written = 0;
  let buffer = 0;
  let bits = 0;
  let at = 0;

  while (written < pixels) {
    while (bits < codeSize) {
      if (at >= data.length) return out;
      buffer |= data[at++] << bits;
      bits += 8;
    }
    const code = buffer & ((1 << codeSize) - 1);
    buffer >>>= codeSize;
    bits -= codeSize;

    if (code === clear) {
      codeSize = minCodeSize + 1;
      next = end + 1;
      previous = -1;
      continue;
    }
    if (code === end) break;

    if (previous < 0) {
      out[written++] = suffix[code];
      previous = code;
      continue;
    }

    let top = 0;
    let walk = code;
    // a code not yet in the table can only be the previous string plus its own first letter
    if (code >= next) {
      stack[top++] = first[previous];
      walk = previous;
    }
    while (walk >= clear) {
      stack[top++] = suffix[walk];
      walk = prefix[walk];
    }
    stack[top++] = walk;
    while (top > 0 && written < pixels) out[written++] = stack[--top];

    if (next < MAX_CODE) {
      prefix[next] = previous;
      suffix[next] = walk;
      first[next] = first[previous];
      next += 1;
      if (next === 1 << codeSize && codeSize < 12) codeSize += 1;
    }
    previous = code;
  }
  return out;
};

class Writer {
  constructor(size = 1024) {
    this.buffer = new Uint8Array(size);
    this.length = 0;
    // codes narrower than a byte wait here until there are eight bits to write
    this.pending = 0;
    this.pendingBits = 0;
  }

  code(value, size) {
    this.pending |= value << this.pendingBits;
    this.pendingBits += size;
    while (this.pendingBits >= 8) {
      this.byte(this.pending & 255);
      this.pending >>>= 8;
      this.pendingBits -= 8;
    }
  }

  flush() {
    if (this.pendingBits > 0) this.byte(this.pending & 255);
    this.pending = 0;
    this.pendingBits = 0;
  }

  room(extra) {
    if (this.length + extra <= this.buffer.length) return;
    const grown = new Uint8Array(Math.max(this.buffer.length * 2, this.length + extra));
    grown.set(this.buffer.subarray(0, this.length));
    this.buffer = grown;
  }

  byte(value) {
    this.room(1);
    this.buffer[this.length++] = value;
  }

  word(value) {
    this.byte(value & 255);
    this.byte((value >> 8) & 255);
  }

  text(value) {
    for (const char of value) this.byte(char.charCodeAt(0));
  }

  all(values) {
    this.room(values.length);
    this.buffer.set(values, this.length);
    this.length += values.length;
  }

  bytes() {
    return this.buffer.slice(0, this.length);
  }
}

// ---- the file -----------------------------------------------------------

/** A browser shows any delay under two hundredths of a second as a tenth, so none is written shorter. */
export const delayInHundredths = (milliseconds) => Math.min(65535, Math.max(2, Math.round((milliseconds ?? 100) / 10)));

/**
 * Write an animated GIF.
 *
 * frames:  [{ data: RGBA pixels, width by height, delay: milliseconds }]
 * repeat:  0 plays for ever, 1 plays once, and n plays n times
 * colours: how many colours the palette may hold, 2 to 256
 * dither:  spread each pixel's error to its neighbours
 * optimise: store only what changed from one frame to the next
 */
export const encodeGif = (frames, width, height, options = {}) => {
  if (!frames.length) throw new Error('A GIF needs at least one frame');
  const { repeat = 0, dither = false, optimise = true, onProgress } = options;
  const colours = Math.min(256, Math.max(2, Math.round(options.colours ?? 256)));

  // Transparency in the pictures, or storing only the changes, both need one
  // palette entry kept aside to mean "nothing here". A picture with holes in
  // it cannot also be stored as changes: a hole would show the frame before.
  const clear = hasTransparency(frames);
  const changesOnly = optimise && !clear && frames.length > 1;
  const reserve = clear || changesOnly;
  const palette = buildPalette(frames, reserve ? Math.min(colours, 255) : colours);
  const transparent = reserve ? palette.length : -1;
  if (reserve) palette.push([0, 0, 0]);

  let tableBits = 1;
  while (1 << tableBits < palette.length) tableBits += 1;
  const minCodeSize = Math.max(2, tableBits);

  const nearest = matcher(palette.slice(0, reserve ? -1 : undefined));
  const stored = [];
  let shown = null;

  frames.forEach((frame, number) => {
    const indices = mapFrame(frame.data, width, height, palette, { dither, transparent, nearest });
    const delay = delayInHundredths(frame.delay);

    if (!changesOnly || !shown) {
      stored.push({ left: 0, top: 0, wide: width, tall: height, indices, delay, disposal: clear ? 2 : 1 });
      // a copy: what is on screen changes with every frame, the stored frame must not
      shown = indices.slice();
    } else {
      let left = width;
      let top = height;
      let right = -1;
      let bottom = -1;
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          if (indices[y * width + x] === shown[y * width + x]) continue;
          if (x < left) left = x;
          if (x > right) right = x;
          if (y < top) top = y;
          if (y > bottom) bottom = y;
        }
      }
      if (right < 0) {
        // nothing moved, so the frame before simply stays up longer
        const last = stored[stored.length - 1];
        last.delay = Math.min(65535, last.delay + delay);
      } else {
        const wide = right - left + 1;
        const tall = bottom - top + 1;
        const part = new Uint8Array(wide * tall);
        for (let y = 0; y < tall; y += 1) {
          for (let x = 0; x < wide; x += 1) {
            const at = (top + y) * width + left + x;
            const value = indices[at];
            part[y * wide + x] = value === shown[at] ? transparent : value;
            shown[at] = value;
          }
        }
        stored.push({ left, top, wide, tall, indices: part, delay, disposal: 1 });
      }
    }
    onProgress?.((number + 1) / frames.length);
  });

  const out = new Writer(1 << 16);
  out.text('GIF89a');
  out.word(width);
  out.word(height);
  // a global colour table follows, eight bits a channel, of 2^tableBits entries
  out.byte(0x80 | (7 << 4) | (tableBits - 1));
  out.byte(0);
  out.byte(0);
  for (let index = 0; index < 1 << tableBits; index += 1) {
    const [r, g, b] = palette[index] ?? [0, 0, 0];
    out.byte(r);
    out.byte(g);
    out.byte(b);
  }

  // Without this block a GIF plays once. With it, browsers play the count
  // written plus one, so n plays is written as n - 1, and 0 means for ever.
  if (repeat !== 1 && stored.length > 1) {
    out.byte(0x21);
    out.byte(0xff);
    out.byte(11);
    out.text('NETSCAPE2.0');
    out.byte(3);
    out.byte(1);
    out.word(repeat === 0 ? 0 : Math.min(65535, repeat - 1));
    out.byte(0);
  }

  for (const frame of stored) {
    out.byte(0x21);
    out.byte(0xf9);
    out.byte(4);
    out.byte((frame.disposal << 2) | (reserve ? 1 : 0));
    out.word(frame.delay);
    out.byte(reserve ? transparent : 0);
    out.byte(0);

    out.byte(0x2c);
    out.word(frame.left);
    out.word(frame.top);
    out.word(frame.wide);
    out.word(frame.tall);
    out.byte(0);

    out.byte(minCodeSize);
    const packed = lzwEncode(frame.indices, minCodeSize);
    for (let at = 0; at < packed.length; at += 255) {
      const piece = packed.subarray(at, at + 255);
      out.byte(piece.length);
      out.all(piece);
    }
    out.byte(0);
  }

  out.byte(0x3b);
  return out.bytes();
};

// ---- reading one --------------------------------------------------------

// The place in the file is kept on an object. Kept instead in a variable that
// several small functions move along, it was misread by V8's Maglev compiler
// partway through a long file, and the same bytes read fine a second time.
class Reader {
  constructor(data, at = 0) {
    this.data = data;
    this.at = at;
  }

  more() {
    return this.at < this.data.length;
  }

  byte() {
    return this.data[this.at++] ?? 0;
  }

  skip(count) {
    this.at += count;
  }

  word() {
    const value = this.data[this.at] | (this.data[this.at + 1] << 8);
    this.at += 2;
    return value;
  }

  table(size) {
    const colours = [];
    for (let index = 0; index < size; index += 1) {
      const at = this.at + index * 3;
      colours.push([this.data[at], this.data[at + 1], this.data[at + 2]]);
    }
    this.at += size * 3;
    return colours;
  }

  /** The sub-blocks that follow, joined, up to and past the empty one that ends them. */
  blocks() {
    const { data } = this;
    let total = 0;
    let at = this.at;
    while (at < data.length && data[at]) {
      total += data[at];
      at += data[at] + 1;
    }
    const joined = new Uint8Array(total);
    let offset = 0;
    at = this.at;
    while (at < data.length && data[at]) {
      const piece = data.subarray(at + 1, at + 1 + data[at]);
      joined.set(piece, offset);
      offset += piece.length;
      at += data[at] + 1;
    }
    this.at = at + 1;
    return joined;
  }
}

/**
 * Read a GIF into whole frames, each the full picture as it looks at that
 * moment, with the disposal of the frame before already applied.
 */
export const decodeGif = (bytes) => {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const signature = String.fromCharCode(...data.subarray(0, 6));
  if (signature !== 'GIF87a' && signature !== 'GIF89a') throw new Error('That is not a GIF');

  const read = new Reader(data, 6);
  const width = read.word();
  const height = read.word();
  const flags = read.byte();
  read.skip(2);
  const global = flags & 0x80 ? read.table(2 << (flags & 7)) : null;

  const canvas = new Uint8ClampedArray(width * height * 4);
  const frames = [];
  let repeat = 1;
  let control = { disposal: 0, transparent: -1, delay: 0 };
  let dispose = null;

  while (read.more()) {
    const block = read.byte();
    if (block === 0x3b) break;

    if (block === 0x21) {
      const label = read.byte();
      if (label === 0xf9) {
        const body = read.blocks();
        control = {
          disposal: (body[0] >> 2) & 7,
          transparent: body[0] & 1 ? body[3] : -1,
          delay: (body[1] | (body[2] << 8)) * 10,
        };
      } else if (label === 0xff) {
        const body = read.blocks();
        const name = String.fromCharCode(...body.subarray(0, 11));
        if (name === 'NETSCAPE2.0' && body.length >= 14 && body[11] === 1) {
          const count = body[12] | (body[13] << 8);
          repeat = count === 0 ? 0 : count + 1;
        }
      } else {
        read.blocks();
      }
      continue;
    }

    if (block !== 0x2c) throw new Error('That GIF is damaged');

    const left = read.word();
    const top = read.word();
    const wide = read.word();
    const tall = read.word();
    const local = read.byte();
    const colours = local & 0x80 ? read.table(2 << (local & 7)) : global;
    const interlaced = Boolean(local & 0x40);
    const minCodeSize = read.byte();
    let indices = lzwDecode(read.blocks(), minCodeSize, wide * tall);

    if (interlaced) {
      const rows = new Uint8Array(indices.length);
      let row = 0;
      for (const [start, stride] of [[0, 8], [4, 8], [2, 4], [1, 2]]) {
        for (let y = start; y < tall; y += stride) {
          rows.set(indices.subarray(row * wide, (row + 1) * wide), y * wide);
          row += 1;
        }
      }
      indices = rows;
    }

    // what the frame before asked to have done to it before this one
    if (dispose?.disposal === 2) {
      for (let y = dispose.top; y < dispose.top + dispose.tall && y < height; y += 1) {
        canvas.fill(0, (y * width + dispose.left) * 4, (y * width + Math.min(width, dispose.left + dispose.wide)) * 4);
      }
    } else if (dispose?.disposal === 3 && dispose.saved) {
      canvas.set(dispose.saved);
    }
    const saved = control.disposal === 3 ? canvas.slice() : null;

    for (let y = 0; y < tall; y += 1) {
      const cy = top + y;
      if (cy >= height) break;
      for (let x = 0; x < wide; x += 1) {
        const cx = left + x;
        if (cx >= width) break;
        const value = indices[y * wide + x];
        if (value === control.transparent) continue;
        const colour = colours?.[value] ?? [0, 0, 0];
        const out = (cy * width + cx) * 4;
        canvas[out] = colour[0];
        canvas[out + 1] = colour[1];
        canvas[out + 2] = colour[2];
        canvas[out + 3] = 255;
      }
    }

    frames.push({ data: canvas.slice(), delay: control.delay });
    dispose = { ...control, left, top, wide, tall, saved };
    control = { disposal: 0, transparent: -1, delay: 0 };
  }

  return { width, height, repeat, frames };
};
