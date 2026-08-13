import { JGApp, define, html, css } from '../core/app.js';
import { download } from '../core/util.js';

const sheet = css`
  .app { gap: 12px; }
  .stage {
    position: relative;
    flex: 1;
    min-height: 260px;
    display: grid;
    place-items: center;
    padding: clamp(10px, var(--ring-size, 6%), 90px);
    border-radius: var(--radius-xl);
    background: var(--light, #ffffff);
    overflow: hidden;
    transition: background 0.2s ease, padding 0.2s ease;
  }
  .frame {
    position: relative;
    width: 100%;
    height: 100%;
    border-radius: var(--radius-lg);
    overflow: hidden;
    background: #0b0b0d;
    display: grid;
    place-items: center;
  }
  video, canvas.freeze {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    transform: scaleX(var(--flip, -1)) scale(var(--zoom, 1));
    filter: brightness(var(--brightness, 1)) contrast(var(--contrast, 1)) saturate(var(--saturate, 1));
    transition: transform 0.15s ease;
  }
  canvas.freeze { position: absolute; inset: 0; }
  .guides { position: absolute; inset: 0; pointer-events: none; display: none; }
  .stage[data-guides="true"] .guides { display: block; }
  .guides span { position: absolute; background: rgba(255, 255, 255, 0.35); }
  .guides .v { top: 0; bottom: 0; width: 1px; }
  .guides .h { left: 0; right: 0; height: 1px; }
  .idle {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    gap: 10px;
    text-align: center;
    color: #1a1a1f;
    padding: 20px;
  }
  .controls { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; }
  .bar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .error { color: var(--destructive); font-size: 13px; }
`;

class Mirror extends JGApp {
  static appId = 'mirror';
  static styles = [...JGApp.styles, sheet];

