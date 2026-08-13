import { JGApp, define, html, css } from '../core/app.js';
import { debounce, copyText } from '../core/util.js';

const sheet = css`
  .split { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; flex: 1; min-height: 0; }
  @media (max-width: 900px) { .split { grid-template-columns: 1fr; } }
  .pane { display: flex; flex-direction: column; gap: 8px; min-width: 0; min-height: 0; overflow: auto; scrollbar-width: thin; }
  .chips { display: flex; flex-wrap: wrap; gap: 5px; }
  .names { display: grid; gap: 3px; font-family: var(--font-mono); font-size: 12px; }
  .life { height: 8px; border-radius: 999px; background: var(--muted); overflow: hidden; }
  .life i { display: block; height: 100%; background: var(--ring); }
`;

const OIDS = {
  '2.5.4.3': 'CN', '2.5.4.6': 'C', '2.5.4.7': 'L', '2.5.4.8': 'ST', '2.5.4.10': 'O',
  '2.5.4.11': 'OU', '2.5.4.5': 'serialNumber', '2.5.4.4': 'SN', '2.5.4.42': 'GN',
  '1.2.840.113549.1.9.1': 'email', '2.5.4.15': 'businessCategory', '2.5.4.17': 'postalCode',
  '2.5.4.9': 'street', '1.3.6.1.4.1.311.60.2.1.3': 'jurisdictionC',
};

const SIGNATURES = {
  '1.2.840.113549.1.1.5': 'SHA-1 with RSA',
  '1.2.840.113549.1.1.11': 'SHA-256 with RSA',
  '1.2.840.113549.1.1.12': 'SHA-384 with RSA',
  '1.2.840.113549.1.1.13': 'SHA-512 with RSA',
  '1.2.840.113549.1.1.10': 'RSASSA-PSS',
  '1.2.840.10045.4.3.2': 'ECDSA with SHA-256',
  '1.2.840.10045.4.3.3': 'ECDSA with SHA-384',
  '1.2.840.10045.4.3.4': 'ECDSA with SHA-512',
  '1.3.101.112': 'Ed25519',
};

const KEY_TYPES = {
  '1.2.840.113549.1.1.1': 'RSA',
  '1.2.840.10045.2.1': 'Elliptic curve',
  '1.3.101.112': 'Ed25519',
  '1.2.840.113549.1.1.10': 'RSA-PSS',
};

const CURVES = {
  '1.2.840.10045.3.1.7': 'P-256 (prime256v1)',
  '1.3.132.0.34': 'P-384 (secp384r1)',
  '1.3.132.0.35': 'P-521 (secp521r1)',
  '1.3.132.0.10': 'secp256k1',
};

const EXT_NAMES = {
  '2.5.29.14': 'Subject key identifier',
  '2.5.29.15': 'Key usage',
  '2.5.29.17': 'Subject alternative names',
  '2.5.29.19': 'Basic constraints',
  '2.5.29.31': 'CRL distribution points',
  '2.5.29.32': 'Certificate policies',
  '2.5.29.35': 'Authority key identifier',
  '2.5.29.37': 'Extended key usage',
  '1.3.6.1.5.5.7.1.1': 'Authority information access',
  '1.3.6.1.4.1.11129.2.4.2': 'Certificate transparency',
};

const EXT_KEY_USAGE = {
  '1.3.6.1.5.5.7.3.1': 'TLS server',
  '1.3.6.1.5.5.7.3.2': 'TLS client',
  '1.3.6.1.5.5.7.3.3': 'Code signing',
  '1.3.6.1.5.5.7.3.4': 'Email protection',
  '1.3.6.1.5.5.7.3.8': 'Time stamping',
  '1.3.6.1.5.5.7.3.9': 'OCSP signing',
};

const KEY_USAGE_BITS = [
  'Digital signature', 'Non repudiation', 'Key encipherment', 'Data encipherment',
  'Key agreement', 'Certificate signing', 'CRL signing', 'Encipher only', 'Decipher only',
];

const readLength = (bytes, offset) => {
  const first = bytes[offset];
  if (first < 0x80) return { length: first, size: 1 };
  const count = first & 0x7f;
  let length = 0;
  for (let index = 1; index <= count; index += 1) length = length * 256 + bytes[offset + index];
  return { length, size: count + 1 };
};

