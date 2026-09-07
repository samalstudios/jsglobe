import { JGApp, define, html, styleSheet } from '../../core/app.js';
import { appWords } from '../../core/i18n.js';
import { icon } from '../../ui/icons.js';
import { download } from '../../core/util.js';

const t = await appWords('mirror', (lang) => import(`./i18n/${lang}.js`));

const sheet = await styleSheet(import.meta.url);

const PRESETS = [
  { id: 'daylight', label: () => t('mirror.daylight', 'Daylight'), glow: 85, warmth: 5 },
  { id: 'warm', label: () => t('mirror.warm', 'Warm'), glow: 70, warmth: 55 },
  { id: 'soft', label: () => t('mirror.soft', 'Soft'), glow: 45, warmth: 30 },
  { id: 'studio', label: () => t('mirror.studio', 'Studio'), glow: 100, warmth: 15 },
];

const SLIDERS = [
  { key: 'glow', tab: 'light', label: () => t('mirror.ringLight', 'Ring light'), min: 0, max: 100, fallback: 70 },
  { key: 'warmth', tab: 'light', label: () => t('mirror.warmth', 'Warmth'), min: 0, max: 100, fallback: 20 },
  { key: 'zoom', tab: 'image', label: () => t('mirror.zoom', 'Zoom'), min: 100, max: 250, fallback: 100 },
  { key: 'brightness', tab: 'image', label: () => t('mirror.brightness', 'Brightness'), min: 50, max: 180, fallback: 100 },
  { key: 'contrast', tab: 'image', label: () => t('mirror.contrast', 'Contrast'), min: 50, max: 180, fallback: 100 },
  { key: 'border', tab: 'frame', label: () => t('mirror.borderSize', 'Border size'), min: 0, max: 18, fallback: 6 },
  { key: 'preview', tab: 'frame', label: () => t('mirror.previewSize', 'Preview size'), min: 15, max: 70, fallback: 34 },
];

const TOGGLES = [
  { key: 'flip', tab: 'frame', label: () => t('mirror.mirrorTheImage', 'Mirror the image'), fallback: true },
  { key: 'guides', tab: 'frame', label: () => t('mirror.compositionGuides', 'Composition guides'), fallback: false },
  { key: 'flood', tab: 'light', label: () => t('mirror.floodLight', 'Flood light'), fallback: false },
  { key: 'mono', tab: 'image', label: () => t('mirror.blackAndWhite', 'Black and white'), fallback: false },
];

const TABS = [
  { id: 'light', label: () => t('mirror.light', 'Light') },
  { id: 'image', label: () => t('mirror.image', 'Image') },
  { id: 'frame', label: () => t('mirror.frame', 'Frame') },
];

class Mirror extends JGApp {
  static appId = 'mirror';
  static settings = [
    { key: 'auto', label: t('mirror.startAutomatically', 'Start the camera automatically'), type: 'switch', default: true },
  ];
  static styles = [...JGApp.styles, sheet];

