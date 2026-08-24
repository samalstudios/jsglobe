import { JGApp, define, html, styleSheet } from '../../core/app.js';
import { appText } from '../../core/i18n.js';
import strings from './i18n.js';
import { icon } from '../../ui/icons.js';
import { toast, copyText } from '../../core/util.js';
import { scanQrImage, binarize } from '../../lib/qr-decode.js';
import { scanBarcodeBitmap } from '../../lib/barcode.js';

const t = appText(strings);
const sheet = await styleSheet(import.meta.url);

const KINDS = {
  url: { label: () => t('scanner.link', 'Link'), icon: 'link' },
  wifi: { label: () => t('scanner.wiFiNetwork', 'Wi-Fi network'), icon: 'wifi' },
  email: { label: () => t('scanner.email', 'Email'), icon: 'mail' },
  phone: { label: () => t('scanner.phone', 'Phone'), icon: 'phone' },
  sms: { label: () => t('scanner.message', 'Message'), icon: 'message' },
  geo: { label: () => t('scanner.location', 'Location'), icon: 'pin' },
  contact: { label: () => t('scanner.contact', 'Contact'), icon: 'user' },
  event: { label: () => t('scanner.event', 'Event'), icon: 'calendar' },
  text: { label: () => t('scanner.text', 'Text'), icon: 'type' },
};