const parseAsn1 = (bytes, start = 0, end = bytes.length) => {
  const nodes = [];
  let offset = start;

  while (offset < end) {
    const tag = bytes[offset];
    const { length, size } = readLength(bytes, offset + 1);
    const contentStart = offset + 1 + size;
    const contentEnd = contentStart + length;
    if (contentEnd > end) break;

    const constructed = (tag & 0x20) !== 0;
    const node = {
      tag,
      cls: tag >> 6,
      number: tag & 0x1f,
      constructed,
      start: offset,
      end: contentEnd,
      content: bytes.subarray(contentStart, contentEnd),
    };
    if (constructed) node.children = parseAsn1(bytes, contentStart, contentEnd);
    nodes.push(node);
    offset = contentEnd;
  }

  return nodes;
};

const oid = (content) => {
  const parts = [Math.floor(content[0] / 40), content[0] % 40];
  let value = 0;
  for (let index = 1; index < content.length; index += 1) {
    value = value * 128 + (content[index] & 0x7f);
    if (!(content[index] & 0x80)) {
      parts.push(value);
      value = 0;
    }
  }
  return parts.join('.');
};

const text = (bytes) => new TextDecoder().decode(bytes);

const hex = (bytes, separator = '') => [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join(separator);

const time = (node) => {
  const value = text(node.content);
  const parts = node.number === 23
    ? [Number(value.slice(0, 2)) < 50 ? `20${value.slice(0, 2)}` : `19${value.slice(0, 2)}`, value.slice(2, 4), value.slice(4, 6), value.slice(6, 8), value.slice(8, 10), value.slice(10, 12)]
    : [value.slice(0, 4), value.slice(4, 6), value.slice(6, 8), value.slice(8, 10), value.slice(10, 12), value.slice(12, 14)];
  return new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), Number(parts[3]), Number(parts[4]), Number(parts[5] || 0)));
};

const name = (node) =>
  (node.children ?? [])
    .flatMap((set) => set.children ?? [])
    .map((pair) => {
      const [key, value] = pair.children ?? [];
      if (!key || !value) return null;
      const label = OIDS[oid(key.content)] ?? oid(key.content);
      return `${label}=${text(value.content)}`;
    })
    .filter(Boolean);

const generalNames = (node) =>
  (node.children ?? []).map((entry) => {
    if (entry.number === 2) return { kind: 'DNS', value: text(entry.content) };
    if (entry.number === 1) return { kind: 'email', value: text(entry.content) };
    if (entry.number === 6) return { kind: 'URI', value: text(entry.content) };
    if (entry.number === 7) return { kind: 'IP', value: [...entry.content].join('.') };
    return { kind: `type ${entry.number}`, value: text(entry.content) };
  });

const decodePem = (input) => {
  const match = /-----BEGIN ([A-Z ]+)-----([\s\S]*?)-----END \1-----/.exec(input.trim());
  const label = match ? match[1] : null;
  const base64 = (match ? match[2] : input).replace(/[^A-Za-z0-9+/=]/g, '');
  if (!base64) throw new Error('Nothing to decode');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return { bytes, label };
};

const publicKey = (node) => {
  const [algorithm, keyBits] = node.children ?? [];
  const algorithmOid = oid(algorithm.children[0].content);
  const type = KEY_TYPES[algorithmOid] ?? algorithmOid;

  if (type === 'Elliptic curve') {
    const curve = algorithm.children[1] ? CURVES[oid(algorithm.children[1].content)] ?? oid(algorithm.children[1].content) : 'unknown curve';
    return { type, detail: curve };
  }

  if (type.startsWith('RSA')) {
    const inner = parseAsn1(keyBits.content.subarray(1))[0];
    const modulus = inner?.children?.[0]?.content ?? new Uint8Array();
    const trimmed = modulus[0] === 0 ? modulus.subarray(1) : modulus;
    const exponent = inner?.children?.[1]?.content ?? new Uint8Array();
    return { type, detail: `${trimmed.length * 8} bit, exponent ${[...exponent].reduce((total, byte) => total * 256 + byte, 0)}` };
  }

  return { type, detail: `${(keyBits.content.length - 1) * 8} bit` };
};

