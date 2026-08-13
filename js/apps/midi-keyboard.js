import { JGApp, define, html, css } from '../core/app.js';

const sheet = css`
  .board {
    position: relative;
    display: flex;
    height: 190px;
    padding: 0 2px;
    border-radius: var(--radius-lg);
    background: color-mix(in srgb, var(--muted) 80%, transparent);
    border: 1px solid var(--border);
    overflow: hidden;
    user-select: none;
    touch-action: none;
  }
  .white {
    position: relative;
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding-bottom: 8px;
    border-right: 1px solid color-mix(in srgb, var(--foreground) 14%, transparent);
    border-radius: 0 0 6px 6px;
    background: linear-gradient(180deg, #fdfdff, #e7e8ef);
    color: #6b7280;
    font-size: 10px;
    font-weight: 600;
    cursor: pointer;
  }
  .white:last-child { border-right: 0; }
  .white[data-down="true"] { background: linear-gradient(180deg, #d7dcff, #b9c0f0); color: #1f2430; }
  .black {
    position: absolute;
    top: 0;
    width: 26px;
    height: 62%;
    margin-left: -13px;
    border-radius: 0 0 5px 5px;
    background: linear-gradient(180deg, #2b2d38, #14151c);
    color: rgba(255, 255, 255, 0.55);
    font-size: 9px;
    font-weight: 600;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding-bottom: 6px;
    cursor: pointer;
    z-index: 2;
  }
  .black[data-down="true"] { background: linear-gradient(180deg, #5b63e8, #3a3f9e); color: #fff; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; }
  .now { font-family: var(--font-mono); font-size: 13px; }
`;

const SCALE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const KEY_ROW = ['a', 'w', 's', 'e', 'd', 'f', 't', 'g', 'y', 'h', 'u', 'j', 'k', 'o', 'l', 'p', ';'];
const WAVES = ['sine', 'triangle', 'square', 'sawtooth'];

const noteName = (midi) => `${SCALE[midi % 12]}${Math.floor(midi / 12) - 1}`;
const frequency = (midi) => 440 * 2 ** ((midi - 69) / 12);

class MidiKeyboard extends JGApp {
  static appId = 'midi-keyboard';
  static styles = [...JGApp.styles, sheet];

