import { JGApp, define, html, styleSheet } from '../../core/app.js';
import { appText } from '../../core/i18n.js';
import strings from './i18n.js';
import { blobs } from '../../core/blobs.js';
import { speech } from '../../core/speech.js';
import { ai } from '../../core/ai.js';
import { bus } from '../../core/bus.js';
import { download, formatBytes, copyText, toast, uid } from '../../core/util.js';

const t = appText(strings);

const sheet = await styleSheet(import.meta.url);

const clock = (seconds) => {
  const total = Math.floor(seconds);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

const ACTIONS = [
  ['Summarise', 'Summarise this transcript in at most five bullet points.'],
  ['Action items', 'List the action items in this transcript as a short checklist. If there are none, say so.'],
  ['Clean up', 'Rewrite this transcript into clean prose. Remove filler words and false starts, keep the meaning and the speaker voice.'],
  ['Key points', 'Pull out the decisions and key facts from this transcript as a short list.'],
];

class VoiceRecorder extends JGApp {
  static appId = 'voice-recorder';
  static settings = [
    { key: 'live', label: t('voice-recorder.liveCaptionsWhileRecording', 'Live captions while recording'), type: 'switch', default: true },
    { key: 'language', label: t('voice-recorder.transcriptionLanguage', 'Transcription language'), type: 'select', default: 'auto', options: [
      { value: 'auto', label: t('voice-recorder.detect', 'Detect') },
      { value: 'english', label: t('voice-recorder.english', 'English') },
      { value: 'spanish', label: t('voice-recorder.spanish', 'Spanish') },
      { value: 'french', label: t('voice-recorder.french', 'French') },
      { value: 'german', label: t('voice-recorder.german', 'German') },
      { value: 'persian', label: t('voice-recorder.farsi', 'Farsi') },
      { value: 'arabic', label: t('voice-recorder.arabic', 'Arabic') },
      { value: 'japanese', label: t('voice-recorder.japanese', 'Japanese') },
    ] },
  ];
  static styles = [...JGApp.styles, sheet];

  #stream = null;
  #recorder = null;
  #chunks = [];
  #startedAt = 0;
  #elapsed = 0;
  #timer = null;
  #frame = null;
  #analyser = null;
  #context = null;
  #recognition = null;
  #live = '';
  #open = null;
  #items = [];

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#teardown();
  }

  connectedCallback() {
    super.connectedCallback();
    this.keep(bus.on('speech:status', () => this.#paintEngine()));
  }

  renderApp() {
    this.paint(html`<div class="app">
      <div class="recorder">
        <canvas class="wave" id="wave"></canvas>
        <div class="rec-row">
          <span class="dot" id="dot" hidden></span>
          <span class="timer" id="timer">00:00</span>
          <span class="grow"></span>
          <jg-button id="record">${t('voice-recorder.record', 'Record')}</jg-button>
          <jg-button id="pause" variant="outline" hidden>${t('voice-recorder.pause', 'Pause')}</jg-button>
          <jg-button id="stop" variant="outline" hidden>${t('voice-recorder.stop', 'Stop')}</jg-button>
        </div>
        <div class="engine">
          <jg-switch id="liveText" ${this.config.get('live', true) ? 'checked' : ''}></jg-switch>
          <span>${t('voice-recorder.liveCaptionsWhileRecording', 'Live captions while recording')}</span>
          <span class="grow"></span>
          <span id="engine"></span>
        </div>
        <div class="transcript" id="livetext" hidden></div>
      </div>

      <div class="spread">
        <span class="label">${t('voice-recorder.recordings', 'Recordings')}</span>
        <span class="row tight">
          <jg-select id="language" value="${this.config.get('language', 'auto')}" size="sm" style="width:150px">
            <option value="auto">${t('voice-recorder.detectLanguage', 'Detect language')}</option>
            <option value="english">${t('voice-recorder.english', 'English')}</option>
            <option value="spanish">${t('voice-recorder.spanish', 'Spanish')}</option>
            <option value="french">${t('voice-recorder.french', 'French')}</option>
            <option value="german">${t('voice-recorder.german', 'German')}</option>
            <option value="persian">${t('voice-recorder.farsi', 'Farsi')}</option>
            <option value="arabic">${t('voice-recorder.arabic', 'Arabic')}</option>
            <option value="japanese">${t('voice-recorder.japanese', 'Japanese')}</option>
          </jg-select>
          <jg-button size="sm" variant="ghost" id="clear">${t('voice-recorder.clearAll', 'Clear all')}</jg-button>
        </span>
      </div>

      <div class="stack tight" id="list"></div>
      <div class="hint" id="error"></div>
    </div>`);

    this.on(this.$('#record'), 'click', () => this.#start());
    this.on(this.$('#pause'), 'click', () => this.#pause());
    this.on(this.$('#stop'), 'click', () => this.#stop());
    this.on(this.$('#liveText'), 'change', (event) => this.config.set('live', event.detail.checked));
    this.on(this.$('#language'), 'change', (event) => this.config.set('language', event.detail.value));
    this.on(this.$('#clear'), 'click', async () => {
      if (!confirm('Delete every recording in this workspace?')) return;
      await blobs.clear(VoiceRecorder.appId);
      this.#load();
    });

    this.#paintEngine();
    this.#drawIdle();
    this.#load();
  }

  #paintEngine() {
    const node = this.$('#engine');
    if (!node) return;
    const state = speech.state();
    node.textContent =
      state.status === 'idle'
        ? speech.supportsBrowser()
          ? 'Whisper loads on first transcription'
          : 'Whisper loads on first transcription (no browser captions here)'
        : state.message || state.status;
  }

  async #load() {
    this.#items = await blobs.list(VoiceRecorder.appId);
    this.#paintList();
  }

  #paintList() {
    const list = this.$('#list');
    if (!this.#items.length) {
      list.innerHTML = html`<jg-empty glyph="●" title="${t('voice-recorder.noRecordingsYet', 'No recordings yet')}">
        Recordings stay in this browser. Nothing is uploaded unless you turn on browser captions.
      </jg-empty>`;
      return;
    }

    list.innerHTML = this.#items
      .map((item) => {
        const open = this.#open === item.id;
        return html`<div class="item" data-id="${item.id}" data-open="${String(open)}">
          <span>
            <span class="name">${item.name}</span>
            <span class="meta">${clock(item.duration)} · ${formatBytes(item.size)} · ${new Date(item.created).toLocaleString()}</span>
          </span>
          <span class="row tight">
            <jg-button size="sm" variant="outline" data-transcribe="${item.id}">
              ${item.transcript ? 'Re-transcribe' : 'Transcribe'}
            </jg-button>
            <jg-button size="icon-sm" variant="ghost" data-toggle="${item.id}" title="${t('voice-recorder.details', 'Details')}">${open ? '▴' : '▾'}</jg-button>
            <jg-button size="icon-sm" variant="ghost" data-save="${item.id}" title="${t('voice-recorder.download', 'Download')}">↓</jg-button>
            <jg-button size="icon-sm" variant="ghost" data-remove="${item.id}" title="${t('voice-recorder.delete', 'Delete')}">✕</jg-button>
          </span>
          ${open
            ? html`<span class="body">
                <audio controls src="${URL.createObjectURL(item.blob)}"></audio>
                <span class="transcript" data-text="${item.id}">${item.transcript || 'Not transcribed yet.'}</span>
                ${item.transcript
                  ? html`<span class="row tight">
                      ${ACTIONS.map((action) => html`<jg-button size="sm" variant="ghost" data-ai="${item.id}" data-prompt="${action[1]}">${action[0]}</jg-button>`)}
                      <span class="grow"></span>
                      <jg-button size="sm" variant="ghost" data-copy="${item.id}">${t('voice-recorder.copy', 'Copy')}</jg-button>
                      <jg-button size="sm" variant="ghost" data-export="${item.id}">${t('voice-recorder.saveText', 'Save text')}</jg-button>
                    </span>`
                  : ''}
              </span>`
            : ''}
        </div>`;
      })
      .join('');

    this.bind('[data-toggle]', 'click', (event) => {
      const id = event.currentTarget.dataset.toggle;
      this.#open = this.#open === id ? null : id;
      this.#paintList();
    });
    this.bind('[data-save]', 'click', (event) => {
      const item = this.#items.find((entry) => entry.id === event.currentTarget.dataset.save);
      download(`${item.name}.webm`, item.blob);
    });
    this.bind('[data-remove]', 'click', async (event) => {
      await blobs.remove(event.currentTarget.dataset.remove);
      this.#load();
    });
    this.bind('[data-transcribe]', 'click', (event) => this.#transcribe(event.currentTarget.dataset.transcribe));
    this.bind('[data-copy]', 'click', (event) => {
      const item = this.#items.find((entry) => entry.id === event.currentTarget.dataset.copy);
      copyText(item.transcript);
    });
    this.bind('[data-export]', 'click', (event) => {
      const item = this.#items.find((entry) => entry.id === event.currentTarget.dataset.export);
      download(`${item.name}.txt`, item.transcript, 'text/plain');
    });
    this.bind('[data-ai]', 'click', (event) => this.#assist(event.currentTarget.dataset.ai, event.currentTarget.dataset.prompt));
  }

  async #start() {
    const error = this.$('#error');
    error.textContent = '';

    if (!navigator.mediaDevices?.getUserMedia) {
      error.textContent = 'This browser cannot open a microphone here.';
      return;
    }

    try {
      this.#stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (issue) {
      error.textContent =
        issue.name === 'NotAllowedError'
          ? 'Microphone permission was declined. Allow it in the address bar and try again.'
          : `Could not open the microphone: ${issue.message}`;
      return;
    }

    this.#chunks = [];
    this.#elapsed = 0;
    this.#startedAt = performance.now();
    this.#live = '';

    this.#recorder = new MediaRecorder(this.#stream, { mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : undefined });
    this.#recorder.ondataavailable = (event) => event.data.size && this.#chunks.push(event.data);
    this.#recorder.onstop = () => this.#save();
    this.#recorder.start(250);

    this.#context = new (window.AudioContext ?? window.webkitAudioContext)();
    const source = this.#context.createMediaStreamSource(this.#stream);
    this.#analyser = this.#context.createAnalyser();
    this.#analyser.fftSize = 1024;
    source.connect(this.#analyser);
    this.#draw();

    this.#timer = setInterval(() => this.#tick(), 200);
    this.track(() => clearInterval(this.#timer));

    this.$('#record').hidden = true;
    this.$('#pause').hidden = false;
    this.$('#stop').hidden = false;
    this.$('#dot').hidden = false;

    if (this.$('#liveText').checked && speech.supportsBrowser()) {
      const panel = this.$('#livetext');
      panel.hidden = false;
      panel.textContent = 'Listening...';
      try {
        this.#recognition = speech.listen({
          onPartial: (text) => {
            this.#live = text;
            panel.textContent = text;
          },
          onFinal: (text) => {
            this.#live = text || this.#live;
          },
        });
      } catch {
        panel.hidden = true;
      }
    }
  }

  #tick() {
    if (this.#recorder?.state === 'recording') {
      const seconds = this.#elapsed + (performance.now() - this.#startedAt) / 1000;
      this.$('#timer').textContent = clock(seconds);
    }
  }

  #pause() {
    if (!this.#recorder) return;
    if (this.#recorder.state === 'recording') {
      this.#recorder.pause();
      this.#elapsed += (performance.now() - this.#startedAt) / 1000;
      this.$('#pause').textContent = 'Resume';
      this.$('#dot').hidden = true;
    } else {
      this.#recorder.resume();
      this.#startedAt = performance.now();
      this.$('#pause').textContent = 'Pause';
      this.$('#dot').hidden = false;
    }
  }

  #stop() {
    if (this.#recorder?.state !== 'inactive') {
      this.#elapsed += this.#recorder.state === 'recording' ? (performance.now() - this.#startedAt) / 1000 : 0;
      this.#recorder.stop();
    }
    this.#recognition?.stop();
    this.#recognition = null;
  }

  async #save() {
    const blob = new Blob(this.#chunks, { type: this.#recorder.mimeType || 'audio/webm' });
    const record = {
      id: uid(),
      name: `Recording ${new Date().toLocaleString()}`,
      blob,
      size: blob.size,
      duration: this.#elapsed,
      created: Date.now(),
      transcript: this.#live || '',
    };
    await blobs.put(VoiceRecorder.appId, record);

    this.#teardown();
    this.$('#record').hidden = false;
    this.$('#pause').hidden = true;
    this.$('#pause').textContent = 'Pause';
    this.$('#stop').hidden = true;
    this.$('#dot').hidden = true;
    this.$('#timer').textContent = '00:00';
    this.$('#livetext').hidden = true;
    this.#drawIdle();
    this.#open = record.id;
    this.#load();
    toast(t('voice-recorder.recordingSaved', 'Recording saved'), 'success');
  }

  #teardown() {
    cancelAnimationFrame(this.#frame);
    clearInterval(this.#timer);
    this.#stream?.getTracks().forEach((track) => track.stop());
    this.#stream = null;
    this.#analyser = null;
    this.#context?.close().catch(() => {});
    this.#context = null;
    this.#recognition?.stop();
    this.#recognition = null;
  }

  #canvas() {
    const canvas = this.$('#wave');
    const ratio = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * ratio;
    canvas.height = canvas.clientHeight * ratio;
    return { canvas, context: canvas.getContext('2d'), ratio };
  }

  #drawIdle() {
    const { canvas, context } = this.#canvas();
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = getComputedStyle(this).getPropertyValue('--border-strong').trim() || '#8884';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(0, canvas.height / 2);
    context.lineTo(canvas.width, canvas.height / 2);
    context.stroke();
  }

  #draw() {
    const { canvas, context } = this.#canvas();
    const buffer = new Uint8Array(this.#analyser.frequencyBinCount);
    const accent = getComputedStyle(this).getPropertyValue('--ring').trim() || '#8a1c3b';

    const render = () => {
      this.#frame = requestAnimationFrame(render);
      if (!this.#analyser) return;
      this.#analyser.getByteFrequencyData(buffer);

      context.clearRect(0, 0, canvas.width, canvas.height);
      const bars = 56;
      const step = Math.floor(buffer.length / bars);
      const width = canvas.width / bars;
      context.fillStyle = accent;

      for (let i = 0; i < bars; i += 1) {
        const value = buffer[i * step] / 255;
        const height = Math.max(3, value * canvas.height * 0.92);
        const x = i * width;
        const y = (canvas.height - height) / 2;
        context.beginPath();
        context.roundRect(x + width * 0.22, y, width * 0.56, height, width * 0.28);
        context.fill();
      }
    };

    render();
  }

  async #transcribe(id) {
    const item = this.#items.find((entry) => entry.id === id);
    if (!item) return;
    this.#open = id;
    this.#paintList();
    const target = this.$(`[data-text="${id}"]`);
    if (target) target.textContent = 'Loading the speech model...';

    try {
      const result = await speech.transcribe(item.blob, {
        language: this.$('#language').value,
        onProgress: (message) => {
          if (target) target.textContent = `${message}...`;
        },
      });

      const text = result.chunks.length
        ? result.chunks.map((chunk) => `[${clock(chunk.start)}] ${chunk.text}`).join('\n')
        : result.text;

      await blobs.put(VoiceRecorder.appId, { ...item, transcript: text });
      await this.#load();
    } catch (error) {
      if (target) target.textContent = `Could not transcribe: ${error.message}`;
    }
  }

  async #assist(id, prompt) {
    const item = this.#items.find((entry) => entry.id === id);
    if (!item?.transcript) return;
    const target = this.$(`[data-text="${id}"]`);
    const original = item.transcript;
    if (target) target.textContent = '';

    try {
      await ai.complete('You work with meeting and voice note transcripts. Answer with the requested output only.', `${prompt}\n\n${original}`, {
        onDelta: (delta, text) => {
          if (target) {
            target.textContent = text;
            target.scrollTop = target.scrollHeight;
          }
        },
      });
    } catch (error) {
      if (target) target.textContent = `${original}\n\n[${error.message}]`;
    }
  }
}

define('jg-app-voice-recorder', VoiceRecorder);