  #stream = null;
  #devices = [];
  #frozen = false;

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#stop();
  }

  renderApp() {
    const config = this.config;

    this.paint(html`<div class="app">
      <div class="bar">
        <jg-button id="start">Turn on camera</jg-button>
        <jg-button id="stop" variant="outline" hidden>Turn off</jg-button>
        <jg-button id="freeze" variant="outline" hidden>Freeze</jg-button>
        <jg-button id="shot" variant="outline" hidden>Save photo</jg-button>
        <span class="grow"></span>
        <jg-select id="device" style="width:200px" hidden></jg-select>
        <jg-button size="icon" variant="outline" id="full" title="Full screen">⤢</jg-button>
      </div>

      <div class="stage" id="stage" data-guides="false">
        <div class="frame" id="frame">
          <video id="video" playsinline autoplay muted></video>
          <span class="guides">
            <span class="v" style="left:33.33%"></span>
            <span class="v" style="left:66.66%"></span>
            <span class="h" style="top:33.33%"></span>
            <span class="h" style="top:66.66%"></span>
          </span>
        </div>
        <div class="idle" id="idle">
          <div>
            <div class="strong">Camera is off</div>
            <div class="hint" style="color:#55555f">
              The picture stays on this device. Nothing is recorded or uploaded.
            </div>
          </div>
        </div>
      </div>

      <div class="controls">
        <jg-field label="Ring light">
          <jg-slider id="glow" min="0" max="100" value="${config.get('glow', 70)}"></jg-slider>
        </jg-field>
        <jg-field label="Warmth">
          <jg-slider id="warmth" min="0" max="100" value="${config.get('warmth', 20)}"></jg-slider>
        </jg-field>
        <jg-field label="Border size">
          <jg-slider id="border" min="0" max="18" value="${config.get('border', 6)}"></jg-slider>
        </jg-field>
        <jg-field label="Zoom">
          <jg-slider id="zoom" min="100" max="250" value="100"></jg-slider>
        </jg-field>
        <jg-field label="Brightness">
          <jg-slider id="brightness" min="50" max="180" value="100"></jg-slider>
        </jg-field>
        <jg-field label="Contrast">
          <jg-slider id="contrast" min="50" max="180" value="100"></jg-slider>
        </jg-field>
      </div>

      <div class="bar">
        <jg-switch id="flip" checked></jg-switch><span class="hint">Mirror the image</span>
        <jg-switch id="guides"></jg-switch><span class="hint">Composition guides</span>
        <jg-switch id="mono"></jg-switch><span class="hint">Black and white</span>
        <span class="grow"></span>
        <span class="error" id="error"></span>
      </div>
    </div>`);

    this.on(this.$('#start'), 'click', () => this.#start());
    this.on(this.$('#stop'), 'click', () => this.#stop());
    this.on(this.$('#freeze'), 'click', () => this.#toggleFreeze());
    this.on(this.$('#shot'), 'click', () => this.#snapshot());
    this.on(this.$('#full'), 'click', () => this.#fullscreen());
    this.on(this.$('#device'), 'change', () => this.#start(this.$('#device').value));

    ['#glow', '#warmth', '#border', '#zoom', '#brightness', '#contrast'].forEach((selector) =>
      this.on(this.$(selector), 'input', () => this.#apply()),
    );
    ['#glow', '#warmth', '#border'].forEach((selector) =>
      this.on(this.$(selector), 'change', () => {
        this.config.set(selector.slice(1), Number(this.$(selector).value));
      }),
    );
    ['#flip', '#guides', '#mono'].forEach((selector) => this.on(this.$(selector), 'change', () => this.#apply()));

    this.#apply();
  }

  #apply() {
    const stage = this.$('#stage');
    if (!stage) return;

    const glow = Number(this.$('#glow').value) / 100;
    const warmth = Number(this.$('#warmth').value) / 100;
    const red = 255;
    const green = Math.round(255 - warmth * 24);
    const blue = Math.round(255 - warmth * 66);
    const level = 0.35 + glow * 0.65;

    stage.style.setProperty('--light', `rgb(${Math.round(red * level)} ${Math.round(green * level)} ${Math.round(blue * level)})`);
    stage.style.setProperty('--ring-size', `${this.$('#border').value}%`);
    stage.style.setProperty('--zoom', String(Number(this.$('#zoom').value) / 100));
    stage.style.setProperty('--flip', this.$('#flip').checked ? '-1' : '1');
    stage.style.setProperty('--brightness', String(Number(this.$('#brightness').value) / 100));
    stage.style.setProperty('--contrast', String(Number(this.$('#contrast').value) / 100));
    stage.style.setProperty('--saturate', this.$('#mono').checked ? '0' : '1');
    stage.dataset.guides = String(this.$('#guides').checked);
  }

  async #start(deviceId) {
    const error = this.$('#error');
    error.textContent = '';

    if (!navigator.mediaDevices?.getUserMedia) {
      error.textContent = 'This browser cannot open a camera here. A secure origin is required.';
      return;
    }

    this.#stop({ keepUi: true });

    try {
      this.#stream = await navigator.mediaDevices.getUserMedia({
        video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'user', width: { ideal: 1280 } },
        audio: false,
      });
    } catch (issue) {
      error.textContent =
        issue.name === 'NotAllowedError'
          ? 'Camera permission was declined. Allow it in the browser address bar and try again.'
          : `Could not open the camera: ${issue.message}`;
      return;
    }

    const video = this.$('#video');
    video.srcObject = this.#stream;
    await video.play().catch(() => {});

    this.$('#idle').hidden = true;
    this.$('#start').hidden = true;
    ['#stop', '#freeze', '#shot'].forEach((selector) => {
      this.$(selector).hidden = false;
    });

    this.#devices = (await navigator.mediaDevices.enumerateDevices()).filter((device) => device.kind === 'videoinput');
    const picker = this.$('#device');
    if (this.#devices.length > 1) {
      picker.options = this.#devices.map((device, index) => ({
        value: device.deviceId,
        label: device.label || `Camera ${index + 1}`,
      }));
      picker.hidden = false;
      const active = this.#stream.getVideoTracks()[0]?.getSettings().deviceId;
      if (active) picker.value = active;
    }
  }

  #stop({ keepUi = false } = {}) {
    this.#stream?.getTracks().forEach((track) => track.stop());
    this.#stream = null;
    const video = this.$('#video');
    if (video) video.srcObject = null;
    if (keepUi) return;

    this.#clearFreeze();
    const idle = this.$('#idle');
    if (idle) idle.hidden = false;
    const start = this.$('#start');
    if (start) start.hidden = false;
    ['#stop', '#freeze', '#shot'].forEach((selector) => {
      const node = this.$(selector);
      if (node) node.hidden = true;
    });
    const picker = this.$('#device');
    if (picker) picker.hidden = true;
  }

  #capture() {
    const video = this.$('#video');
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const context = canvas.getContext('2d');
    if (this.$('#flip').checked) {
      context.translate(canvas.width, 0);
      context.scale(-1, 1);
    }
    context.filter = `brightness(${Number(this.$('#brightness').value) / 100}) contrast(${Number(this.$('#contrast').value) / 100}) saturate(${this.$('#mono').checked ? 0 : 1})`;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas;
  }

  #clearFreeze() {
    this.$('.freeze')?.remove();
    this.#frozen = false;
    const freeze = this.$('#freeze');
    if (freeze) freeze.textContent = 'Freeze';
  }

  #toggleFreeze() {
    if (!this.#stream) return;
    if (this.#frozen) return this.#clearFreeze();
    const canvas = this.#capture();
    canvas.className = 'freeze';
    canvas.style.transform = 'none';
    canvas.style.filter = 'none';
    this.$('#frame').append(canvas);
    this.#frozen = true;
    this.$('#freeze').textContent = 'Unfreeze';
  }

  #snapshot() {
    if (!this.#stream) return;
    this.#capture().toBlob((blob) => download(`mirror-${Date.now()}.png`, blob, 'image/png'), 'image/png');
  }

  #fullscreen() {
    const stage = this.$('#stage');
    if (document.fullscreenElement) document.exitFullscreen();
    else stage.requestFullscreen?.().catch(() => {});
  }
}

define('jg-app-mirror', Mirror);