  #stream = null;
  #devices = [];
  #frozen = false;
  #tab = 'light';
  #countdown = 0;
  #timer = null;
  #shots = [];
  #seq = 0;
  #holding = null;
  #viewing = -1;
  #loupe = false;
  #loupeAt = null;
  #loupeMag = 2.6;
  #frameId = 0;
  #tipTimer = null;

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#stop();
    clearInterval(this.#timer);
    clearTimeout(this.#holding);
    clearTimeout(this.#tipTimer);
    cancelAnimationFrame(this.#frameId);
    for (const shot of this.#shots) URL.revokeObjectURL(shot.url);
    this.#shots = [];
  }

  renderApp() {
    const config = this.config;
    const value = (key, fallback) => config.get(key, fallback);
    const on = (key, fallback) => String(config.get(key, fallback)) === 'true' || config.get(key, fallback) === true;

    const sliderFor = (entry) => html`<jg-field label="${entry.label()}" id="field-${entry.key}">
      <jg-slider id="${entry.key}" min="${entry.min}" max="${entry.max}" value="${value(entry.key, entry.fallback)}"></jg-slider>
    </jg-field>`;

    const toggleFor = (entry) => html`<button class="toggle" type="button" data-toggle="${entry.key}"
      role="switch" aria-checked="${String(on(entry.key, entry.fallback))}">
      <span class="track"><span class="knob"></span></span>
      <span class="name">${entry.label()}</span>
    </button>`;

    this.paint(html`<div class="app" id="app">
      <div class="stage" id="stage" data-guides="false">
        <div class="frame" id="frame">
          <video id="video" playsinline autoplay muted aria-label="${t('mirror.cameraView', 'Camera view')}"></video>
          <span class="guides" aria-hidden="true">
            <span class="v" style="left:33.33%"></span>
            <span class="v" style="left:66.66%"></span>
            <span class="h" style="top:33.33%"></span>
            <span class="h" style="top:66.66%"></span>
          </span>
          <span class="badge" id="badge" hidden>${t('mirror.frozen', 'Frozen')}</span>
          <span class="count" id="count" hidden></span>
          <canvas class="loupe" id="loupe" width="200" height="200" hidden></canvas>
          <div class="tip" id="tip" hidden aria-live="polite">
            <span class="wheel" aria-hidden="true"><i></i></span>
            ${t('mirror.wheelZooms', 'Roll the wheel to zoom the magnifier')}
          </div>
          <div class="hold" id="hold" hidden></div>
          <div class="tray" id="tray" hidden></div>
        </div>

        <div class="idle" id="idle">
          <div class="card">
            <span class="mark">${icon('camera', 26)}</span>
            <div class="strong">${t('mirror.cameraIsOff', 'Camera is off')}</div>
            <p class="hint">${t('mirror.staysHere', 'The picture stays on this device. Nothing is recorded or uploaded.')}</p>
            <jg-button id="start">${t('mirror.turnOnCamera', 'Turn on camera')}</jg-button>
            <p class="error" id="error" role="status" aria-live="polite"></p>
          </div>
        </div>

        <div class="hud" id="hud" hidden>
          <button class="key" type="button" id="stop" title="${t('mirror.turnOff', 'Turn off')}" aria-label="${t('mirror.turnOff', 'Turn off')}">${icon('close', 16)}</button>
          <button class="key" type="button" id="freeze" title="${t('mirror.freeze', 'Freeze')}" aria-label="${t('mirror.freeze', 'Freeze')}">${icon('pause', 16)}</button>
          <button class="shutter" type="button" id="shot" title="${t('mirror.savePhoto', 'Save photo')}" aria-label="${t('mirror.savePhoto', 'Save photo')}"><span></span></button>
          <button class="key" type="button" id="delay" title="${t('mirror.selfTimer', 'Self timer')}" aria-label="${t('mirror.selfTimer', 'Self timer')}">${icon('timer', 16)}</button>
          <button class="key" type="button" id="glass" title="${t('mirror.magnifier', 'Magnifier')}" aria-label="${t('mirror.magnifier', 'Magnifier')}" aria-pressed="false">${icon('search', 16)}</button>
          <button class="key" type="button" id="tune" title="${t('mirror.adjust', 'Adjust')}" aria-label="${t('mirror.adjust', 'Adjust')}">${icon('flashlight', 17)}</button>
          <button class="key" type="button" id="full" title="${t('mirror.fullScreen', 'Full screen')}" aria-label="${t('mirror.fullScreen', 'Full screen')}">${icon('maximize', 15)}</button>
        </div>

        <div class="viewer" id="viewer" hidden>
          <img id="viewed" alt="${t('mirror.photo', 'Photo')}">
          <div class="viewbar">
            <button class="key" type="button" id="older" title="${t('mirror.older', 'Older')}" aria-label="${t('mirror.older', 'Older')}">${icon('chevronLeft', 16)}</button>
            <button class="key" type="button" id="newer" title="${t('mirror.newer', 'Newer')}" aria-label="${t('mirror.newer', 'Newer')}">${icon('chevronRight', 16)}</button>
            <span class="grow"></span>
            <jg-button size="sm" id="save">${t('mirror.savePhoto', 'Save photo')}</jg-button>
            <button class="key" type="button" id="drop" title="${t('mirror.discard', 'Discard')}" aria-label="${t('mirror.discard', 'Discard')}">${icon('eraser', 16)}</button>
            <button class="key" type="button" id="shutview" title="${t('mirror.close', 'Close')}" aria-label="${t('mirror.close', 'Close')}">${icon('close', 16)}</button>
          </div>
        </div>

        <div class="panel" id="panel" hidden>
          <div class="grip"></div>
          <div class="tabs" role="tablist">
            ${TABS.map((tab) => html`<button class="tab" type="button" role="tab" data-tab="${tab.id}"
              aria-selected="${String(tab.id === this.#tab)}">${tab.label()}</button>`)}
            <span class="grow"></span>
            <jg-select id="device" hidden></jg-select>
            <button class="key small" type="button" id="reset" title="${t('mirror.reset', 'Reset')}" aria-label="${t('mirror.reset', 'Reset')}">${icon('undo', 14)}</button>
            <button class="key small" type="button" id="shut" title="${t('mirror.close', 'Close')}" aria-label="${t('mirror.close', 'Close')}">${icon('chevronDown', 14)}</button>
          </div>

          <div class="pane" data-pane="light">
            <div class="presets">
              ${PRESETS.map((preset) => html`<button class="preset" type="button" data-preset="${preset.id}">${preset.label()}</button>`)}
            </div>
            <div class="grid">
              ${SLIDERS.filter((entry) => entry.tab === 'light').map(sliderFor)}
              ${TOGGLES.filter((entry) => entry.tab === 'light').map(toggleFor)}
            </div>
          </div>

          <div class="pane" data-pane="image" hidden>
            <div class="grid">
              ${SLIDERS.filter((entry) => entry.tab === 'image').map(sliderFor)}
              ${TOGGLES.filter((entry) => entry.tab === 'image').map(toggleFor)}
            </div>
          </div>

          <div class="pane" data-pane="frame" hidden>
            <div class="grid">
              ${SLIDERS.filter((entry) => entry.tab === 'frame').map(sliderFor)}
              ${TOGGLES.filter((entry) => entry.tab === 'frame').map(toggleFor)}
            </div>
          </div>
        </div>
      </div>
    </div>`);

    this.on(this.$('#start'), 'click', () => this.#start());
    this.on(this.$('#stop'), 'click', () => this.#stop());
    this.on(this.$('#freeze'), 'click', () => this.#toggleFreeze());
    this.on(this.$('#shot'), 'click', () => this.#snapshot());
    this.on(this.$('#delay'), 'click', () => this.#delayed());
    this.on(this.$('#full'), 'click', () => this.#fullscreen());
    this.on(this.$('#tune'), 'click', () => this.#showPanel(this.$('#panel').hidden));
    this.on(this.$('#shut'), 'click', () => this.#showPanel(false));
    this.on(this.$('#reset'), 'click', () => this.#reset());
    this.on(this.$('#device'), 'change', () => this.#start(this.$('#device').value));

    this.on(this.$('.tabs'), 'click', (event) => {
      const tab = event.target.closest('[data-tab]');
      if (tab) this.#showTab(tab.dataset.tab);
    });

    for (const entry of SLIDERS) {
      const slider = this.$(`#${entry.key}`);
      this.on(slider, 'input', () => this.#apply());
      this.on(slider, 'change', () => this.config.set(entry.key, Number(slider.value)));
    }

    this.on(this.$('#panel'), 'click', (event) => {
      const button = event.target.closest('[data-toggle]');
      if (button) return this.#flip(button.dataset.toggle);
      const preset = event.target.closest('[data-preset]');
      if (preset) this.#usePreset(preset.dataset.preset);
    });

    this.on(this.$('#tray'), 'click', (event) => {
      const thumb = event.target.closest('[data-shot]');
      if (thumb) this.#view(this.#shots.findIndex((shot) => String(shot.id) === thumb.dataset.shot));
    });
    this.on(this.$('#glass'), 'click', () => this.#showLoupe(!this.#loupe));
    this.on(this.$('#frame'), 'pointermove', (event) => this.#trackLoupe(event));
    this.on(this.$('#frame'), 'pointerleave', () => {
      this.#loupeAt = null;
      if (this.#loupe) this.$('#loupe').hidden = true;
    });
    this.on(this.$('#frame'), 'wheel', (event) => {
      if (!this.#loupe) return;
      event.preventDefault();
      this.#loupeMag = Math.max(1.4, Math.min(8, this.#loupeMag * (event.deltaY < 0 ? 1.12 : 0.89)));
      this.config.set('wheelTip', true);
      this.#hideTip();
    }, { passive: false });

    this.on(this.$('#older'), 'click', () => this.#view(this.#viewing + 1));
    this.on(this.$('#newer'), 'click', () => this.#view(this.#viewing - 1));
    this.on(this.$('#save'), 'click', () => this.#save());
    this.on(this.$('#drop'), 'click', () => this.#discard());
    this.on(this.$('#shutview'), 'click', () => this.#closeViewer());

    this.on(this.$('#stage'), 'dblclick', (event) => {
      if (event.target.closest('.hud, .panel, .idle, .viewer, .tray')) return;
      this.#fullscreen();
    });

    this.listen(document, 'fullscreenchange', () => this.#markFullscreen());
    this.on(this, 'keydown', (event) => this.#keys(event));

    this.#apply();
    this.#resume();

    if ('ResizeObserver' in window) {
      const watcher = new ResizeObserver(() => this.#makeRoom());
      watcher.observe(this.$('#stage'));
      this.track(() => watcher.disconnect());
    }
  }

  async #resume() {
    if (this.config.get('auto', true) === false) return;
    try {
      const state = await navigator.permissions?.query({ name: 'camera' });
      if (state?.state === 'granted') this.#start();
    } catch {
      /* permissions query is not everywhere, the button is always there */
    }
  }

  #keys(event) {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const key = event.key.toLowerCase();

    if (key === 'escape') {
      if (!this.$('#viewer').hidden) return this.#closeViewer();
      if (!this.$('#panel').hidden) return this.#showPanel(false);
      if (document.fullscreenElement) document.exitFullscreen();
      return;
    }
    if (!this.#stream && key !== 'c') return;

    if (key === ' ') {
      event.preventDefault();
      return this.#toggleFreeze();
    }
    if (key === 's') return this.#snapshot();
    if (key === 'f') return this.#fullscreen();
    if (key === 't') return this.#delayed();
    if (key === 'l') return this.#showLoupe(!this.#loupe);
    if (key === 'g') return this.#flip('guides');
    if (key === 'm') return this.#flip('flip');
    if (key === 'c') return this.#stream ? this.#stop() : this.#start();
  }

  #flip(key) {
    const entry = TOGGLES.find((item) => item.key === key);
    if (!entry) return;
    const button = this.$(`[data-toggle="${key}"]`);
    const next = button.getAttribute('aria-checked') !== 'true';
    button.setAttribute('aria-checked', String(next));
    this.config.set(key, next);
    this.#apply();
  }

  #checked(key) {
    return this.$(`[data-toggle="${key}"]`)?.getAttribute('aria-checked') === 'true';
  }

  #usePreset(id) {
    const preset = PRESETS.find((item) => item.id === id);
    if (!preset) return;
    for (const key of ['glow', 'warmth']) {
      this.$(`#${key}`).value = String(preset[key]);
      this.config.set(key, preset[key]);
    }
    this.#apply();
  }

  #reset() {
    for (const entry of SLIDERS) {
      this.$(`#${entry.key}`).value = String(entry.fallback);
      this.config.set(entry.key, entry.fallback);
    }
    for (const entry of TOGGLES) {
      this.$(`[data-toggle="${entry.key}"]`).setAttribute('aria-checked', String(entry.fallback));
      this.config.set(entry.key, entry.fallback);
    }
    this.#apply();
  }

  #showTab(id) {
    this.#tab = id;
    for (const tab of this.$$('[data-tab]')) tab.setAttribute('aria-selected', String(tab.dataset.tab === id));
    for (const pane of this.$$('[data-pane]')) pane.hidden = pane.dataset.pane !== id;
  }

  #showPanel(open) {
    const panel = this.$('#panel');
    panel.hidden = !open;
    this.$('#tune').setAttribute('aria-expanded', String(Boolean(open)));
    this.#makeRoom();
  }

  #makeRoom() {
    const stage = this.$('#stage');
    const panel = this.$('#panel');
    if (!stage || !panel) return;
    const open = !panel.hidden;
    stage.dataset.panel = String(open);
    stage.style.setProperty('--room', open ? `${Math.round(panel.getBoundingClientRect().height) + 14}px` : '0px');
  }

  #markFullscreen() {
    const full = Boolean(document.fullscreenElement);
    this.$('#app')?.toggleAttribute('data-full', full);
    const button = this.$('#full');
    if (button) button.innerHTML = icon(full ? 'minimize' : 'maximize', 15);
  }

  #apply() {
    const stage = this.$('#stage');
    if (!stage) return;

    const number = (key) => Number(this.$(`#${key}`).value);
    const glow = number('glow') / 100;
    const warmth = number('warmth') / 100;
    const level = 0.35 + glow * 0.65;
    const green = Math.round(255 - warmth * 24);
    const blue = Math.round(255 - warmth * 66);

    const flood = this.#checked('flood');

    stage.style.setProperty('--light', `rgb(${Math.round(255 * level)} ${Math.round(green * level)} ${Math.round(blue * level)})`);
    stage.style.setProperty('--ring-size', `${number('border')}%`);
    stage.style.setProperty('--preview', `${number('preview')}%`);
    stage.style.setProperty('--zoom', String(number('zoom') / 100));
    stage.style.setProperty('--brightness', String(number('brightness') / 100));
    stage.style.setProperty('--contrast', String(number('contrast') / 100));
    stage.style.setProperty('--flip', this.#checked('flip') ? '-1' : '1');
    stage.style.setProperty('--saturate', this.#checked('mono') ? '0' : '1');
    stage.dataset.flood = String(flood);
    stage.dataset.guides = String(this.#checked('guides'));

    this.$('#field-border').hidden = flood;
    this.$('#field-preview').hidden = !flood;
  }

  async #start(deviceId) {
    const error = this.$('#error');
    error.textContent = '';

    if (!navigator.mediaDevices?.getUserMedia) {
      error.textContent = t('mirror.noCameraHere', 'This browser cannot open a camera here. A secure origin is required.');
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
          ? t('mirror.permissionDeclined', 'Camera permission was declined. Allow it in the browser address bar and try again.')
          : t('mirror.couldNotOpen', 'Could not open the camera: {reason}', { reason: issue.message });
      return;
    }

    const video = this.$('#video');
    video.srcObject = this.#stream;
    await video.play().catch(() => {});

    this.$('#idle').hidden = true;
    this.$('#hud').hidden = false;

    this.#devices = (await navigator.mediaDevices.enumerateDevices()).filter((device) => device.kind === 'videoinput');
    const picker = this.$('#device');
    if (this.#devices.length > 1) {
      picker.options = this.#devices.map((device, index) => ({
        value: device.deviceId,
        label: device.label || t('mirror.cameraNumber', 'Camera {number}', { number: index + 1 }),
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

    clearInterval(this.#timer);
    cancelAnimationFrame(this.#frameId);
    this.#showLoupe(false);
    this.#countdown = 0;
    const count = this.$('#count');
    if (count) count.hidden = true;

    this.#clearFreeze();
    if (this.$('#idle')) this.$('#idle').hidden = false;
    if (this.$('#hud')) this.$('#hud').hidden = true;
    this.#showPanel(false);
    const picker = this.$('#device');
    if (picker) picker.hidden = true;
  }

  #capture() {
    const video = this.$('#video');
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const context = canvas.getContext('2d');
    if (this.#checked('flip')) {
      context.translate(canvas.width, 0);
      context.scale(-1, 1);
    }
    const number = (key) => Number(this.$(`#${key}`).value) / 100;
    context.filter = `brightness(${number('brightness')}) contrast(${number('contrast')}) saturate(${this.#checked('mono') ? 0 : 1})`;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas;
  }

  #clearFreeze() {
    this.$('.freeze')?.remove();
    this.#frozen = false;
    const badge = this.$('#badge');
    if (badge) badge.hidden = true;
    const freeze = this.$('#freeze');
    if (freeze) {
      freeze.innerHTML = icon('pause', 16);
      freeze.title = t('mirror.freeze', 'Freeze');
    }
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
    this.$('#badge').hidden = false;
    const freeze = this.$('#freeze');
    freeze.innerHTML = icon('play', 16);
    freeze.title = t('mirror.unfreeze', 'Unfreeze');
  }

  #delayed() {
    if (!this.#stream) return;
    clearInterval(this.#timer);
    this.#countdown = 3;
    const count = this.$('#count');
    count.hidden = false;
    count.textContent = String(this.#countdown);
    this.#timer = setInterval(() => {
      this.#countdown -= 1;
      if (this.#countdown > 0) {
        count.textContent = String(this.#countdown);
        return;
      }
      clearInterval(this.#timer);
      count.hidden = true;
      this.#snapshot();
    }, 1000);
  }

  #snapshot() {
    if (!this.#stream) return;
    const canvas = this.#capture();
    const frame = this.$('#frame');
    frame.dataset.flash = 'true';
    setTimeout(() => delete frame.dataset.flash, 240);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const shot = { id: this.#seq += 1, blob, url: URL.createObjectURL(blob) };
      this.#shots.unshift(shot);
      while (this.#shots.length > 12) URL.revokeObjectURL(this.#shots.pop().url);
      this.#hold(shot);
      this.#drawTray();
    }, 'image/png');
  }

  #showLoupe(on) {
    this.#loupe = Boolean(on) && Boolean(this.#stream);
    this.$('#glass').setAttribute('aria-pressed', String(this.#loupe));
    const loupe = this.$('#loupe');
    loupe.hidden = !this.#loupe || !this.#loupeAt;
    cancelAnimationFrame(this.#frameId);
    if (this.#loupe) {
      this.#drawLoupe();
      this.#showTip();
    } else {
      this.#hideTip();
    }
  }

  #showTip() {
    if (this.config.get('wheelTip', false) === true) return;
    const tip = this.$('#tip');
    if (!tip) return;
    tip.hidden = false;
    requestAnimationFrame(() => tip.setAttribute('data-here', ''));
    clearTimeout(this.#tipTimer);
    this.#tipTimer = setTimeout(() => this.#hideTip(), 5200);
  }

  #hideTip() {
    const tip = this.$('#tip');
    if (!tip || tip.hidden) return;
    clearTimeout(this.#tipTimer);
    tip.removeAttribute('data-here');
    this.#tipTimer = setTimeout(() => {
      tip.hidden = true;
    }, 320);
  }

  #trackLoupe(event) {
    if (!this.#loupe) return;
    const box = this.$('#frame').getBoundingClientRect();
    this.#loupeAt = { x: event.clientX - box.left, y: event.clientY - box.top };
    const loupe = this.$('#loupe');
    loupe.hidden = false;
    loupe.style.left = `${this.#loupeAt.x}px`;
    loupe.style.top = `${this.#loupeAt.y}px`;
  }

  #drawLoupe() {
    if (!this.#loupe) return;
    this.#frameId = requestAnimationFrame(() => this.#drawLoupe());

    const canvas = this.$('#loupe');
    const video = this.$('#video');
    const spot = this.#loupeAt;
    if (!canvas || !video || !spot || !video.videoWidth) return;

    const box = this.$('#frame').getBoundingClientRect();
    const number = (key) => Number(this.$(`#${key}`).value) / 100;
    const cover = Math.max(box.width / video.videoWidth, box.height / video.videoHeight) * number('zoom');
    const flipped = this.#checked('flip');

    const offX = (flipped ? -1 : 1) * (spot.x - box.width / 2);
    const offY = spot.y - box.height / 2;
    const midX = video.videoWidth / 2 + offX / cover;
    const midY = video.videoHeight / 2 + offY / cover;
    const span = canvas.width / this.#loupeMag / cover;

    const context = canvas.getContext('2d');
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.filter = `brightness(${number('brightness')}) contrast(${number('contrast')}) saturate(${this.#checked('mono') ? 0 : 1})`;
    if (flipped) {
      context.translate(canvas.width, 0);
      context.scale(-1, 1);
    }
    context.drawImage(video, midX - span / 2, midY - span / 2, span, span, 0, 0, canvas.width, canvas.height);
  }

  #hold(shot) {
    const hold = this.$('#hold');
    if (!hold) return;
    clearTimeout(this.#holding);
    hold.style.backgroundImage = `url(${shot.url})`;
    hold.hidden = false;
    hold.removeAttribute('data-away');
    this.#holding = setTimeout(() => {
      hold.setAttribute('data-away', '');
      this.#holding = setTimeout(() => {
        hold.hidden = true;
        hold.style.backgroundImage = '';
      }, 380);
    }, 1200);
  }

  #drawTray() {
    const tray = this.$('#tray');
    if (!tray) return;
    tray.hidden = !this.#shots.length;
    tray.innerHTML = this.#shots
      .map(
        (shot) =>
          `<button class="thumb" type="button" data-shot="${shot.id}" style="background-image:url(${shot.url})" ` +
          `title="${t('mirror.openPhoto', 'Open the photo')}" aria-label="${t('mirror.openPhoto', 'Open the photo')}"></button>`,
      )
      .join('');
  }

  #view(at) {
    if (!this.#shots.length) return this.#closeViewer();
    this.#viewing = Math.max(0, Math.min(this.#shots.length - 1, at));
    const shot = this.#shots[this.#viewing];
    this.$('#viewed').src = shot.url;
    this.$('#viewer').hidden = false;
    this.$('#older').disabled = this.#viewing >= this.#shots.length - 1;
    this.$('#newer').disabled = this.#viewing <= 0;
  }

  #closeViewer() {
    this.$('#viewer').hidden = true;
    this.#viewing = -1;
  }

  #save() {
    const shot = this.#shots[this.#viewing];
    if (!shot) return;
    download(`mirror-${Date.now()}.png`, shot.blob, 'image/png');
  }

  #discard() {
    const shot = this.#shots[this.#viewing];
    if (!shot) return;
    URL.revokeObjectURL(shot.url);
    this.#shots.splice(this.#viewing, 1);
    this.#drawTray();
    if (!this.#shots.length) return this.#closeViewer();
    this.#view(Math.min(this.#viewing, this.#shots.length - 1));
  }

  #fullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else this.$('#app').requestFullscreen?.().catch(() => {});
  }
}

define('jg-app-mirror', Mirror);
