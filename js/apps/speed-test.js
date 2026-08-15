import { JGApp, define, html, css } from '../core/app.js';
import { formatBytes } from '../core/util.js';

const sheet = css`
  .gauge { display: grid; place-items: center; gap: 4px; padding: 8px 0 2px; }
  .value { font: 700 clamp(38px, 11vw, 62px)/1 var(--font-sans); letter-spacing: -0.04em; font-variant-numeric: tabular-nums; }
  .unit { font-size: 13px; color: var(--muted-foreground); }
  .phase { font-size: 12.5px; color: var(--muted-foreground); min-height: 18px; }
  .track { height: 6px; border-radius: 999px; background: var(--muted); overflow: hidden; }
  .track i { display: block; height: 100%; background: var(--ring); transition: width 0.2s ease; }
  .results { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; }
  .result {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 12px;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--card);
  }
  .result .n { font: 700 20px/1.1 var(--font-sans); font-variant-numeric: tabular-nums; }
  .result .l { font-size: 11.5px; color: var(--muted-foreground); }
  .spark { display: flex; align-items: flex-end; gap: 2px; height: 46px; }
  .spark i { flex: 1; background: color-mix(in srgb, var(--ring) 55%, transparent); border-radius: 2px 2px 0 0; min-height: 2px; }
`;

const PRESETS = {
  cloudflare: { label: 'Cloudflare', down: 'https://speed.cloudflare.com/__down?bytes=', up: 'https://speed.cloudflare.com/__up' },
  origin: { label: 'This server', down: '', up: '' },
};

const mbps = (bytes, seconds) => (bytes * 8) / seconds / 1e6;

class SpeedTest extends JGApp {
  static appId = 'speed-test';
  static settings = [
    { key: 'server', label: 'Test server', type: 'select', default: 'cloudflare', options: [
      { value: 'cloudflare', label: 'Cloudflare' },
      { value: 'origin', label: 'This server' },
    ] },
  ];
  static styles = [...JGApp.styles, sheet];

