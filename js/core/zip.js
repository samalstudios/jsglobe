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
