import { JGApp, define, html, css } from '../core/app.js';
import { debounce, encodeBytes, decodeBytes } from '../core/util.js';

const sheet = css`
  .split { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; flex: 1; min-height: 0; }
  @media (max-width: 760px) { .split { grid-template-columns: 1fr; } }
  .pane { display: flex; flex-direction: column; gap: 6px; min-height: 0; }
`;

const NATO = {
  a: 'Alfa', b: 'Bravo', c: 'Charlie', d: 'Delta', e: 'Echo', f: 'Foxtrot', g: 'Golf', h: 'Hotel',
  i: 'India', j: 'Juliett', k: 'Kilo', l: 'Lima', m: 'Mike', n: 'November', o: 'Oscar', p: 'Papa',
  q: 'Quebec', r: 'Romeo', s: 'Sierra', t: 'Tango', u: 'Uniform', v: 'Victor', w: 'Whiskey',
  x: 'Xray', y: 'Yankee', z: 'Zulu', 0: 'Zero', 1: 'One', 2: 'Two', 3: 'Three', 4: 'Four',
  5: 'Five', 6: 'Six', 7: 'Seven', 8: 'Eight', 9: 'Nine', ' ': '(space)', '.': 'Stop', '-': 'Dash',
};

const MORSE = {
  a: '.-', b: '-...', c: '-.-.', d: '-..', e: '.', f: '..-.', g: '--.', h: '....', i: '..', j: '.---',
  k: '-.-', l: '.-..', m: '--', n: '-.', o: '---', p: '.--.', q: '--.-', r: '.-.', s: '...', t: '-',
  u: '..-', v: '...-', w: '.--', x: '-..-', y: '-.--', z: '--..', 0: '-----', 1: '.----', 2: '..---',
  3: '...--', 4: '....-', 5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.', '.': '.-.-.-',
  ',': '--..--', '?': '..--..', "'": '.----.', '/': '-..-.', '(': '-.--.', ')': '-.--.-', '&': '.-...',
  ':': '---...', '=': '-...-', '+': '.-.-.', '-': '-....-', '"': '.-..-.', '@': '.--.-.',
};

const MORSE_REVERSE = Object.fromEntries(Object.entries(MORSE).map(([key, value]) => [value, key]));

const rot = (text, shift) =>
  text.replace(/[a-z]/gi, (char) => {
    const base = char <= 'Z' ? 65 : 97;
    return String.fromCharCode(((char.charCodeAt(0) - base + shift + 26) % 26) + base);
  });