  #context = null;
  #master = null;
  #voices = new Map();
  #octave = 4;
  #held = new Set();

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#voices.forEach((voice, midi) => this.#stop(midi));
    this.#context?.close();
  }

  renderApp() {
    this.paint(html`<div class="app">
      <div class="row">
        <jg-button-group>
          <jg-button size="sm" variant="outline" id="down">Octave −</jg-button>
          <jg-button size="sm" variant="outline" id="up">Octave +</jg-button>
        </jg-button-group>
        <jg-badge mono id="octave">C4</jg-badge>
        <span class="grow"></span>
        <span class="now" id="playing">-</span>
      </div>

      <div class="board" id="board"></div>

      <div class="grid">
        <jg-field label="Waveform">
          <jg-select id="wave" value="triangle">
            ${WAVES.map((wave) => html`<option value="${wave}">${wave}</option>`)}
          </jg-select>
        </jg-field>
        <jg-field label="Volume"><jg-slider id="volume" min="0" max="100" value="45"></jg-slider></jg-field>
        <jg-field label="Attack"><jg-slider id="attack" min="1" max="400" value="12"></jg-slider></jg-field>
        <jg-field label="Release"><jg-slider id="release" min="20" max="1200" value="260"></jg-slider></jg-field>
      </div>

      <jg-card title="MIDI input" sub="Connect a controller to play it directly">
        <div class="row">
          <jg-button size="sm" variant="outline" id="connect">Connect MIDI device</jg-button>
          <span class="hint" id="midi">Not connected</span>
        </div>
      </jg-card>

      <div class="hint">
        Play with the mouse, touch, or the computer keyboard: A W S E D F T G Y H U J for one octave,
        Z and X shift the octave.
      </div>
    </div>`);

    this.#paintKeys();

    this.on(this.$('#down'), 'click', () => this.#shift(-1));
    this.on(this.$('#up'), 'click', () => this.#shift(1));
    this.on(this.$('#connect'), 'click', () => this.#connectMidi());

    this.hotkeys((event) => {
      if (event.repeat || event.metaKey || event.ctrlKey) return;
      const key = event.key.toLowerCase();
      if (key === 'z') return this.#shift(-1);
      if (key === 'x') return this.#shift(1);
      const index = KEY_ROW.indexOf(key);
      if (index < 0) return;
      event.preventDefault();
      this.#play((this.#octave + 1) * 12 + index);
    });

    this.hotkeys((event) => {
      const index = KEY_ROW.indexOf(event.key.toLowerCase());
      if (index >= 0) this.#stop((this.#octave + 1) * 12 + index);
    }, { type: 'keyup' });
  }

  #shift(direction) {
    this.#octave = Math.min(7, Math.max(1, this.#octave + direction));
    this.$('#octave').textContent = `C${this.#octave}`;
    this.#paintKeys();
  }

  #paintKeys() {
    const board = this.$('#board');
    const start = (this.#octave + 1) * 12;
    const whites = [];
    const blacks = [];

    for (let offset = 0; offset < 24; offset += 1) {
      const midi = start + offset;
      const name = SCALE[midi % 12];
      const label = KEY_ROW[offset] ? KEY_ROW[offset].toUpperCase() : '';
      if (name.includes('#')) blacks.push({ midi, label, index: whites.length });
      else whites.push({ midi, label, name });
    }

    board.innerHTML = [
      ...whites.map(
        (key) => html`<div class="white" data-midi="${key.midi}" data-down="false">
          <span>${key.label || (key.name === 'C' ? noteName(key.midi) : '')}</span>
        </div>`,
      ),
      ...blacks.map(
        (key) => html`<div class="black" data-midi="${key.midi}" data-down="false" style="left:calc(${key.index} * (100% / ${whites.length}))">
          <span>${key.label}</span>
        </div>`,
      ),
    ].join('');

    board.querySelectorAll('[data-midi]').forEach((node) => {
      const midi = Number(node.dataset.midi);
      this.on(node, 'pointerdown', (event) => {
        node.setPointerCapture(event.pointerId);
        this.#play(midi);
      });
      this.on(node, 'pointerup', () => this.#stop(midi));
      this.on(node, 'pointerleave', () => this.#stop(midi));
      this.on(node, 'pointercancel', () => this.#stop(midi));
    });
  }

  #audio() {
    if (!this.#context) {
      this.#context = new (window.AudioContext ?? window.webkitAudioContext)();
      this.#master = this.#context.createGain();
      this.#master.connect(this.#context.destination);
    }
    if (this.#context.state === 'suspended') this.#context.resume();
    this.#master.gain.value = Number(this.$('#volume').value) / 100;
    return this.#context;
  }

  #play(midi) {
    if (this.#voices.has(midi)) return;
    const context = this.#audio();
    const attack = Number(this.$('#attack').value) / 1000;

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = this.$('#wave').value;
    oscillator.frequency.value = frequency(midi);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.9, context.currentTime + attack);
    oscillator.connect(gain).connect(this.#master);
    oscillator.start();

    this.#voices.set(midi, { oscillator, gain });
    this.#held.add(midi);
    this.#paintHeld(midi, true);
  }

  #stop(midi) {
    const voice = this.#voices.get(midi);
    if (!voice) return;
    const context = this.#context;
    const release = Number(this.$('#release')?.value ?? 260) / 1000;
    voice.gain.gain.cancelScheduledValues(context.currentTime);
    voice.gain.gain.setValueAtTime(voice.gain.gain.value, context.currentTime);
    voice.gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + release);
    voice.oscillator.stop(context.currentTime + release + 0.02);
    this.#voices.delete(midi);
    this.#held.delete(midi);
    this.#paintHeld(midi, false);
  }

  #paintHeld(midi, down) {
    const node = this.$(`[data-midi="${midi}"]`);
    if (node) node.dataset.down = String(down);
    const playing = this.$('#playing');
    if (playing) {
      playing.textContent = this.#held.size ? [...this.#held].sort((a, b) => a - b).map(noteName).join(' ') : '-';
    }
  }

  async #connectMidi() {
    const status = this.$('#midi');
    if (!navigator.requestMIDIAccess) {
      status.textContent = 'This browser has no Web MIDI support.';
      return;
    }
    try {
      const access = await navigator.requestMIDIAccess();
      const inputs = [...access.inputs.values()];
      if (!inputs.length) {
        status.textContent = 'No MIDI inputs found.';
        return;
      }
      inputs.forEach((input) => {
        input.onmidimessage = ({ data }) => {
          const [command, note, velocity] = data;
          if ((command & 0xf0) === 0x90 && velocity > 0) this.#play(note);
          if ((command & 0xf0) === 0x80 || ((command & 0xf0) === 0x90 && velocity === 0)) this.#stop(note);
        };
      });
      status.textContent = `Connected: ${inputs.map((input) => input.name).join(', ')}`;
    } catch (error) {
      status.textContent = error.message;
    }
  }
}

define('jg-app-midi-keyboard', MidiKeyboard);