const parseExtensions = (node) =>
  (node.children ?? []).map((extension) => {
    const [id, ...rest] = extension.children;
    const critical = rest.length > 1 && rest[0].number === 1 && rest[0].content[0] !== 0;
    const value = rest[rest.length - 1];
    const identifier = oid(id.content);
    const label = EXT_NAMES[identifier] ?? identifier;
    const inner = parseAsn1(value.content)[0];

    if (identifier === '2.5.29.17') return { label, critical, names: generalNames(inner) };
    if (identifier === '2.5.29.19') {
      const ca = inner?.children?.[0]?.number === 1 && inner.children[0].content[0] !== 0;
      const depth = inner?.children?.find((child) => child.number === 2);
      return { label, critical, text: ca ? `Certificate authority${depth ? `, path length ${depth.content[0]}` : ''}` : 'Not a certificate authority' };
    }
    if (identifier === '2.5.29.15') {
      const unused = inner.content[0];
      const bits = [...inner.content.subarray(1)].map((byte) => byte.toString(2).padStart(8, '0')).join('');
      const usable = bits.slice(0, bits.length - unused);
      return { label, critical, text: KEY_USAGE_BITS.filter((usage, index) => usable[index] === '1').join(', ') };
    }
    if (identifier === '2.5.29.37') {
      return {
        label,
        critical,
        text: (inner.children ?? []).map((child) => EXT_KEY_USAGE[oid(child.content)] ?? oid(child.content)).join(', '),
      };
    }
    if (identifier === '2.5.29.14' || identifier === '2.5.29.35') {
      const key = identifier === '2.5.29.14' ? inner : inner.children?.[0];
      return { label, critical, text: key ? hex(key.content, ':') : '' };
    }
    return { label, critical, text: `${value.content.length} bytes` };
  });

const parseCertificate = (bytes) => {
  const root = parseAsn1(bytes)[0];
  if (!root?.children) throw new Error('This does not look like DER encoded data');

  const tbs = root.children[0];
  const isRequest = tbs.children[1]?.number === 16 && tbs.children.length <= 4 && !tbs.children.some((child) => child.number === 23 || child.number === 24 || child.children?.some((sub) => sub.number === 23));

  if (isRequest) {
    const subject = tbs.children[1];
    const key = tbs.children[2];
    const attributes = tbs.children[3];
    const sanNode = attributes?.children
      ?.flatMap((attribute) => attribute.children ?? [])
      .flatMap((child) => child.children ?? [])
      .flatMap((child) => child.children ?? [])
      .find((child) => child.children && child.children.length && child.children[0].number === 2);

    return {
      kind: 'Certificate request',
      subject: name(subject),
      key: publicKey(key),
      signature: SIGNATURES[oid(root.children[1].children[0].content)] ?? oid(root.children[1].children[0].content),
      extensions: [],
      names: sanNode ? generalNames(sanNode) : [],
    };
  }

  const offset = tbs.children[0].cls === 2 ? 1 : 0;
  const serial = tbs.children[offset];
  const signature = tbs.children[offset + 1];
  const issuer = tbs.children[offset + 2];
  const validity = tbs.children[offset + 3];
  const subject = tbs.children[offset + 4];
  const key = tbs.children[offset + 5];
  const extensionsNode = tbs.children.slice(offset + 6).find((child) => child.cls === 2 && child.number === 3);
  const extensions = extensionsNode ? parseExtensions(extensionsNode.children[0]) : [];
  const san = extensions.find((extension) => extension.names);

  return {
    kind: 'Certificate',
    version: tbs.children[0].cls === 2 ? tbs.children[0].children[0].content[0] + 1 : 1,
    serial: hex(serial.content),
    signature: SIGNATURES[oid(signature.children[0].content)] ?? oid(signature.children[0].content),
    issuer: name(issuer),
    subject: name(subject),
    notBefore: time(validity.children[0]),
    notAfter: time(validity.children[1]),
    key: publicKey(key),
    extensions,
    names: san?.names ?? [],
  };
};

