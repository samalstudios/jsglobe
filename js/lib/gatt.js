// The Bluetooth GATT vocabulary: turning the numbers a device reports into the
// names and readings the specification gives them.
//
// Everything here is plain data and arithmetic, so it can be checked without a
// radio. Talking to a device is the app's business, not this file's.

// The Bluetooth base: every 16 and 32 bit identifier is shorthand for a full
// UUID that ends this way
export const BASE_SUFFIX = '-0000-1000-8000-00805f9b34fb';

export const SERVICE_NAMES = {
  '1800': 'Generic access',
  '1801': 'Generic attribute',
  '1802': 'Immediate alert',
  '1803': 'Link loss',
  '1804': 'Tx power',
  '180a': 'Device information',
  '180d': 'Heart rate',
  '180e': 'Phone alert status',
  '180f': 'Battery',
  '1810': 'Blood pressure',
  '1812': 'Human interface device',
  '1814': 'Running speed and cadence',
  '1816': 'Cycling speed and cadence',
  '1818': 'Cycling power',
  '181a': 'Environmental sensing',
  '181b': 'Body composition',
  '181c': 'User data',
  '181d': 'Weight scale',
  '181e': 'Bond management',
  '1822': 'Pulse oximeter',
  '1826': 'Fitness machine',
  '1827': 'Mesh provisioning',
  '183a': 'Audio input control',
  '1843': 'Audio stream control',
  'fe59': 'Nordic DFU',
};

export const CHARACTERISTIC_NAMES = {
  '2a00': 'Device name',
  '2a01': 'Appearance',
  '2a04': 'Connection parameters',
  '2a05': 'Service changed',
  '2a19': 'Battery level',
  '2a1c': 'Temperature measurement',
  '2a1e': 'Intermediate temperature',
  '2a23': 'System ID',
  '2a24': 'Model number',
  '2a25': 'Serial number',
  '2a26': 'Firmware revision',
  '2a27': 'Hardware revision',
  '2a28': 'Software revision',
  '2a29': 'Manufacturer name',
  '2a2b': 'Current time',
  '2a37': 'Heart rate measurement',
  '2a38': 'Body sensor location',
  '2a39': 'Heart rate control point',
  '2a3f': 'Alert status',
  '2a50': 'PnP ID',
  '2a5b': 'Speed and cadence',
  '2a63': 'Cycling power measurement',
  '2a6d': 'Pressure',
  '2a6e': 'Temperature',
  '2a6f': 'Humidity',
  '2a76': 'UV index',
  '2a77': 'Irradiance',
  '2a7e': 'Wind speed',
  '2a98': 'Weight',
  '2a9d': 'Weight measurement',
  '2aa1': 'Magnetic flux',
  '2ab3': 'Altitude',
};

export const DESCRIPTOR_NAMES = {
  '2900': 'Extended properties',
  '2901': 'Description',
  '2902': 'Client configuration',
  '2903': 'Server configuration',
  '2904': 'Presentation format',
  '2905': 'Aggregate format',
  '2906': 'Valid range',
};

// the description a device writes about one of its own characteristics, which
// is the only name a vendor characteristic usually has
export const USER_DESCRIPTION = `00002901${BASE_SUFFIX}`;

// full UUIDs that are widely used but are nobody's 16 bit shorthand
export const VENDOR_NAMES = {
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e': 'Nordic UART',
  '6e400002-b5a3-f393-e0a9-e50e24dcca9e': 'Nordic UART write',
  '6e400003-b5a3-f393-e0a9-e50e24dcca9e': 'Nordic UART notify',
  '0000fe59-0000-1000-8000-00805f9b34fb': 'Nordic DFU',
  '8ec90001-f315-4f60-9fb8-838830daea50': 'Nordic DFU buttonless',
  'adaf0100-4669-6f77-6862-69742e696f74': 'Adafruit sensor',
};

// what a proper UUID looks like, so a typed one can be rejected before it is
// handed to the browser
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const isUuid = (value) => UUID_PATTERN.test(String(value ?? '').trim().toLowerCase());

// the shorthand a specification writes, expanded to what the radio uses. Takes
// 180f, 0x180f, 0000180f or the full thing
export const fullUuid = (value) => {
  const text = String(value ?? '').trim().toLowerCase().replace(/^0x/, '');
  if (isUuid(text)) return text;
  if (/^[0-9a-f]{1,8}$/.test(text)) return `${text.padStart(8, '0')}${BASE_SUFFIX}`;
  return null;
};

// a full UUID is only shorthand for a 16 bit one when everything after the
// first block is the Bluetooth base and the first four digits are zero
export const isAssigned = (uuid) => {
  const text = String(uuid ?? '').toLowerCase();
  return isUuid(text) && text.endsWith(BASE_SUFFIX) && text.startsWith('0000');
};

export const assignedNumber = (uuid) => (isAssigned(uuid) ? String(uuid).toLowerCase().slice(4, 8) : null);

// what to put on screen: the four digits a specification would quote, or the
// whole thing when there is nothing shorter to say
export const shortUuid = (uuid) => {
  const number = assignedNumber(uuid);
  return number ? `0x${number.toUpperCase()}` : String(uuid ?? '').toLowerCase();
};

