import { JGApp, define, html, css } from '../core/app.js';
import { debounce, copyText } from '../core/util.js';

const sheet = css`
  .chart { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 6px; }
  .cell {
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 6px 10px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    font-family: var(--font-mono);
    font-size: 12px;
  }
  .cell b { font-size: 13px; color: var(--foreground); }
  .cell span { color: var(--muted-foreground); letter-spacing: 1px; }
`;

const TABLE = {
  a: '.-', b: '-...', c: '-.-.', d: '-..', e: '.', f: '..-.', g: '--.', h: '....',
  i: '..', j: '.---', k: '-.-', l: '.-..', m: '--', n: '-.', o: '---', p: '.--.',
  q: '--.-', r: '.-.', s: '...', t: '-', u: '..-', v: '...-', w: '.--', x: '-..-',
  y: '-.--', z: '--..',
  0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-',
  5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.',
  '.': '.-.-.-', ',': '--..--', '?': '..--..', "'": '.----.', '!': '-.-.--',
  '/': '-..-.', '(': '-.--.', ')': '-.--.-', '&': '.-...', ':': '---...',
  ';': '-.-.-.', '=': '-...-', '+': '.-.-.', '-': '-....-', _: '..--.-',
  '"': '.-..-.', $: '...-..-', '@': '.--.-.',
};

const REVERSE = Object.fromEntries(Object.entries(TABLE).map(([key, value]) => [value, key]));

const encode = (text) =>
  text
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => [...word].map((letter) => TABLE[letter] ?? '').filter(Boolean).join(' '))
    .join(' / ');

const decode = (code) =>
  code
    .trim()
    .split(/\s*\/\s*|\s{3,}/)
    .map((word) => word.split(/\s+/).map((symbol) => REVERSE[symbol] ?? '').join(''))
    .join(' ')
    .trim();

const UNIT = 0.07;

class MorseCode extends JGApp {
  static appId = 'morse-code';
  static styles = [...JGApp.styles, sheet];

  #context = null;
  #stop = null;

  renderApp() {
    this.paint(html`<div class="app">
      <jg-field label="Text">
        <jg-textarea id="text" rows="4" sans placeholder="hello world"></jg-textarea>
      </jg-field>

      <jg-field label="Morse">
        <jg-textarea id="code" rows="4" placeholder=".... . .-.. .-.. ---"></jg-textarea>
      </jg-field>

      <div class="row">
        <jg-button size="sm" variant="outline" id="play">Play tone</jg-button>
        <jg-button size="sm" variant="ghost" id="copy">Copy morse</jg-button>
        <span class="grow"></span>
        <span class="hint">Slash separates words</span>
      </div>

      <jg-card title="Reference" sub="International Morse code">
        <div class="chart">
          ${Object.entries(TABLE).map(([key, value]) => html`<div class="cell"><b>${key}</b><span>${value}</span></div>`)}
        </div>
      </jg-card>
    </div>`);

    const text = this.$('#text');
    const code = this.$('#code');

    this.on(text, 'input', debounce(() => {
      code.value = encode(text.value);
    }, 160));

    this.on(code, 'input', debounce(() => {
      text.value = decode(code.value);
    }, 160));

    this.on(this.$('#copy'), 'click', () => copyText(code.value));
    this.on(this.$('#play'), 'click', () => this.#play(code.value));

    text.value = 'hello world';
    code.value = encode(text.value);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#stop?.();
    this.#context?.close();
    this.#context = null;
  }

  #play(code) {
    this.#stop?.();
    this.#context ??= new (window.AudioContext ?? window.webkitAudioContext)();
    const context = this.#context;
    const gain = context.createGain();
    gain.gain.value = 0;
    gain.connect(context.destination);

    const oscillator = context.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.value = 620;
    oscillator.connect(gain);

    let at = context.currentTime + 0.05;
    for (const symbol of code) {
      if (symbol === '.' || symbol === '-') {
        const length = (symbol === '.' ? 1 : 3) * UNIT;
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.exponentialRampToValueAtTime(0.3, at + 0.008);
        gain.gain.setValueAtTime(0.3, at + length - 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
        at += length + UNIT;
      } else if (symbol === ' ') {
        at += UNIT * 2;
      } else if (symbol === '/') {
        at += UNIT * 4;
      }
    }

    oscillator.start();
    oscillator.stop(at + 0.1);
    this.#stop = () => {
      try {
        oscillator.stop();
      } catch {
        return;
      }
    };
  }
}

define('jg-app-morse-code', MorseCode);