const CODECS = {
  binary: {
    label: 'Binary',
    encode: (text) => [...encodeBytes(text)].map((byte) => byte.toString(2).padStart(8, '0')).join(' '),
    decode: (text) => decodeBytes(Uint8Array.from(text.trim().split(/\s+/).map((part) => parseInt(part, 2)))),
  },
  hex: {
    label: 'Hexadecimal',
    encode: (text) => [...encodeBytes(text)].map((byte) => byte.toString(16).padStart(2, '0')).join(' '),
    decode: (text) => decodeBytes(Uint8Array.from(text.trim().split(/\s+/).map((part) => parseInt(part, 16)))),
  },
  decimal: {
    label: 'Decimal bytes',
    encode: (text) => [...encodeBytes(text)].join(' '),
    decode: (text) => decodeBytes(Uint8Array.from(text.trim().split(/\s+/).map(Number))),
  },
  unicode: {
    label: 'Unicode escapes',
    encode: (text) => [...text].map((char) => `\\u${char.codePointAt(0).toString(16).padStart(4, '0')}`).join(''),
    decode: (text) => text.replace(/\\u\{?([0-9a-f]+)\}?/gi, (match, code) => String.fromCodePoint(parseInt(code, 16))),
  },
  entities: {
    label: 'Numeric entities',
    encode: (text) => [...text].map((char) => `&#${char.codePointAt(0)};`).join(''),
    decode: (text) => text.replace(/&#(\d+);/g, (match, code) => String.fromCodePoint(Number(code))),
  },
  nato: {
    label: 'NATO alphabet',
    encode: (text) => [...text.toLowerCase()].map((char) => NATO[char] ?? char).join(' '),
    decode: (text) => {
      const lookup = Object.fromEntries(Object.entries(NATO).map(([key, value]) => [value.toLowerCase(), key]));
      return text.split(/\s+/).map((word) => lookup[word.toLowerCase()] ?? word).join('');
    },
  },
  morse: {
    label: 'Morse code',
    encode: (text) =>
      text
        .toLowerCase()
        .split(' ')
        .map((word) => [...word].map((char) => MORSE[char] ?? '').filter(Boolean).join(' '))
        .join(' / '),
    decode: (text) =>
      text
        .trim()
        .split(/\s*\/\s*/)
        .map((word) => word.split(/\s+/).map((code) => MORSE_REVERSE[code] ?? '').join(''))
        .join(' '),
  },
  rot13: {
    label: 'ROT13',
    encode: (text) => rot(text, 13),
    decode: (text) => rot(text, 13),
  },
  reverse: {
    label: 'Reversed',
    encode: (text) => [...text].reverse().join(''),
    decode: (text) => [...text].reverse().join(''),
  },
  numeronym: {
    label: 'Numeronym',
    encode: (text) =>
      text
        .split(/\s+/)
        .map((word) => (word.length > 3 ? `${word[0]}${word.length - 2}${word.at(-1)}` : word))
        .join(' '),
    decode: () => 'Numeronyms cannot be reversed.',
  },
};

class TextEncoderApp extends JGApp {
  static appId = 'text-encoder';
  static styles = [...JGApp.styles, sheet];

  renderApp() {
    this.paint(html`<div class="app">
      <div class="row">
        <jg-select id="codec" value="binary" style="width:210px">
          ${Object.entries(CODECS).map(([key, codec]) => html`<option value="${key}">${codec.label}</option>`)}
        </jg-select>
        <span class="grow"></span>
        <jg-button size="sm" variant="outline" id="swap">Swap ⇅</jg-button>
      </div>

      <div class="split">
        <div class="pane">
          <div class="spread"><span class="label">Plain text</span><jg-copy from="#plain" size="icon"></jg-copy></div>
          <jg-textarea id="plain" grow sans placeholder="Type text to encode"></jg-textarea>
        </div>
        <div class="pane">
          <div class="spread"><span class="label" id="outlabel">Encoded</span><jg-copy from="#encoded" size="icon"></jg-copy></div>
          <jg-textarea id="encoded" grow placeholder="Paste encoded text to decode"></jg-textarea>
        </div>
      </div>

      <div class="hint" id="status"></div>
    </div>`);

    const plain = this.$('#plain');
    const encoded = this.$('#encoded');
    const status = this.$('#status');

    const encode = debounce(() => {
      const codec = CODECS[this.$('#codec').value];
      try {
        encoded.value = plain.value ? codec.encode(plain.value) : '';
        status.textContent = `${plain.value.length} characters in, ${encoded.value.length} out`;
      } catch (error) {
        status.textContent = error.message;
      }
    }, 120);

    const decode = debounce(() => {
      const codec = CODECS[this.$('#codec').value];
      try {
        plain.value = encoded.value ? codec.decode(encoded.value) : '';
        status.textContent = 'Decoded';
      } catch {
        status.textContent = 'That does not look like valid input for this format.';
      }
    }, 120);

    this.on(plain, 'input', encode);
    this.on(encoded, 'input', decode);
    this.on(this.$('#codec'), 'change', () => {
      this.$('#outlabel').textContent = CODECS[this.$('#codec').value].label;
      encode();
    });
    this.on(this.$('#swap'), 'click', () => {
      const value = plain.value;
      plain.value = encoded.value;
      encoded.value = value;
      encode();
    });

    plain.value = 'Hello JS Globe';
    encode();
  }
}

define('jg-app-text-encoder', TextEncoderApp);