  #running = false;
  #controller = null;
  #samples = [];

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#controller?.abort();
  }

  renderApp() {
    this.paint(html`<div class="app">
      <div class="row">
        <jg-select id="server" value="${this.config.get('server', 'cloudflare')}" style="width:190px">
          ${Object.entries(PRESETS).map(([key, preset]) => html`<option value="${key}">${preset.label}</option>`)}
        </jg-select>
        <span class="grow"></span>
        <jg-button id="start">Start test</jg-button>
        <jg-button id="stop" variant="outline" hidden>Stop</jg-button>
      </div>

      <jg-card>
        <div class="gauge">
          <span class="value" id="value">-</span>
          <span class="unit" id="unit">Mbps</span>
          <span class="phase" id="phase">Ready to measure your connection.</span>
        </div>
        <div class="track"><i id="progress" style="width:0%"></i></div>
        <div class="spark" id="spark"></div>
      </jg-card>

      <div class="results">
        <div class="result"><span class="n" id="r-down">-</span><span class="l">Download Mbps</span></div>
        <div class="result"><span class="n" id="r-up">-</span><span class="l">Upload Mbps</span></div>
        <div class="result"><span class="n" id="r-latency">-</span><span class="l">Latency ms</span></div>
        <div class="result"><span class="n" id="r-jitter">-</span><span class="l">Jitter ms</span></div>
      </div>

      <jg-card title="Connection">
        <div class="kv" id="connection"></div>
      </jg-card>

      <div class="hint" id="note"></div>
    </div>`);

    this.on(this.$('#start'), 'click', () => this.#run());
    this.on(this.$('#stop'), 'click', () => this.#controller?.abort());
    this.on(this.$('#server'), 'change', (event) => {
      this.config.set('server', event.detail.value);
      this.#note();
    });

    this.#connection();
    this.#note();
  }

  #note() {
    const server = this.$('#server').value;
    this.$('#note').textContent =
      server === 'origin'
        ? 'Downloads a file from the server hosting JS Globe. Useful for measuring a LAN or your own host, and it stays on your network.'
        : 'Uses the public Cloudflare speed endpoints. Your browser contacts speed.cloudflare.com while the test runs.';
  }

  #connection() {
    const link = navigator.connection ?? {};
    this.$('#connection').innerHTML = html`
      <div>Reported type</div><div>${link.effectiveType ?? 'unknown'}</div>
      <div>Reported downlink</div><div>${link.downlink ? `${link.downlink} Mbps` : 'unknown'}</div>
      <div>Round trip estimate</div><div>${link.rtt ? `${link.rtt} ms` : 'unknown'}</div>
      <div>Data saver</div><div>${link.saveData ? 'on' : 'off'}</div>
    `;
  }

  #set(phase, value, unit = 'Mbps') {
    this.$('#phase').textContent = phase;
    if (value !== undefined) this.$('#value').textContent = value;
    this.$('#unit').textContent = unit;
  }

  #spark(values) {
    const peak = Math.max(...values, 1);
    this.$('#spark').innerHTML = values.map((value) => `<i style="height:${Math.max(4, (value / peak) * 100)}%"></i>`).join('');
  }

  async #run() {
    if (this.#running) return;
    this.#running = true;
    this.#samples = [];
    this.#controller = new AbortController();
    this.$('#stop').hidden = false;
    this.$('#start').setAttribute('disabled', '');
    ['#r-down', '#r-up', '#r-latency', '#r-jitter'].forEach((id) => {
      this.$(id).textContent = '-';
    });

    try {
      const latency = await this.#latency();
      this.$('#r-latency').textContent = latency.median.toFixed(0);
      this.$('#r-jitter').textContent = latency.jitter.toFixed(0);

      const down = await this.#download();
      this.$('#r-down').textContent = down.toFixed(1);

      const up = await this.#upload();
      this.$('#r-up').textContent = up === null ? 'n/a' : up.toFixed(1);

      this.#set('Test complete', down.toFixed(1));
      this.$('#progress').style.width = '100%';
    } catch (error) {
      this.#set(error.name === 'AbortError' ? 'Test stopped' : `Could not finish: ${error.message}`, '-');
    } finally {
      this.#running = false;
      this.#controller = null;
      const stop = this.$('#stop');
      const start = this.$('#start');
      if (stop) stop.hidden = true;
      if (start) start.removeAttribute('disabled');
    }
  }

  #endpoint(bytes) {
    const server = this.$('#server').value;
    if (server === 'origin') return `${window.location.origin}/js/apps/catalog.js?cache=${Math.random()}`;
    return `${PRESETS.cloudflare.down}${bytes}&cache=${Math.random()}`;
  }

  async #latency() {
    this.#set('Measuring latency', '-', 'ms');
    const times = [];
    for (let i = 0; i < 8; i += 1) {
      const started = performance.now();
      await fetch(this.#endpoint(0), { cache: 'no-store', signal: this.#controller.signal });
      times.push(performance.now() - started);
      this.$('#progress').style.width = `${((i + 1) / 8) * 15}%`;
    }
    const sorted = [...times].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const jitter = times.slice(1).reduce((total, value, index) => total + Math.abs(value - times[index]), 0) / (times.length - 1);
    this.#set('Latency measured', median.toFixed(0), 'ms');
    return { median, jitter };
  }

  async #download() {
    this.#set('Testing download', '0.0');
    const chunks = this.$('#server').value === 'origin' ? [0] : [1e6, 5e6, 1e7, 2.5e7];
    const started = performance.now();
    let total = 0;
    const values = [];

    for (const [index, size] of chunks.entries()) {
      const response = await fetch(this.#endpoint(size), { cache: 'no-store', signal: this.#controller.signal });
      const reader = response.body.getReader();
      let sliceStart = performance.now();
      let sliceBytes = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.length;
        sliceBytes += value.length;
        const elapsed = (performance.now() - sliceStart) / 1000;
        if (elapsed >= 0.25) {
          const rate = mbps(sliceBytes, elapsed);
          values.push(rate);
          this.#samples.push(rate);
          this.#set('Testing download', rate.toFixed(1));
          this.#spark(this.#samples.slice(-40));
          sliceStart = performance.now();
          sliceBytes = 0;
        }
      }
      this.$('#progress').style.width = `${15 + ((index + 1) / chunks.length) * 55}%`;
      if (performance.now() - started > 12000) break;
    }

    const seconds = (performance.now() - started) / 1000;
    const average = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : mbps(total, seconds);
    this.$('#phase').textContent = `Downloaded ${formatBytes(total)} in ${seconds.toFixed(1)}s`;
    return average;
  }

  async #upload() {
    if (this.$('#server').value === 'origin') return null;
    this.#set('Testing upload', '0.0');
    const payload = new Uint8Array(4e6);
    crypto.getRandomValues(payload.subarray(0, 65536));
    const values = [];

    for (let round = 0; round < 3; round += 1) {
      const started = performance.now();
      await fetch(PRESETS.cloudflare.up, {
        method: 'POST',
        body: payload,
        cache: 'no-store',
        signal: this.#controller.signal,
      });
      const seconds = (performance.now() - started) / 1000;
      const rate = mbps(payload.length, seconds);
      values.push(rate);
      this.#set('Testing upload', rate.toFixed(1));
      this.$('#progress').style.width = `${70 + ((round + 1) / 3) * 30}%`;
    }

    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }
}

define('jg-app-speed-test', SpeedTest);
