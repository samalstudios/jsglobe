import { JGApp, define, html, css } from '../core/app.js';

const sheet = css`
  .app { gap: 12px; }
  .readout { display: grid; place-items: center; gap: 2px; padding: 6px 0 0; }
  .note { font: 700 clamp(46px, 14vw, 78px)/1 var(--font-sans); letter-spacing: -0.05em; }
  .note small { font-size: 0.42em; font-weight: 600; color: var(--muted-foreground); margin-left: 4px; }
  .freq { font: 500 13px/1 var(--font-mono); color: var(--muted-foreground); }
  .verdict { font-size: 13px; font-weight: 600; min-height: 20px; }
  .verdict[data-state="flat"], .verdict[data-state="sharp"] { color: var(--warning); }
  .verdict[data-state="in"] { color: var(--success); }
  .verdict[data-state="idle"] { color: var(--muted-foreground); font-weight: 500; }

  .meter {
    position: relative;
    height: 66px;
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: color-mix(in srgb, var(--muted) 60%, transparent);
    overflow: hidden;
  }
  .ticks { position: absolute; inset: 0; display: flex; justify-content: space-between; padding: 0 6px; }
  .ticks span { width: 1px; background: var(--border-strong); }
  .ticks span:nth-child(6) { background: var(--success); width: 2px; }
  .zone {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 47%;
    width: 6%;
    background: color-mix(in srgb, var(--success) 14%, transparent);
  }
  .needle {
    position: absolute;
    top: 6px;
    bottom: 6px;
    width: 3px;
    border-radius: 999px;
    background: var(--ring);
    left: 50%;
    transform: translateX(-50%);
    transition: left 0.09s linear, background 0.2s ease;
  }
  .needle[data-in="true"] { background: var(--success); }
  .scale { display: flex; justify-content: space-between; font: 500 10px/1 var(--font-mono); color: var(--muted-foreground); }

  .strings { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }
  .string {
    display: grid;
    place-items: center;
    gap: 1px;
    min-width: 58px;
    padding: 8px 10px;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--card);
    color: var(--foreground);
    font-family: inherit;
    cursor: pointer;
  }
  .string b { font-size: 15px; }
  .string span { font-size: 10.5px; color: var(--muted-foreground); font-family: var(--font-mono); }
  .string[data-active="true"] {
    border-color: var(--ring);
    background: color-mix(in srgb, var(--ring) 14%, transparent);
  }
  .string[data-tuned="true"] { border-color: var(--success); background: color-mix(in srgb, var(--success) 14%, transparent); }
  .level { height: 5px; border-radius: 999px; background: var(--muted); overflow: hidden; }
  .level i { display: block; height: 100%; background: var(--ring); transition: width 0.08s linear; }
`;

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const PRESETS = {
  standard: { label: 'Guitar standard', strings: ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'] },
  dropD: { label: 'Guitar drop D', strings: ['D2', 'A2', 'D3', 'G3', 'B3', 'E4'] },
  halfStep: { label: 'Guitar half step down', strings: ['D#2', 'G#2', 'C#3', 'F#3', 'A#3', 'D#4'] },
  openG: { label: 'Guitar open G', strings: ['D2', 'G2', 'D3', 'G3', 'B3', 'D4'] },
  bass: { label: 'Bass 4 string', strings: ['E1', 'A1', 'D2', 'G2'] },
  ukulele: { label: 'Ukulele', strings: ['G4', 'C4', 'E4', 'A4'] },
};

const midiOf = (name) => {
  const match = /^([A-G]#?)(-?\d)$/.exec(name);
  return NOTES.indexOf(match[1]) + (Number(match[2]) + 1) * 12;
};

const detect = (buffer, sampleRate) => {
  const size = buffer.length;
  let rms = 0;
  for (let i = 0; i < size; i += 1) rms += buffer[i] * buffer[i];
  rms = Math.sqrt(rms / size);
  if (rms < 0.008) return { frequency: -1, rms };

  let start = 0;
  let end = size - 1;
  const threshold = 0.2;
  for (let i = 0; i < size / 2; i += 1) {
    if (Math.abs(buffer[i]) < threshold) {
      start = i;
      break;
    }
  }
  for (let i = 1; i < size / 2; i += 1) {
    if (Math.abs(buffer[size - i]) < threshold) {
      end = size - i;
      break;
    }
  }

  const trimmed = buffer.slice(start, end);
  const length = trimmed.length;
  if (length < 128) return { frequency: -1, rms };

  const correlations = new Float32Array(length);
  for (let lag = 0; lag < length; lag += 1) {
    let sum = 0;
    for (let i = 0; i < length - lag; i += 1) sum += trimmed[i] * trimmed[i + lag];
    correlations[lag] = sum;
  }

  let lag = 0;
  while (lag < length - 1 && correlations[lag] > correlations[lag + 1]) lag += 1;

  let peak = -1;
  let peakLag = -1;
  for (let i = lag; i < length; i += 1) {
    if (correlations[i] > peak) {
      peak = correlations[i];
      peakLag = i;
    }
  }
  if (peakLag <= 0) return { frequency: -1, rms };

  const left = correlations[peakLag - 1] ?? 0;
  const middle = correlations[peakLag];
  const right = correlations[peakLag + 1] ?? 0;
  const shape = (left + right - 2 * middle) / 2;
  const slope = (right - left) / 2;
  const refined = shape ? peakLag - slope / (2 * shape) : peakLag;

  return { frequency: sampleRate / refined, rms };
};

class Tuner extends JGApp {
  static appId = 'tuner';
  static settings = [
    { key: 'reference', label: 'Reference pitch (A4)', type: 'number', default: 440, min: 415, max: 466 },
  ];
  static styles = [...JGApp.styles, sheet];

  #stream = null;
  #context = null;
  #analyser = null;
  #buffer = null;
  #frame = null;
  #target = null;
  #tuned = new Set();
  #last = 0;

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#stop();
  }

  renderApp() {
    this.paint(html`<div class="app">
      <div class="row">
        <jg-select id="preset" value="${this.config.get('preset', 'standard')}" style="width:220px">
          ${Object.entries(PRESETS).map(([key, preset]) => html`<option value="${key}">${preset.label}</option>`)}
        </jg-select>
        <jg-input id="reference" type="number" min="415" max="466" value="${this.config.get('reference', 440)}" suffix="Hz A4" style="width:140px"></jg-input>
        <span class="grow"></span>
        <jg-button id="start">Start listening</jg-button>
        <jg-button id="stop" variant="outline" hidden>Stop</jg-button>
      </div>

      <div class="readout">
        <div class="note" id="note">-</div>
        <div class="freq" id="freq">Play a string</div>
        <div class="verdict" id="verdict" data-state="idle">Microphone is off</div>
      </div>

      <div class="meter">
        <div class="zone"></div>
        <div class="ticks">
          ${Array.from({ length: 11 }, () => html`<span></span>`)}
        </div>
        <div class="needle" id="needle" data-in="false"></div>
      </div>
      <div class="scale"><span>-50</span><span>-25</span><span>0</span><span>+25</span><span>+50 cents</span></div>

      <div class="strings" id="strings"></div>

      <div class="level"><i id="level" style="width:0%"></i></div>
      <div class="hint" id="error"></div>
    </div>`);

    this.on(this.$('#start'), 'click', () => this.#start());
    this.on(this.$('#stop'), 'click', () => this.#stop());
    this.on(this.$('#preset'), 'change', (event) => {
      this.config.set('preset', event.detail.value);
      this.#tuned.clear();
      this.#paintStrings();
    });
    this.on(this.$('#reference'), 'change', () => this.config.set('reference', Number(this.$('#reference').value)));

    this.#paintStrings();
  }

  #reference() {
    return Number(this.$('#reference').value) || 440;
  }

  #frequencyOf(name) {
    return this.#reference() * 2 ** ((midiOf(name) - 69) / 12);
  }

  #paintStrings() {
    const preset = PRESETS[this.$('#preset').value];
    this.$('#strings').innerHTML = preset.strings
      .map(
        (name) => html`<button
          class="string"
          data-note="${name}"
          data-active="${String(this.#target === name)}"
          data-tuned="${String(this.#tuned.has(name))}"
        >
          <b>${name.replace(/\d/, '')}</b>
          <span>${this.#frequencyOf(name).toFixed(1)} Hz</span>
        </button>`,
      )
      .join('');

    this.bind('.string', 'click', (event) => {
      const note = event.currentTarget.dataset.note;
      this.#target = this.#target === note ? null : note;
      this.#paintStrings();
      this.#tone(note);
    });
  }

  #tone(name) {
    const context = this.#context ?? new (window.AudioContext ?? window.webkitAudioContext)();
    this.#context = context;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.value = this.#frequencyOf(name);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.25, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 1.4);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 1.5);
  }

  async #start() {
    const error = this.$('#error');
    error.textContent = '';

    if (!navigator.mediaDevices?.getUserMedia) {
      error.textContent = 'This browser cannot open a microphone here.';
      return;
    }

    try {
      this.#stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
    } catch (issue) {
      error.textContent =
        issue.name === 'NotAllowedError'
          ? 'Microphone permission was declined. Allow it in the address bar and try again.'
          : `Could not open the microphone: ${issue.message}`;
      return;
    }

    this.#context = this.#context ?? new (window.AudioContext ?? window.webkitAudioContext)();
    if (this.#context.state === 'suspended') await this.#context.resume();

    const source = this.#context.createMediaStreamSource(this.#stream);
    this.#analyser = this.#context.createAnalyser();
    this.#analyser.fftSize = 2048;
    source.connect(this.#analyser);
    this.#buffer = new Float32Array(this.#analyser.fftSize);

    this.$('#start').hidden = true;
    this.$('#stop').hidden = false;
    this.$('#verdict').textContent = 'Listening';
    this.#listen();
  }

  #stop() {
    cancelAnimationFrame(this.#frame);
    this.#stream?.getTracks().forEach((track) => track.stop());
    this.#stream = null;
    this.#analyser = null;

    const start = this.$('#start');
    if (start) start.hidden = false;
    const stop = this.$('#stop');
    if (stop) stop.hidden = true;
    const verdict = this.$('#verdict');
    if (verdict) {
      verdict.textContent = 'Microphone is off';
      verdict.dataset.state = 'idle';
    }
  }

  #listen() {
    const tick = () => {
      this.#frame = requestAnimationFrame(tick);
      if (!this.#analyser) return;
      const now = performance.now();
      if (now - this.#last < 70) return;
      this.#last = now;

      this.#analyser.getFloatTimeDomainData(this.#buffer);
      const { frequency, rms } = detect(this.#buffer, this.#context.sampleRate);

      const level = this.$('#level');
      if (level) level.style.width = `${Math.min(100, rms * 400)}%`;

      if (frequency < 25 || frequency > 1400) {
        this.$('#verdict').textContent = 'Play a note';
        this.$('#verdict').dataset.state = 'idle';
        return;
      }

      const reference = this.#reference();
      const midi = Math.round(12 * Math.log2(frequency / reference) + 69);
      const exact = reference * 2 ** ((midi - 69) / 12);
      const cents = Math.round(1200 * Math.log2(frequency / exact));
      const name = `${NOTES[midi % 12]}${Math.floor(midi / 12) - 1}`;

      this.$('#note').innerHTML = html`${NOTES[midi % 12]}<small>${Math.floor(midi / 12) - 1}</small>`;
      this.$('#freq').textContent = `${frequency.toFixed(1)} Hz · target ${exact.toFixed(1)} Hz`;

      const needle = this.$('#needle');
      needle.style.left = `${50 + Math.max(-50, Math.min(50, cents))}%`;
      const inTune = Math.abs(cents) <= 5;
      needle.dataset.in = String(inTune);

      const verdict = this.$('#verdict');
      verdict.textContent = inTune ? 'In tune' : cents < 0 ? `${Math.abs(cents)} cents flat, tighten` : `${cents} cents sharp, loosen`;
      verdict.dataset.state = inTune ? 'in' : cents < 0 ? 'flat' : 'sharp';

      const preset = PRESETS[this.$('#preset').value];
      if (inTune && preset.strings.includes(name)) {
        if (!this.#tuned.has(name)) {
          this.#tuned.add(name);
          this.#paintStrings();
        }
      }
    };

    tick();
  }
}

define('jg-app-tuner', Tuner);