const unescapeWifi = (value) => value.replace(/\\([\;,:"])/g, '$1');

const readWifi = (text) => {
  const fields = {};
  const body = text.slice(5);
  let key = '';
  let value = '';
  let at = 0;
  while (at < body.length) {
    const character = body[at];
    if (character === '\\') {
      value += body[at + 1] ?? '';
      at += 2;
      continue;
    }
    if (character === ':' && !key) {
      key = value;
      value = '';
      at += 1;
      continue;
    }
    if (character === ';') {
      if (key) fields[key.toUpperCase()] = value;
      key = '';
      value = '';
      at += 1;
      continue;
    }
    value += character;
    at += 1;
  }
  return { ssid: fields.S ?? '', password: fields.P ?? '', security: fields.T ?? 'nopass', hidden: fields.H === 'true' };
};

const classify = (text) => {
  const trimmed = text.trim();
  if (/^https?:\/\//i.test(trimmed)) return { kind: 'url', open: trimmed };
  if (/^WIFI:/i.test(trimmed)) return { kind: 'wifi', wifi: readWifi(trimmed) };
  if (/^mailto:/i.test(trimmed)) return { kind: 'email', open: trimmed };
  if (/^tel:/i.test(trimmed)) return { kind: 'phone', open: trimmed };
  if (/^smsto:/i.test(trimmed) || /^sms:/i.test(trimmed)) return { kind: 'sms' };
  if (/^geo:/i.test(trimmed)) return { kind: 'geo', open: trimmed };
  if (/^BEGIN:VCARD/i.test(trimmed)) return { kind: 'contact' };
  if (/^BEGIN:(VCALENDAR|VEVENT)/i.test(trimmed)) return { kind: 'event' };
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return { kind: 'url', open: trimmed };
  return { kind: 'text' };
};

const summarise = (text, kind, extra) => {
  if (kind === 'wifi') {
    const { ssid, security } = extra.wifi;
    return t('scanner.joinNetwork', 'Network {name}, {security}', { name: ssid || '?', security: security === 'nopass' ? t('scanner.open', 'open') : security });
  }
  if (kind === 'contact') {
    const name = /(?:^|\n)FN:(.*)/i.exec(text)?.[1]?.trim();
    return name || t('scanner.contactCard', 'Contact card');
  }
  if (kind === 'event') {
    const title = /(?:^|\n)SUMMARY:(.*)/i.exec(text)?.[1]?.trim();
    return title || t('scanner.calendarEvent', 'Calendar event');
  }
  return text.length > 140 ? `${text.slice(0, 140)}…` : text;
};

class Scanner extends JGApp {
  static appId = 'scanner';
  static settings = [
    { key: 'beep', label: t('scanner.soundOnAHit', 'Sound on a hit'), type: 'switch', default: true },
    { key: 'keepScanning', label: t('scanner.keepScanningAfterAHit', 'Keep scanning after a hit'), type: 'switch', default: true },
    { key: 'mirror', label: t('scanner.mirrorTheCamera', 'Mirror the camera'), type: 'switch', default: false },
  ];
  static styles = [...JGApp.styles, sheet];

  #stream = null;
  #timer = null;
  #results = [];
  #lastText = '';
  #lastAt = 0;
  #source = 'idle';
  #still = null;

  renderApp() {
    this.paint(html`<div class="app">
      <div class="head"><jg-toolbar id="bar"></jg-toolbar></div>
      <div class="body">
        <div class="stage" id="stage">
          <video id="feed" playsinline muted autoplay></video>
          <canvas id="still" hidden></canvas>
          <div class="reticle" aria-hidden="true"><span></span><span></span><span></span><span></span></div>
          <div class="curtain" id="curtain">
            ${icon('scan', 44)}
            <p class="lead">${t('scanner.pointSomethingAtIt', 'Point a code at the camera, drop a picture here, or paste one.')}</p>
            <div class="row">
              <jg-button size="sm" id="go-camera">${t('scanner.openTheCamera', 'Open the camera')}</jg-button>
              <jg-button size="sm" variant="outline" id="go-file">${t('scanner.chooseAPicture', 'Choose a picture')}</jg-button>
              <jg-button size="sm" variant="outline" id="go-screen">${t('scanner.captureTheScreen', 'Capture the screen')}</jg-button>
            </div>
          </div>
          <div class="note" id="note"></div>
        </div>
        <aside class="side">
          <div class="label">${t('scanner.found', 'Found')}</div>
          <div class="list" id="list"></div>
        </aside>
      </div>
      <input type="file" id="file" accept="image/*" hidden multiple />
    </div>`);

    this.#toolbar();
    this.#wire();
    this.#paintResults();
  }

  #toolbar() {
    this.$('#bar').items = [
      { id: 'camera', label: t('scanner.camera', 'Camera'), icon: 'camera', action: () => this.#openCamera() },
      { id: 'file', label: t('scanner.picture', 'Picture'), icon: 'image', action: () => this.$('#file').click() },
      { id: 'screen', label: t('scanner.screen', 'Screen'), icon: 'monitor', action: () => this.#openScreen() },
      { separator: true },
      { id: 'stop', label: t('scanner.stop', 'Stop'), icon: 'close', iconOnly: true, title: t('scanner.stopScanning', 'Stop scanning'), action: () => this.#stop() },
      { spacer: true },
      { id: 'clear', label: t('scanner.clear', 'Clear'), icon: 'eraser', iconOnly: true, title: t('scanner.clearTheList', 'Clear the list'), action: () => this.#clear() },
    ];
  }

  #wire() {
    const pane = this.$('.app');
    this.on(pane, 'click', (event) => {
      if (event.target.closest('#go-camera')) this.#openCamera();
      else if (event.target.closest('#go-file')) this.$('#file').click();
      else if (event.target.closest('#go-screen')) this.#openScreen();
    });

    this.on(this.$('#file'), 'change', (event) => {
      const files = [...(event.target.files ?? [])];
      event.target.value = '';
      files.forEach((file) => this.#readFile(file));
    });

    const stage = this.$('#stage');
    this.on(stage, 'dragover', (event) => {
      event.preventDefault();
      stage.classList.add('over');
    });
    this.on(stage, 'dragleave', () => stage.classList.remove('over'));
    this.on(stage, 'drop', (event) => {
      event.preventDefault();
      stage.classList.remove('over');
      const files = [...(event.dataTransfer?.files ?? [])].filter((file) => file.type.startsWith('image/'));
      files.forEach((file) => this.#readFile(file));
    });

    this.listen(window, 'paste', (event) => {
      if (this.offsetParent === null) return;
      const items = [...(event.clipboardData?.items ?? [])];
      const picture = items.find((item) => item.type.startsWith('image/'));
      if (!picture) return;
      event.preventDefault();
      const file = picture.getAsFile();
      if (file) this.#readFile(file);
    });

    const list = this.$('#list');
    this.on(list, 'click', (event) => {
      const copy = event.target.closest('[data-copy]');
      if (copy) {
        copyText(this.#results[Number(copy.dataset.copy)].text);
        toast(t('scanner.copied', 'Copied'));
        return;
      }
      const drop = event.target.closest('[data-drop]');
      if (drop) {
        this.#results.splice(Number(drop.dataset.drop), 1);
        this.#paintResults();
      }
    });

    this.track(() => this.#stop());
  }

  #say(message, tone = '') {
    const note = this.$('#note');
    if (!note) return;
    note.textContent = message ?? '';
    note.className = `note${tone ? ` ${tone}` : ''}`;
  }

  #curtain(show) {
    const curtain = this.$('#curtain');
    if (curtain) curtain.hidden = !show;
  }

  async #openCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      this.#say(t('scanner.noCameraHere', 'This browser cannot open a camera here. A secure origin is needed.'), 'bad');
      return;
    }
    this.#stop();
    try {
      this.#stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
        audio: false,
      });
    } catch (issue) {
      this.#say(
        issue.name === 'NotAllowedError'
          ? t('scanner.cameraDeclined', 'Camera permission was declined. Allow it in the address bar and try again.')
          : t('scanner.cameraFailed', 'Could not open the camera: {reason}', { reason: issue.message }),
        'bad',
      );
      return;
    }
    this.#source = 'camera';
    this.#play();
  }

  async #openScreen() {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      this.#say(t('scanner.noScreenHere', 'This browser cannot capture the screen here.'), 'bad');
      return;
    }
    this.#stop();
    try {
      this.#stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    } catch (issue) {
      if (issue.name !== 'NotAllowedError') this.#say(t('scanner.screenFailed', 'Could not capture the screen: {reason}', { reason: issue.message }), 'bad');
      return;
    }
    this.#source = 'screen';
    this.#play();
  }

  #play() {
    const feed = this.$('#feed');
    const still = this.$('#still');
    still.hidden = true;
    feed.hidden = false;
    feed.classList.toggle('flip', this.#source === 'camera' && this.config.get('mirror', false));
    feed.srcObject = this.#stream;
    feed.play?.().catch(() => {});
    this.#curtain(false);
    this.#say(this.#source === 'screen' ? t('scanner.watchingTheScreen', 'Watching the screen for codes') : t('scanner.watchingTheCamera', 'Watching the camera for codes'));
    this.#stream.getVideoTracks().forEach((track) => track.addEventListener('ended', () => this.#stop()));
    this.#timer = setInterval(() => this.#tick(), 120);
  }

  #stop() {
    if (this.#timer) clearInterval(this.#timer);
    this.#timer = null;
    if (this.#stream) this.#stream.getTracks().forEach((track) => track.stop());
    this.#stream = null;
    this.#source = 'idle';
    const feed = this.$('#feed');
    if (feed) feed.srcObject = null;
    if (!this.#still) this.#curtain(true);
    this.#say('');
  }

  #tick() {
    const feed = this.$('#feed');
    if (!feed || !feed.videoWidth) return;
    const wide = Math.min(1000, feed.videoWidth);
    const tall = Math.round((feed.videoHeight / feed.videoWidth) * wide);
    const canvas = document.createElement('canvas');
    canvas.width = wide;
    canvas.height = tall;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(feed, 0, 0, wide, tall);
    this.#examine(context.getImageData(0, 0, wide, tall));
  }

  async #readFile(file) {
    try {
      const bitmap = await createImageBitmap(file);
      const wide = Math.min(1600, bitmap.width);
      const tall = Math.round((bitmap.height / bitmap.width) * wide);
      const canvas = document.createElement('canvas');
      canvas.width = wide;
      canvas.height = tall;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.drawImage(bitmap, 0, 0, wide, tall);
      bitmap.close?.();

      this.#stop();
      const still = this.$('#still');
      still.width = wide;
      still.height = tall;
      still.getContext('2d').drawImage(canvas, 0, 0);
      still.hidden = false;
      this.$('#feed').hidden = true;
      this.#still = file.name ?? 'image';
      this.#curtain(false);

      const found = this.#examine(context.getImageData(0, 0, wide, tall), true);
      if (!found) this.#say(t('scanner.nothingInThatPicture', 'No code found in that picture. Try a sharper or closer shot.'), 'bad');
      else this.#say(t('scanner.readFromPicture', 'Read from {name}', { name: this.#still }));
    } catch {
      this.#say(t('scanner.couldNotOpenPicture', 'That file could not be opened as a picture.'), 'bad');
    }
  }

  #examine(image, always = false) {
    let hit = null;
    const qr = scanQrImage(image);
    if (qr) hit = { text: qr.text, format: `QR ${qr.version}-${qr.level}`, repaired: qr.repaired };
    if (!hit) {
      const bar = scanBarcodeBitmap(binarize(image));
      if (bar) hit = { text: bar.text, format: bar.format };
    }
    if (!hit) return false;

    const now = Date.now();
    if (!always && hit.text === this.#lastText && now - this.#lastAt < 2500) return true;
    this.#lastText = hit.text;
    this.#lastAt = now;
    this.#add(hit);
    if (!this.config.get('keepScanning', true)) this.#stop();
    return true;
  }

  #add(hit) {
    const extra = classify(hit.text);
    this.#results.unshift({ ...hit, ...extra, at: Date.now() });
    this.#results = this.#results.slice(0, 60);
    this.#paintResults();
    if (this.config.get('beep', true)) this.#beep();
    navigator.vibrate?.(40);
  }

  #beep() {
    try {
      const audio = new (window.AudioContext ?? window.webkitAudioContext)();
      const tone = audio.createOscillator();
      const level = audio.createGain();
      tone.frequency.value = 880;
      level.gain.value = 0.05;
      tone.connect(level).connect(audio.destination);
      tone.start();
      tone.stop(audio.currentTime + 0.08);
      setTimeout(() => audio.close(), 300);
    } catch {
      this.#say('');
    }
  }

  #clear() {
    this.#results = [];
    this.#lastText = '';
    this.#paintResults();
  }

  #paintResults() {
    const list = this.$('#list');
    if (!list) return;
    if (!this.#results.length) {
      list.innerHTML = html`<div class="hint">${t('scanner.nothingYet', 'Codes you read will collect here.')}</div>`;
      return;
    }

    list.innerHTML = html`${this.#results.map((entry, index) => {
      const kind = KINDS[entry.kind] ?? KINDS.text;
      return html`<article class="hit">
        <header>
          <span class="badge">${icon(kind.icon, 13)}${kind.label()}</span>
          <span class="format">${entry.format}</span>
        </header>
        <p class="what">${summarise(entry.text, entry.kind, entry)}</p>
        ${entry.kind === 'wifi'
          ? html`<p class="detail">${t('scanner.password', 'Password')}: <code>${entry.wifi.password || '—'}</code></p>`
          : ''}
        <div class="row">
          ${entry.open ? html`<a class="act" href="${entry.open}" target="_blank" rel="noopener noreferrer">${icon('link', 13)}${t('scanner.open', 'Open')}</a>` : ''}
          <button class="act" data-copy="${index}">${icon('copy', 13)}${t('scanner.copy', 'Copy')}</button>
          <button class="act ghost" data-drop="${index}">${icon('eraser', 13)}${t('scanner.remove', 'Remove')}</button>
        </div>
      </article>`;
    })}`;
  }

  renderWidget() {
    this.paint(html`<div class="app" style="padding:12px">
      <div class="stack tight">
        <div class="label">${t('scanner.codeScanner', 'Code Scanner')}</div>
        <div class="hint">${t('scanner.widgetBlurb', 'Read QR codes and bar codes with the camera or from a picture.')}</div>
      </div>
    </div>`);
  }
}

define('jg-app-scanner', Scanner);
