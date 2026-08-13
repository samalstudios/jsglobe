import { JGApp, define, html, css } from '../core/app.js';

const sheet = css`
  .pads {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
    flex: none;
  }
  @media (max-width: 640px) { .pads { grid-template-columns: repeat(2, 1fr); } }
  .pad {
    appearance: none;
    display: grid;
    gap: 4px;
    place-content: center;
    aspect-ratio: 1.35;
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: linear-gradient(180deg, color-mix(in srgb, var(--card) 92%, transparent), color-mix(in srgb, var(--muted) 70%, transparent));
    color: var(--foreground);
    cursor: pointer;
    user-select: none;
    box-shadow: var(--shadow-sm);
    transition: transform 0.06s ease, box-shadow 0.12s ease, border-color 0.12s ease;
  }
  .pad .name { font: 600 12.5px/1 var(--font-sans); }
  .pad .key {
    justify-self: center;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--muted-foreground);
    border: 1px solid var(--border);
    border-radius: 5px;
    padding: 2px 6px;
  }
  .pad[data-hit="true"] {
    transform: translateY(2px) scale(0.97);
    border-color: color-mix(in srgb, var(--ring) 60%, transparent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--ring) 24%, transparent);
    background: color-mix(in srgb, var(--ring) 18%, var(--card));
  }
  .steps { display: grid; gap: 6px; }
  .lane { display: grid; grid-template-columns: 92px 1fr; gap: 8px; align-items: center; }
  .lane .label { font-size: 11.5px; color: var(--muted-foreground); }
  .cells { display: grid; grid-template-columns: repeat(16, 1fr); gap: 3px; }
  .step {
    appearance: none;
    height: 26px;
    border: 1px solid var(--border);
    border-radius: 5px;
    background: color-mix(in srgb, var(--muted) 55%, transparent);
    cursor: pointer;
    padding: 0;
  }
  .step[data-beat="true"] { border-color: var(--border-strong); }
  .step[data-on="true"] { background: var(--ring); border-color: transparent; }
  .step[data-cursor="true"] { outline: 2px solid color-mix(in srgb, var(--foreground) 45%, transparent); outline-offset: 1px; }
`;

const KITS = {
  kick: { label: 'Kick', key: 'a' },
  snare: { label: 'Snare', key: 's' },
  clap: { label: 'Clap', key: 'd' },
  rim: { label: 'Rim', key: 'f' },
  hatClosed: { label: 'Closed hat', key: 'g' },
  hatOpen: { label: 'Open hat', key: 'h' },
  tom: { label: 'Tom', key: 'j' },
  cymbal: { label: 'Cymbal', key: 'k' },
};

const STEPS = 16;

class DrumKit extends JGApp {
  static appId = 'drum-kit';
  static styles = [...JGApp.styles, sheet];

  #context = null;
  #timer = null;
  #cursor = 0;
  #pattern = {};

