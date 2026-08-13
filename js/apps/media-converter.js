import { JGApp, define, html, css } from '../core/app.js';
import { media } from '../core/media.js';
import { bus } from '../core/bus.js';
import { download, formatBytes } from '../core/util.js';
import { router } from '../core/router.js';

const sheet = css`
  .drop {
    display: grid;
    place-items: center;
    gap: 8px;
    padding: 24px 18px;
    border: 1px dashed var(--border-strong);
    border-radius: var(--radius-lg);
    background: color-mix(in srgb, var(--muted) 40%, transparent);
    text-align: center;
    cursor: pointer;
  }
  .drop[data-over="true"] { border-color: var(--ring); background: color-mix(in srgb, var(--ring) 12%, transparent); }
  .grid3 { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
  .bar {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 12px;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--muted) 60%, transparent);
    font-size: 12.5px;
  }
  .dot { width: 8px; height: 8px; border-radius: 999px; background: var(--muted-foreground); flex: none; }
  .bar[data-status="ready"] .dot { background: var(--success); }
  .bar[data-status="loading"] .dot, .bar[data-status="working"] .dot { background: var(--warning); animation: pulse 1s infinite; }
  .bar[data-status="error"] .dot { background: var(--destructive); }
  @keyframes pulse { 50% { opacity: 0.3; } }
  .track { height: 5px; border-radius: 999px; background: var(--border); overflow: hidden; }
  .track i { display: block; height: 100%; background: var(--ring); transition: width 0.2s ease; }
  .log {
    max-height: 150px;
    overflow: auto;
    padding: 10px;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--muted) 70%, transparent);
    font-family: var(--font-mono);
    font-size: 11px;
    line-height: 1.55;
    white-space: pre-wrap;
    color: var(--muted-foreground);
  }
  video, audio { width: 100%; border-radius: var(--radius-md); background: #000; }
`;

