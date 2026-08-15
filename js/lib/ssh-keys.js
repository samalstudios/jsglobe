import { md5 } from './md5.js';

const encoder = new TextEncoder();

const fromBase64Url = (value) => {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

const toBase64 = (bytes) => btoa(String.fromCharCode(...bytes));

const concat = (parts) => {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  parts.forEach((part) => {
    out.set(part, offset);
    offset += part.length;
  });
  return out;
};

const uint32 = (value) => new Uint8Array([(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255]);

const sshString = (value) => {
  const bytes = typeof value === 'string' ? encoder.encode(value) : value;
  return concat([uint32(bytes.length), bytes]);
};

const mpint = (bytes) => {
  let start = 0;
  while (start < bytes.length - 1 && bytes[start] === 0) start += 1;
  const trimmed = bytes.subarray(start);
  return sshString(trimmed[0] & 0x80 ? concat([new Uint8Array([0]), trimmed]) : trimmed);
};

export const CURVES = {
  'P-256': { name: 'nistp256', type: 'ecdsa-sha2-nistp256', bits: 256 },
  'P-384': { name: 'nistp384', type: 'ecdsa-sha2-nistp384', bits: 384 },
  'P-521': { name: 'nistp521', type: 'ecdsa-sha2-nistp521', bits: 521 },
};

const publicBlob = (jwk) => {
  if (jwk.kty === 'OKP') {
    return concat([sshString('ssh-ed25519'), sshString(fromBase64Url(jwk.x))]);
  }
  if (jwk.kty === 'EC') {
    const curve = CURVES[jwk.crv];
    const point = concat([new Uint8Array([4]), fromBase64Url(jwk.x), fromBase64Url(jwk.y)]);
    return concat([sshString(curve.type), sshString(curve.name), sshString(point)]);
  }
  return concat([sshString('ssh-rsa'), mpint(fromBase64Url(jwk.e)), mpint(fromBase64Url(jwk.n))]);
};

const privateBlob = (jwk) => {
  if (jwk.kty === 'OKP') {
    const seed = fromBase64Url(jwk.d);
    const pub = fromBase64Url(jwk.x);
    return concat([sshString('ssh-ed25519'), sshString(pub), sshString(concat([seed, pub]))]);
  }
  if (jwk.kty === 'EC') {
    const curve = CURVES[jwk.crv];
    const point = concat([new Uint8Array([4]), fromBase64Url(jwk.x), fromBase64Url(jwk.y)]);
    return concat([sshString(curve.type), sshString(curve.name), sshString(point), mpint(fromBase64Url(jwk.d))]);
  }
  return concat([
    sshString('ssh-rsa'),
    mpint(fromBase64Url(jwk.n)),
    mpint(fromBase64Url(jwk.e)),
    mpint(fromBase64Url(jwk.d)),
    mpint(fromBase64Url(jwk.qi)),
    mpint(fromBase64Url(jwk.p)),
    mpint(fromBase64Url(jwk.q)),
  ]);
};

export const keyType = (jwk) => {
  if (jwk.kty === 'OKP') return 'ssh-ed25519';
  if (jwk.kty === 'EC') return CURVES[jwk.crv].type;
  return 'ssh-rsa';
};

export const keyBits = (jwk) => {
  if (jwk.kty === 'OKP') return 256;
  if (jwk.kty === 'EC') return CURVES[jwk.crv].bits;
  return fromBase64Url(jwk.n).length * 8;
};

export const publicLine = (jwk, comment = '') =>
  `${keyType(jwk)} ${toBase64(publicBlob(jwk))}${comment ? ` ${comment}` : ''}`;

export const openSshPrivate = (jwk, comment = '') => {
  const pub = publicBlob(jwk);
  const check = crypto.getRandomValues(new Uint8Array(4));
  const body = concat([check, check, privateBlob(jwk), sshString(comment)]);
  const blockSize = 8;
  const padding = new Uint8Array((blockSize - (body.length % blockSize)) % blockSize);
  padding.forEach((value, index) => {
    padding[index] = index + 1;
  });

  const container = concat([
    encoder.encode('openssh-key-v1\0'),
    sshString('none'),
    sshString('none'),
    sshString(''),
    uint32(1),
    sshString(pub),
    sshString(concat([body, padding])),
  ]);

  const encoded = toBase64(container).replace(/(.{70})/g, '$1\n');
  return `-----BEGIN OPENSSH PRIVATE KEY-----\n${encoded}${encoded.endsWith('\n') ? '' : '\n'}-----END OPENSSH PRIVATE KEY-----\n`;
};

export const fingerprints = async (blob) => {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', blob));
  const legacy = md5(blob);
  return {
    sha256: `SHA256:${toBase64(digest).replace(/=+$/, '')}`,
    md5: `MD5:${(legacy.match(/../g) ?? []).join(':')}`,
    bytes: [...digest].map((byte) => byte.toString(16).padStart(2, '0')).join(''),
  };
};

const FIELD_WIDTH = 17;
const FIELD_HEIGHT = 9;
const SYMBOLS = ' .o+=*BOX@%&#/^SE';

export const randomart = (hex, header = '') => {
  const bytes = Uint8Array.from((hex.match(/../g) ?? []).map((pair) => parseInt(pair, 16)));
  const field = Array.from({ length: FIELD_HEIGHT }, () => new Array(FIELD_WIDTH).fill(0));
  let x = Math.floor(FIELD_WIDTH / 2);
  let y = Math.floor(FIELD_HEIGHT / 2);

  bytes.forEach((byte) => {
    for (let step = 0; step < 4; step += 1) {
      const move = (byte >> (step * 2)) & 3;
      x += move & 1 ? 1 : -1;
      y += move & 2 ? 1 : -1;
      x = Math.max(0, Math.min(FIELD_WIDTH - 1, x));
      y = Math.max(0, Math.min(FIELD_HEIGHT - 1, y));
      if (field[y][x] < SYMBOLS.length - 2) field[y][x] += 1;
    }
  });

  field[Math.floor(FIELD_HEIGHT / 2)][Math.floor(FIELD_WIDTH / 2)] = SYMBOLS.length - 2;
  field[y][x] = SYMBOLS.length - 1;

  const cap = (text) => {
    if (!text) return `+${'-'.repeat(FIELD_WIDTH)}+`;
    const label = `[${text}]`;
    const left = Math.floor((FIELD_WIDTH - label.length) / 2);
    return `+${'-'.repeat(Math.max(0, left))}${label}${'-'.repeat(Math.max(0, FIELD_WIDTH - left - label.length))}+`;
  };

  return [
    cap(header),
    ...field.map((row) => `|${row.map((level) => SYMBOLS[Math.min(level, SYMBOLS.length - 1)]).join('')}|`),
    cap('SHA256'),
  ].join('\n');
};

export const generate = async (kind) => {
  const algorithms = {
    ed25519: { name: 'Ed25519' },
    'ecdsa-256': { name: 'ECDSA', namedCurve: 'P-256' },
    'ecdsa-384': { name: 'ECDSA', namedCurve: 'P-384' },
    'ecdsa-521': { name: 'ECDSA', namedCurve: 'P-521' },
    'rsa-2048': { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    'rsa-3072': { name: 'RSASSA-PKCS1-v1_5', modulusLength: 3072, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    'rsa-4096': { name: 'RSASSA-PKCS1-v1_5', modulusLength: 4096, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
  };
  const algorithm = algorithms[kind] ?? algorithms.ed25519;
  const pair = await crypto.subtle.generateKey(algorithm, true, ['sign', 'verify']);
  return crypto.subtle.exportKey('jwk', pair.privateKey);
};

export const describe = async (jwk, comment) => {
  const blob = publicBlob(jwk);
  const marks = await fingerprints(blob);
  return {
    type: keyType(jwk),
    bits: keyBits(jwk),
    publicKey: publicLine(jwk, comment),
    privateKey: openSshPrivate(jwk, comment),
    sha256: marks.sha256,
    md5: marks.md5,
    art: randomart(marks.bytes, `${keyType(jwk) === 'ssh-ed25519' ? 'ED25519' : keyType(jwk).replace('ssh-', '').toUpperCase()} ${keyBits(jwk)}`),
  };
};

const readString = (view, offset) => {
  const length = view.getUint32(offset.value);
  offset.value += 4;
  const bytes = new Uint8Array(view.buffer, view.byteOffset + offset.value, length);
  offset.value += length;
  return bytes;
};

export const inspect = async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const parts = trimmed.split(/\s+/);
  const index = parts.findIndex((part) => /^(ssh-(rsa|ed25519|dss)|ecdsa-sha2-nistp\d+|sk-)/.test(part));
  if (index < 0) throw new Error('No SSH public key found on this line');

  const type = parts[index];
  const body = parts[index + 1];
  if (!body) throw new Error('The key is missing its base64 body');

  let blob;
  try {
    blob = Uint8Array.from(atob(body), (character) => character.charCodeAt(0));
  } catch {
    throw new Error('The base64 body could not be decoded');
  }

  const view = new DataView(blob.buffer, blob.byteOffset, blob.byteLength);
  const cursor = { value: 0 };

  let declared;
  let bits = 0;
  try {
    declared = new TextDecoder().decode(readString(view, cursor));
    if (declared === 'ssh-ed25519') bits = 256;
    else if (declared.startsWith('ecdsa-sha2-')) bits = Number(declared.replace('ecdsa-sha2-nistp', ''));
    else if (declared === 'ssh-rsa') {
      readString(view, cursor);
      const modulus = readString(view, cursor);
      bits = (modulus[0] === 0 ? modulus.length - 1 : modulus.length) * 8;
    }
  } catch {
    throw new Error('The key body is truncated or not an SSH key');
  }
  if (declared !== type) throw new Error(`The line says ${type} but the key is ${declared}`);

  const marks = await fingerprints(blob);
  return {
    type: declared,
    bits,
    options: index > 0 ? parts.slice(0, index).join(' ') : '',
    comment: parts.slice(index + 2).join(' '),
    sha256: marks.sha256,
    md5: marks.md5,
    art: randomart(marks.bytes, `${declared === 'ssh-ed25519' ? 'ED25519' : declared.startsWith('ecdsa') ? 'ECDSA' : declared.replace('ssh-', '').toUpperCase()} ${bits}`),
  };
};