  renderApp() {
    this.#pattern = this.store.read({ pattern: null }).pattern ?? this.#empty();

    this.paint(html`<div class="app">
      <div class="pads">
        ${Object.entries(KITS).map(
          ([id, pad]) => html`<button class="pad" data-pad="${id}">
            <span class="name">${pad.label}</span>
            <span class="key">${pad.key.toUpperCase()}</span>
          </button>`,
        )}
      </div>

      <jg-card title="Step sequencer" sub="16 steps, click to toggle">
        <div class="row">
          <jg-button size="sm" id="play">Play</jg-button>
          <jg-button size="sm" variant="outline" id="clear">Clear</jg-button>
          <jg-button size="sm" variant="ghost" id="demo">Load beat</jg-button>
          <span class="grow"></span>
          <span class="hint">Tempo</span>
          <jg-slider id="tempo" min="60" max="180" value="100" style="max-width:200px"></jg-slider>
        </div>
        <div class="steps" id="steps"></div>
      </jg-card>

      <div class="hint">
        Every sound is synthesised with the Web Audio API, so there are no samples to download and nothing leaves
        the device.
      </div>
    </div>`);

    this.bind('[data-pad]', 'pointerdown', (event) => this.#hit(event.currentTarget.dataset.pad));
    this.hotkeys((event) => {
      const entry = Object.entries(KITS).find(([, pad]) => pad.key === event.key.toLowerCase());
      if (!entry || event.repeat) return;
      event.preventDefault();
      this.#hit(entry[0]);
    });

    this.on(this.$('#play'), 'click', () => this.#toggle());
    this.on(this.$('#clear'), 'click', () => {
      this.#pattern = this.#empty();
      this.#save();
      this.#paintSteps();
    });
    this.on(this.$('#demo'), 'click', () => {
      this.#pattern = this.#demo();
      this.#save();
      this.#paintSteps();
    });
    this.on(this.$('#tempo'), 'input', () => {
      if (this.#timer) this.#schedule();
    });

    this.#paintSteps();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    clearInterval(this.#timer);
    this.#timer = null;
    this.#context?.close();
    this.#context = null;
  }

  #empty() {
    return Object.fromEntries(Object.keys(KITS).map((id) => [id, Array.from({ length: STEPS }, () => false)]));
  }

  #demo() {
    const pattern = this.#empty();
    [0, 4, 8, 10, 14].forEach((step) => (pattern.kick[step] = true));
    [4, 12].forEach((step) => (pattern.snare[step] = true));
    for (let step = 0; step < STEPS; step += 2) pattern.hatClosed[step] = true;
    [7, 15].forEach((step) => (pattern.hatOpen[step] = true));
    pattern.clap[12] = true;
    return pattern;
  }

  #save() {
    this.store.write({ pattern: this.#pattern });
  }

  #paintSteps() {
    this.$('#steps').innerHTML = Object.entries(KITS)
      .map(
        ([id, pad]) => html`<div class="lane">
          <span class="label">${pad.label}</span>
          <div class="cells">
            ${Array.from({ length: STEPS }, (item, step) => html`<button
              class="step"
              data-lane="${id}"
              data-step="${step}"
              data-on="${String(Boolean(this.#pattern[id]?.[step]))}"
              data-beat="${String(step % 4 === 0)}"
            ></button>`)}
          </div>
        </div>`,
      )
      .join('');

    this.bind('[data-lane]', 'click', (event) => {
      const { lane, step } = event.currentTarget.dataset;
      this.#pattern[lane][Number(step)] = !this.#pattern[lane][Number(step)];
      event.currentTarget.dataset.on = String(this.#pattern[lane][Number(step)]);
      this.#save();
    });
  }

  #audio() {
    this.#context ??= new (window.AudioContext ?? window.webkitAudioContext)();
    if (this.#context.state === 'suspended') this.#context.resume();
    return this.#context;
  }

  #toggle() {
    const button = this.$('#play');
    if (this.#timer) {
      clearInterval(this.#timer);
      this.#timer = null;
      button.textContent = 'Play';
      this.$$('.step').forEach((node) => node.removeAttribute('data-cursor'));
      return;
    }
    this.#audio();
    this.#cursor = 0;
    button.textContent = 'Stop';
    this.#schedule();
  }

  #schedule() {
    clearInterval(this.#timer);
    const interval = 60000 / Number(this.$('#tempo').value) / 4;
    this.#timer = setInterval(() => this.#tick(), interval);
  }

  #tick() {
    const step = this.#cursor % STEPS;
    this.$$('.step').forEach((node) => {
      node.dataset.cursor = String(Number(node.dataset.step) === step);
    });
    Object.keys(KITS).forEach((id) => {
      if (this.#pattern[id]?.[step]) this.#play(id);
    });
    this.#cursor += 1;
  }

  #hit(id) {
    this.#play(id);
    const pad = this.$(`[data-pad="${id}"]`);
    if (!pad) return;
    pad.dataset.hit = 'true';
    setTimeout(() => pad.removeAttribute('data-hit'), 90);
  }

  #noise(context, duration) {
    const frames = Math.floor(context.sampleRate * duration);
    const buffer = context.createBuffer(1, frames, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < frames; index += 1) data[index] = Math.random() * 2 - 1;
    const source = context.createBufferSource();
    source.buffer = buffer;
    return source;
  }

  #envelope(context, peak, duration) {
    const gain = context.createGain();
    const now = context.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peak, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    gain.connect(context.destination);
    return gain;
  }

  #play(id) {
    const context = this.#audio();
    const now = context.currentTime;

    if (id === 'kick') {
      const oscillator = context.createOscillator();
      const gain = this.#envelope(context, 0.9, 0.42);
      oscillator.frequency.setValueAtTime(150, now);
      oscillator.frequency.exponentialRampToValueAtTime(45, now + 0.18);
      oscillator.connect(gain);
      oscillator.start(now);
      oscillator.stop(now + 0.45);
      return;
    }

    if (id === 'tom') {
      const oscillator = context.createOscillator();
      const gain = this.#envelope(context, 0.6, 0.34);
      oscillator.frequency.setValueAtTime(220, now);
      oscillator.frequency.exponentialRampToValueAtTime(90, now + 0.22);
      oscillator.connect(gain);
      oscillator.start(now);
      oscillator.stop(now + 0.36);
      return;
    }

    const durations = { snare: 0.22, clap: 0.2, rim: 0.08, hatClosed: 0.06, hatOpen: 0.34, cymbal: 0.9 };
    const duration = durations[id] ?? 0.2;
    const source = this.#noise(context, duration + 0.05);
    const filter = context.createBiquadFilter();

    if (id === 'snare' || id === 'clap') {
      filter.type = 'bandpass';
      filter.frequency.value = id === 'clap' ? 1400 : 1900;
      filter.Q.value = 0.8;
    } else if (id === 'rim') {
      filter.type = 'bandpass';
      filter.frequency.value = 2600;
      filter.Q.value = 4;
    } else {
      filter.type = 'highpass';
      filter.frequency.value = id === 'cymbal' ? 5200 : 7200;
    }

    const gain = this.#envelope(context, id === 'cymbal' ? 0.35 : 0.5, duration);
    source.connect(filter);
    filter.connect(gain);
    source.start(now);
    source.stop(now + duration + 0.05);

    if (id === 'snare') {
      const body = context.createOscillator();
      const bodyGain = this.#envelope(context, 0.35, 0.14);
      body.frequency.setValueAtTime(190, now);
      body.connect(bodyGain);
      body.start(now);
      body.stop(now + 0.16);
    }
  }
}

define('jg-app-drum-kit', DrumKit);
