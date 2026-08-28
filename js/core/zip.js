const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;

const inflate = async (bytes) => {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
};

export const readZip = async (buffer) => {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  let end = -1;
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 66000); offset -= 1) {
    if (view.getUint32(offset, true) === EOCD) {
      end = offset;
      break;
    }
  }
  if (end < 0) throw new Error('This file is not a zip archive');

  const count = view.getUint16(end + 10, true);
  let cursor = view.getUint32(end + 16, true);
  const entries = new Map();

  for (let index = 0; index < count; index += 1) {
    if (view.getUint32(cursor, true) !== CENTRAL) break;
    const method = view.getUint16(cursor + 10, true);
    const compressed = view.getUint32(cursor + 20, true);
    const size = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const offset = view.getUint32(cursor + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));

    entries.set(name, { name, method, compressed, size, offset });
    cursor += 46 + nameLength + extraLength + commentLength;
  }

  const read = async (name) => {
    const entry = entries.get(name);
    if (!entry) return null;
    if (view.getUint32(entry.offset, true) !== LOCAL) throw new Error(`Damaged entry: ${name}`);
    const nameLength = view.getUint16(entry.offset + 26, true);
    const extraLength = view.getUint16(entry.offset + 28, true);
    const start = entry.offset + 30 + nameLength + extraLength;
    const raw = bytes.subarray(start, start + entry.compressed);
    if (entry.method === 0) return raw;
    if (entry.method === 8) return inflate(raw);
    throw new Error(`Unsupported compression in ${name}`);
  };

  return {
    names: [...entries.keys()],
    has: (name) => entries.has(name),
    bytes: read,
    text: async (name) => {
      const data = await read(name);
      return data ? new TextDecoder().decode(data) : null;
    },
  };
};

const deflate = async (bytes) => {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
};

const CRC = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let value = i;
    for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[i] = value >>> 0;
  }
  return table;
})();

export const crc32 = (bytes) => {
  let value = 0xffffffff;
  for (const byte of bytes) value = CRC[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
};

export const writeZip = async (files) => {
  const encoder = new TextEncoder();
  const parts = [];
  const central = [];
  let at = 0;

  for (const [name, body] of Object.entries(files)) {
    const raw = typeof body === 'string' ? encoder.encode(body) : new Uint8Array(body);
    const packed = raw.length > 64 ? await deflate(raw) : raw;
    const shrunk = packed.length < raw.length;
    const data = shrunk ? packed : raw;
    const method = shrunk ? 8 : 0;
    const label = encoder.encode(name);
    const sum = crc32(raw);

    const local = new Uint8Array(30 + label.length);
    const view = new DataView(local.buffer);
    view.setUint32(0, LOCAL, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 0x0800, true);
    view.setUint16(8, method, true);
    view.setUint32(14, sum, true);
    view.setUint32(18, data.length, true);
    view.setUint32(22, raw.length, true);
    view.setUint16(26, label.length, true);
    local.set(label, 30);
    parts.push(local, data);

    const entry = new Uint8Array(46 + label.length);
    const head = new DataView(entry.buffer);
    head.setUint32(0, CENTRAL, true);
    head.setUint16(4, 20, true);
    head.setUint16(6, 20, true);
    head.setUint16(8, 0x0800, true);
    head.setUint16(10, method, true);
    head.setUint32(16, sum, true);
    head.setUint32(20, data.length, true);
    head.setUint32(24, raw.length, true);
    head.setUint16(28, label.length, true);
    head.setUint32(42, at, true);
    entry.set(label, 46);
    central.push(entry);

    at += local.length + data.length;
  }

  const directory = central.reduce((sum, entry) => sum + entry.length, 0);
  const end = new Uint8Array(22);
  const tail = new DataView(end.buffer);
  tail.setUint32(0, EOCD, true);
  tail.setUint16(8, central.length, true);
  tail.setUint16(10, central.length, true);
  tail.setUint32(12, directory, true);
  tail.setUint32(16, at, true);

  const all = [...parts, ...central, end];
  const size = all.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(size);
  let cursor = 0;
  for (const chunk of all) {
    out.set(chunk, cursor);
    cursor += chunk.length;
  }
  return out;
};