const SAMPLE = `-----BEGIN CERTIFICATE-----
MIIDuDCCAqCgAwIBAgIUVxwH+NsKKHsY4pP7nUMMyei9Cc4wDQYJKoZIhvcNAQEL
BQAwPTELMAkGA1UEBhMCREUxGDAWBgNVBAoMD1Rvb2xib3ggRXhhbXBsZTEUMBIG
A1UEAwwLZXhhbXBsZS5jb20wHhcNMjYwODEzMTk0ODU4WhcNMzYwODEwMTk0ODU4
WjA9MQswCQYDVQQGEwJERTEYMBYGA1UECgwPVG9vbGJveCBFeGFtcGxlMRQwEgYD
VQQDDAtleGFtcGxlLmNvbTCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEB
AMQ+pt0CWsODuiPYwsoVrbLP8p92pghzDk/3COVaiacgwxcEwyvYk4kvU7RsuW/a
m7Ou6oArm7K/g54EvCQWw+3kY4aU2+myatSCrV1/8wihUB+F6pkR0p885ppcAg9Y
0LKahwFq5o1Bh/v5X/kjF0ND2gVQLln9XXkbmtppf6L5bg3MthHBoBoXYl+rjOPt
mpKZXLY9G6/WSYqkTF5CP5agXtrLr3lElt3liCTy2Cts3dOI76rHxEohQXf9UhQM
wfuiO6vQVk8jOuJYUpD0Tsov3kpKF5/xOPogD97huiT61RvFzKHj5a40P54zfh2x
i5ivT+jSrdn++l7xLaWArXsCAwEAAaOBrzCBrDAdBgNVHQ4EFgQU6xprTVmgjpQe
x7r0P1ojO+nHkuUwHwYDVR0jBBgwFoAU6xprTVmgjpQex7r0P1ojO+nHkuUwDwYD
VR0TAQH/BAUwAwEB/zAtBgNVHREEJjAkggtleGFtcGxlLmNvbYIPd3d3LmV4YW1w
bGUuY29thwTAAAIBMAsGA1UdDwQEAwIFoDAdBgNVHSUEFjAUBggrBgEFBQcDAQYI
KwYBBQUHAwIwDQYJKoZIhvcNAQELBQADggEBAJbH6CjLfdkBmWCtK8RY1nScBISH
rSAehXO/jJC75GUalQgZp1PMsN8JiZqM401jEpITPMBsZadvanpRJ63SBTApiz+p
7waGpMFmwq4HNgY+IVfdRMQvAmwH6qStHH+Co3VMFWfSoQ2xqrC+1HLBDOvSEvnE
gA/BsQQ+TBEBWa//HiCeDKysV7BAwigup2p9j3uFNsDpUTkj1ScTBwGG/7AIsKea
r1h/RPZCpuXtFwFke5zOiAiGWfLjjTsDNHayouYNigKzrn9VtAM9kedWL+c2651d
zPDdebT2osYPtQYpXqaOq8c6Lc/aLX0JvZP91GyK/jnc93KwcvfcEFfsPQI=
-----END CERTIFICATE-----`;

class CertDecoder extends JGApp {
  static appId = 'cert-decoder';
  static styles = [...JGApp.styles, sheet];