const PRESETS = {
  video: [
    { value: 'mp4', label: 'MP4 (H.264)', ext: 'mp4', args: (o) => ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', String(o.crf), '-c:a', 'aac', '-b:a', `${o.audioBitrate}k`] },
    { value: 'webm', label: 'WebM (VP9)', ext: 'webm', args: (o) => ['-c:v', 'libvpx-vp9', '-crf', String(o.crf), '-b:v', '0', '-c:a', 'libopus'] },
    { value: 'gif', label: 'Animated GIF', ext: 'gif', args: (o) => ['-vf', `fps=${o.fps},scale=${o.width || 480}:-1:flags=lanczos`, '-loop', '0'] },
    { value: 'mute', label: 'Remove audio', ext: 'mp4', args: () => ['-c', 'copy', '-an'] },
    { value: 'frames', label: 'First frame (PNG)', ext: 'png', args: () => ['-frames:v', '1'] },
  ],
  audio: [
    { value: 'mp3', label: 'MP3', ext: 'mp3', args: (o) => ['-vn', '-c:a', 'libmp3lame', '-b:a', `${o.audioBitrate}k`] },
    { value: 'wav', label: 'WAV', ext: 'wav', args: () => ['-vn', '-c:a', 'pcm_s16le'] },
    { value: 'ogg', label: 'OGG (Vorbis)', ext: 'ogg', args: (o) => ['-vn', '-c:a', 'libvorbis', '-b:a', `${o.audioBitrate}k`] },
    { value: 'opus', label: 'Opus', ext: 'opus', args: (o) => ['-vn', '-c:a', 'libopus', '-b:a', `${o.audioBitrate}k`] },
    { value: 'flac', label: 'FLAC', ext: 'flac', args: () => ['-vn', '-c:a', 'flac'] },
  ],
};

class MediaConverter extends JGApp {
  static appId = 'media-converter';
  static styles = [...JGApp.styles, sheet];

  #file = null;
  #result = null;
  #log = [];

  connectedCallback() {
    super.connectedCallback();
    this.keep(bus.on('media:status', () => this.#paintStatus()));
  }

  renderApp() {
    this.paint(html`<div class="app">
      <div class="bar" id="status">
        <span class="dot"></span>
        <span class="grow" id="statustext"></span>
        <jg-button size="sm" variant="outline" id="settings">Engine settings</jg-button>
      </div>

      <div class="drop" id="drop">
        <span class="strong">Drop a video or audio file, or click to choose</span>
        <span class="hint">Transcoding runs locally through WebAssembly. Large files take a while.</span>
      </div>

      <div id="details" hidden>
        <div class="stack">
          <div class="spread">
            <span class="strong" id="filename"></span>
            <span class="hint" id="filesize"></span>
          </div>

          <div class="grid3">
            <jg-field label="Output">
              <jg-select id="preset"></jg-select>
            </jg-field>
            <jg-field label="Quality (CRF)" hint="Lower is better quality">
              <jg-slider id="crf" min="18" max="40" value="28"></jg-slider>
            </jg-field>
            <jg-field label="Audio bitrate">
              <jg-select id="audioBitrate" value="128">
                <option value="96">96 kbps</option><option value="128">128 kbps</option>
                <option value="192">192 kbps</option><option value="320">320 kbps</option>
              </jg-select>
            </jg-field>
            <jg-field label="Width" hint="0 keeps the original">
              <jg-input id="width" type="number" min="0" max="4096" value="0" suffix="px"></jg-input>
            </jg-field>
            <jg-field label="GIF frame rate">
              <jg-input id="fps" type="number" min="5" max="30" value="12" suffix="fps"></jg-input>
            </jg-field>
            <jg-field label="Trim" hint="Start and duration in seconds">
              <div class="row tight nowrap">
                <jg-input id="start" type="number" min="0" value="0" class="grow"></jg-input>
                <jg-input id="duration" type="number" min="0" value="0" class="grow"></jg-input>
              </div>
            </jg-field>
          </div>

          <div class="row">
            <jg-button id="convert">Convert</jg-button>
            <jg-button id="save" variant="outline" hidden>Save result</jg-button>
            <span class="grow"></span>
            <span class="hint" id="resultinfo"></span>
          </div>

          <div class="track"><i id="progress" style="width:0%"></i></div>
          <div id="preview"></div>
          <div class="log" id="log"></div>
        </div>
      </div>
    </div>`);

    const drop = this.$('#drop');
    this.on(drop, 'click', () => this.#pick());
    this.on(drop, 'dragover', (event) => {
      event.preventDefault();
      drop.dataset.over = 'true';
    });
    this.on(drop, 'dragleave', () => {
      drop.dataset.over = 'false';
    });
    this.on(drop, 'drop', (event) => {
      event.preventDefault();
      drop.dataset.over = 'false';
      const file = [...event.dataTransfer.files].find((item) => /^(video|audio)\//.test(item.type));
      if (file) this.#load(file);
    });

    this.on(this.$('#settings'), 'click', () => router.app('settings'));
    this.on(this.$('#convert'), 'click', () => this.#convert());
    this.on(this.$('#save'), 'click', () => {
      if (this.#result) download(this.#result.name, this.#result.blob);
    });

    this.#paintStatus();
  }

  #paintStatus() {
    const bar = this.$('#status');
    if (!bar) return;
    const state = media.state();
    bar.dataset.status = state.status;
    this.$('#statustext').textContent =
      state.status === 'idle'
        ? 'Encoder not loaded yet. It downloads the first time you convert.'
        : state.message || state.status;
  }

  #pick() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/*,audio/*';
    input.onchange = () => input.files[0] && this.#load(input.files[0]);
    input.click();
  }

  #load(file) {
    this.#file = file;
    this.#result = null;
    this.#log = [];
    const isAudio = file.type.startsWith('audio/');

    this.$('#details').hidden = false;
    this.$('#filename').textContent = file.name;
    this.$('#filesize').textContent = `${formatBytes(file.size)} · ${file.type || 'unknown type'}`;
    this.$('#preset').options = (isAudio ? PRESETS.audio : PRESETS.video).map((preset) => ({
      value: preset.value,
      label: preset.label,
    }));
    this.$('#save').hidden = true;
    this.$('#resultinfo').textContent = '';
    this.$('#log').textContent = '';
    this.$('#progress').style.width = '0%';

    const preview = this.$('#preview');
    preview.innerHTML = isAudio
      ? `<audio controls src="${URL.createObjectURL(file)}"></audio>`
      : `<video controls src="${URL.createObjectURL(file)}"></video>`;
  }

  async #convert() {
    if (!this.#file) return;
    const isAudio = this.#file.type.startsWith('audio/');
    const list = isAudio ? PRESETS.audio : PRESETS.video;
    const preset = list.find((item) => item.value === this.$('#preset').value) ?? list[0];

    const options = {
      crf: Number(this.$('#crf').value),
      audioBitrate: Number(this.$('#audioBitrate').value),
      width: Number(this.$('#width').value),
      fps: Number(this.$('#fps').value),
    };

    const args = [];
    const start = Number(this.$('#start').value);
    const duration = Number(this.$('#duration').value);
    if (start > 0) args.push('-ss', String(start));
    if (duration > 0) args.push('-t', String(duration));
    args.push(...preset.args(options));
    if (options.width > 0 && preset.value !== 'gif' && !isAudio) args.push('-vf', `scale=${options.width}:-2`);

    const output = `output.${preset.ext}`;
    const logNode = this.$('#log');
    const progress = this.$('#progress');
    this.$('#convert').setAttribute('disabled', '');

    try {
      const blob = await media.run({
        file: this.#file,
        args,
        output,
        onProgress: (value) => {
          progress.style.width = `${value}%`;
        },
        onLog: (message) => {
          this.#log = [...this.#log, message].slice(-200);
          logNode.textContent = this.#log.join('\n');
          logNode.scrollTop = logNode.scrollHeight;
        },
      });

      this.#result = { blob, name: `${this.#file.name.replace(/\.[^.]+$/, '')}.${preset.ext}` };
      progress.style.width = '100%';
      this.$('#save').hidden = false;
      const change = ((blob.size / this.#file.size - 1) * 100).toFixed(0);
      this.$('#resultinfo').textContent = `${formatBytes(blob.size)} (${change > 0 ? '+' : ''}${change}%)`;

      const preview = this.$('#preview');
      const url = URL.createObjectURL(blob);
      if (preset.ext === 'gif' || preset.ext === 'png') preview.innerHTML = `<img src="${url}" style="max-width:100%;border-radius:10px">`;
      else if (isAudio || preset.ext === 'mp3') preview.innerHTML = `<audio controls src="${url}"></audio>`;
      else preview.innerHTML = `<video controls src="${url}"></video>`;
    } catch (error) {
      logNode.textContent = `${this.#log.join('\n')}\n\n${error.message}`;
    } finally {
      this.$('#convert')?.removeAttribute('disabled');
    }
  }
}

define('jg-app-media-converter', MediaConverter);