export const nameFor = (uuid, kind = 'service') => {
  const text = String(uuid ?? '').toLowerCase();
  if (VENDOR_NAMES[text]) return VENDOR_NAMES[text];
  const number = assignedNumber(text);
  if (!number) return null;
  const table =
    kind === 'characteristic' ? CHARACTERISTIC_NAMES : kind === 'descriptor' ? DESCRIPTOR_NAMES : SERVICE_NAMES;
  return table[number] ?? null;
};

export const PROPERTY_FLAGS = [
  'read',
  'write',
  'writeWithoutResponse',
  'notify',
  'indicate',
  'broadcast',
  'authenticatedSignedWrites',
];

export const propertiesOf = (properties = {}) => PROPERTY_FLAGS.filter((flag) => properties[flag]);

export const toBytes = (view) =>
  view instanceof DataView ? new Uint8Array(view.buffer, view.byteOffset, view.byteLength) : new Uint8Array(view ?? []);

export const toHex = (view) =>
  [...toBytes(view)].map((byte) => byte.toString(16).padStart(2, '0')).join(' ');

const printable = (bytes) => {
  const text = new TextDecoder().decode(bytes).replace(/\0+$/, '');
  return text.trim() && /^[\x20-\x7e\s]+$/.test(text) ? text : null;
};

// the readings the specification defines, each with the unit it is quoted in
const READINGS = {
  '2a19': (view) => ({ value: view.getUint8(0), unit: '%' }),
  '2a6e': (view) => ({ value: view.getInt16(0, true) / 100, unit: '°C' }),
  '2a6f': (view) => ({ value: view.getUint16(0, true) / 100, unit: '% RH' }),
  '2a6d': (view) => ({ value: view.getUint32(0, true) / 10, unit: 'Pa' }),
  '2a7e': (view) => ({ value: view.getUint16(0, true) / 100, unit: 'm/s' }),
  '2a76': (view) => ({ value: view.getUint8(0), unit: 'UV index' }),
  '2ab3': (view) => ({ value: view.getUint16(0, true), unit: 'm' }),
  // the first bit says whether the rate that follows is one byte or two
  '2a37': (view) => {
    if (view.byteLength < 2) return null;
    const wide = view.getUint8(0) & 1;
    return { value: wide ? view.getUint16(1, true) : view.getUint8(1), unit: 'bpm' };
  },
  '2a38': (view) => {
    const places = ['Other', 'Chest', 'Wrist', 'Finger', 'Hand', 'Ear lobe', 'Foot'];
    return { value: places[view.getUint8(0)] ?? `Location ${view.getUint8(0)}`, unit: '' };
  },
  '2a01': (view) => (view.byteLength >= 2 ? { value: view.getUint16(0, true), unit: 'appearance' } : null),
};

const TEXT_CHARACTERISTICS = new Set(['2a00', '2a24', '2a25', '2a26', '2a27', '2a28', '2a29']);

// a reading in the units the specification gives it, or the text the device
// wrote, or nothing at all when the bytes only speak for themselves
export const decodeValue = (uuid, view) => {
  if (!view || !view.byteLength) return null;
  const number = assignedNumber(uuid);
  const bytes = toBytes(view);

  if (number && TEXT_CHARACTERISTICS.has(number)) {
    const text = printable(bytes);
    if (text) return { text, kind: 'text' };
  }

  const reading = READINGS[number];
  if (reading) {
    try {
      const out = reading(view);
      if (out) {
        const value = typeof out.value === 'number' ? Number(out.value.toFixed(2)) : out.value;
        return { text: out.unit ? `${value} ${out.unit}`.trim() : String(value), kind: 'reading' };
      }
    } catch {
      /* the device sent fewer bytes than the specification promises */
    }
  }

  const text = printable(bytes);
  return text ? { text, kind: 'text' } : null;
};

// what someone typed in the write box, as the bytes to put on the wire
export const parsePayload = (raw, format = 'hex') => {
  const text = String(raw ?? '').trim();
  if (!text) return new Uint8Array();
  if (format !== 'hex') return new TextEncoder().encode(text);
  const digits = text.replace(/[^0-9a-f]/gi, '');
  const pairs = digits.match(/../g) ?? [];
  return Uint8Array.from(pairs.map((pair) => parseInt(pair, 16)));
};

// the whole table as text, for keeping or pasting into a bug report
export const tableToText = (device, services) => {
  const lines = [`${device?.name || 'Unnamed device'}${device?.id ? `  (${device.id})` : ''}`, ''];
  for (const service of services ?? []) {
    lines.push(`${service.name ?? 'Service'}  ${shortUuid(service.uuid)}`);
    for (const characteristic of service.characteristics ?? []) {
      const flags = (characteristic.properties ?? []).join(', ');
      lines.push(`  ${characteristic.name ?? 'Characteristic'}  ${shortUuid(characteristic.uuid)}  [${flags}]`);
      if (characteristic.value) lines.push(`    ${characteristic.value}`);
    }
    lines.push('');
  }
  return lines.join('\n').trimEnd();
};