  renderApp() {
    this.paint(html`<div class="app">
      <div class="row">
        <jg-button size="sm" variant="outline" id="paste-file">Open a .pem or .crt file</jg-button>
        <jg-button size="sm" variant="ghost" id="clear">Clear</jg-button>
        <span class="grow"></span>
        <jg-badge id="status" tone="muted">Waiting</jg-badge>
      </div>

      <div class="split">
        <div class="pane">
          <span class="label">PEM or base64</span>
          <jg-code id="input" grow language="plain" placeholder="-----BEGIN CERTIFICATE-----"></jg-code>
        </div>
        <div class="pane" id="out"></div>
      </div>

      <div class="hint">
        The certificate is parsed from its DER structure in this browser. Nothing is uploaded, and the fingerprint
        is computed with the Web Crypto API.
      </div>

      <input type="file" id="picker" accept=".pem,.crt,.cer,.csr,.der,text/plain" hidden />
    </div>`);

    this.on(this.$('#input'), 'input', debounce(() => this.#run(), 250));
    this.on(this.$('#paste-file'), 'click', () => this.$('#picker').click());
    this.on(this.$('#picker'), 'change', async () => {
      const file = this.$('#picker').files[0];
      if (!file) return;
      this.$('#input').value = await file.text();
      this.#run();
    });
    this.on(this.$('#clear'), 'click', () => {
      this.$('#input').value = '';
      this.#run();
    });

    const saved = this.store.read({ text: '' });
    this.$('#input').value = saved.text || SAMPLE;
    this.#run();
  }

  async #run() {
    const source = this.$('#input').value;
    const status = this.$('#status');
    this.store.write({ text: source });

    if (!source.trim()) {
      status.setAttribute('tone', 'muted');
      status.textContent = 'Waiting';
      this.$('#out').innerHTML = '';
      return;
    }

    let parsed = null;
    let bytes = null;

    try {
      const decoded = decodePem(source);
      bytes = decoded.bytes;
      parsed = parseCertificate(bytes);
    } catch (error) {
      status.setAttribute('tone', 'danger');
      status.textContent = 'Cannot read this';
      this.$('#out').innerHTML = html`<div class="hint">${error.message}</div>`;
      return;
    }

    const now = Date.now();
    const expired = parsed.notAfter && parsed.notAfter.getTime() < now;
    const future = parsed.notBefore && parsed.notBefore.getTime() > now;

    status.setAttribute('tone', expired ? 'danger' : future ? 'warning' : 'success');
    status.textContent = parsed.kind === 'Certificate request' ? 'Request read' : expired ? 'Expired' : future ? 'Not yet valid' : 'Valid';

    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const sha1 = await crypto.subtle.digest('SHA-1', bytes);

    const days = parsed.notAfter ? Math.round((parsed.notAfter.getTime() - now) / 86400000) : null;
    const span = parsed.notAfter && parsed.notBefore ? parsed.notAfter.getTime() - parsed.notBefore.getTime() : 0;
    const used = span ? Math.min(100, Math.max(0, ((now - parsed.notBefore.getTime()) / span) * 100)) : 0;

    this.$('#out').innerHTML = html`
      <jg-card title="${parsed.kind}">
        <div class="kv">
          <div>Subject</div><div class="mono">${parsed.subject.join(', ') || 'none'}</div>
          ${parsed.issuer ? html`<div>Issuer</div><div class="mono">${parsed.issuer.join(', ') || 'none'}</div>` : ''}
          ${parsed.serial ? html`<div>Serial</div><div class="mono">${parsed.serial}</div>` : ''}
          ${parsed.version ? html`<div>Version</div><div class="mono">v${parsed.version}</div>` : ''}
          <div>Key</div><div class="mono">${parsed.key.type}, ${parsed.key.detail}</div>
          <div>Signature</div><div class="mono">${parsed.signature}</div>
        </div>
      </jg-card>

      ${parsed.notBefore
        ? html`<jg-card title="Validity">
            <div class="kv">
              <div>Not before</div><div class="mono">${parsed.notBefore.toISOString().replace('T', ' ').slice(0, 19)}</div>
              <div>Not after</div><div class="mono">${parsed.notAfter.toISOString().replace('T', ' ').slice(0, 19)}</div>
              <div>Remaining</div><div class="mono">${expired ? `expired ${Math.abs(days)} days ago` : `${days} days`}</div>
            </div>
            <div class="life" style="margin-top:8px"><i style="width:${used.toFixed(1)}%"></i></div>
          </jg-card>`
        : ''}

      ${parsed.names.length
        ? html`<jg-card title="Covers these names" sub="${parsed.names.length} entries">
            <div class="names">${parsed.names.map((entry) => html`<div>${entry.kind}: ${entry.value}</div>`)}</div>
          </jg-card>`
        : ''}

      ${parsed.extensions.length
        ? html`<jg-card title="Extensions">
            <div class="kv">
              ${parsed.extensions.flatMap((extension) => [
                html`<div>${extension.label}${extension.critical ? ' (critical)' : ''}</div>`,
                html`<div class="mono">${extension.names ? `${extension.names.length} names` : extension.text || '-'}</div>`,
              ])}
            </div>
          </jg-card>`
        : ''}

      <jg-card title="Fingerprints">
        <div class="kv">
          <div>SHA-256</div><div class="mono" style="overflow-wrap:anywhere">${hex(new Uint8Array(digest), ':')}</div>
          <div>SHA-1</div><div class="mono" style="overflow-wrap:anywhere">${hex(new Uint8Array(sha1), ':')}</div>
          <div>Size</div><div class="mono">${bytes.length} bytes</div>
        </div>
        <div class="row" style="margin-top:8px">
          <jg-button size="sm" variant="ghost" id="copy-sha">Copy SHA-256</jg-button>
        </div>
      </jg-card>
    `;

    const copy = this.$('#copy-sha');
    if (copy) this.on(copy, 'click', () => copyText(hex(new Uint8Array(digest), ':')));
  }
}

define('jg-app-cert-decoder', CertDecoder);
