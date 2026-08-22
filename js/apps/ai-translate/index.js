import { JGApp, define, html, styleSheet } from '../../core/app.js';
import { appText } from '../../core/i18n.js';
import strings from './i18n.js';
import { ai } from '../../core/ai.js';
import { copyText, debounce } from '../../core/util.js';
import '../../ui/jg-ai-bar.js';

const t = appText(strings);

const sheet = await styleSheet(import.meta.url);

const LANGUAGES = [
  'Arabic', 'Bengali', 'Bulgarian', 'Chinese (Simplified)', 'Chinese (Traditional)', 'Czech', 'Danish',
  'Dutch', 'English', 'Farsi', 'Finnish', 'French', 'German', 'Greek', 'Hebrew', 'Hindi', 'Hungarian',
  'Indonesian', 'Italian', 'Japanese', 'Korean', 'Malay', 'Norwegian', 'Polish', 'Portuguese',
  'Portuguese (Brazil)', 'Romanian', 'Russian', 'Spanish', 'Swedish', 'Thai', 'Turkish', 'Ukrainian',
  'Urdu', 'Vietnamese',
];

const QUICK = ['English', 'Spanish', 'French', 'German', 'Japanese', 'Farsi', 'Arabic', 'Chinese (Simplified)'];

const TONES = {
  neutral: 'Keep a neutral register.',
  formal: 'Use a formal, polite register.',
  casual: 'Use a relaxed, conversational register.',
};

class AiTranslate extends JGApp {
  static appId = 'ai-translate';
  static settings = [
    { key: 'target', label: t('ai-translate.defaultTargetLanguage', 'Default target language'), type: 'text', default: 'English' },
    { key: 'auto', label: t('ai-translate.translateAsIType', 'Translate as I type'), type: 'switch', default: false },
  ];
  static styles = [...JGApp.styles, sheet];

  #controller = null;

  renderApp() {
    const source = this.config.get('source', 'Detect');
    const target = this.config.get('target', 'English');

    this.paint(html`<div class="app">
      <jg-ai-bar></jg-ai-bar>

      <div class="row nowrap">
        <jg-select id="source" class="grow" value="${source}">
          <option value="Detect">${t('ai-translate.detectLanguage', 'Detect language')}</option>
          ${LANGUAGES.map((language) => html`<option value="${language}">${language}</option>`)}
        </jg-select>
        <jg-button size="icon" variant="outline" id="swap" title="${t('ai-translate.swapLanguages', 'Swap languages')}">⇄</jg-button>
        <jg-select id="target" class="grow" value="${target}">
          ${LANGUAGES.map((language) => html`<option value="${language}">${language}</option>`)}
        </jg-select>
      </div>

      <div class="quick">
        ${QUICK.map((language) => html`<button data-target="${language}">${language}</button>`)}
      </div>

      <div class="split">
        <div class="pane">
          <div class="spread">
            <span class="label">${t('ai-translate.source', 'Source')}</span>
            <span class="count" id="incount">${t('ai-translate.0Characters', '0 characters')}</span>
          </div>
          <jg-textarea id="input" grow sans placeholder="${t('ai-translate.typeOrPasteTextTo', 'Type or paste text to translate')}"></jg-textarea>
        </div>

        <div class="swap-cell">
          <jg-button id="run">${t('ai-translate.translate', 'Translate')}</jg-button>
        </div>

        <div class="pane">
          <div class="spread">
            <span class="label">${t('ai-translate.translation', 'Translation')}</span>
            <span class="row tight">
              <jg-button size="sm" variant="ghost" id="copy">${t('ai-translate.copy', 'Copy')}</jg-button>
              <jg-button size="sm" variant="ghost" id="stop" hidden>${t('ai-translate.stop', 'Stop')}</jg-button>
            </span>
          </div>
          <div class="out" id="out" data-placeholder="${t('ai-translate.theTranslationAppearsHere', 'The translation appears here.')}"></div>
        </div>
      </div>

      <div class="row">
        <jg-select id="tone" value="neutral" size="sm" style="width:150px">
          <option value="neutral">${t('ai-translate.neutralTone', 'Neutral tone')}</option>
          <option value="formal">${t('ai-translate.formalTone', 'Formal tone')}</option>
          <option value="casual">${t('ai-translate.casualTone', 'Casual tone')}</option>
        </jg-select>
        <jg-switch id="auto" ${this.config.get('auto', false) ? 'checked' : ''}></jg-switch>
        <span class="hint">${t('ai-translate.translateAsIType', 'Translate as I type')}</span>
        <span class="grow"></span>
        <span class="hint" id="status"></span>
      </div>
    </div>`);

    const run = () => this.#translate();
    const live = debounce(() => {
      if (this.$('#auto').checked) run();
    }, 900);

    this.on(this.$('#run'), 'click', run);
    this.on(this.$('#stop'), 'click', () => this.#controller?.abort());
    this.on(this.$('#copy'), 'click', () => copyText(this.$('#out').textContent));

    this.on(this.$('#input'), 'input', () => {
      const value = this.$('#input').value;
      this.$('#incount').textContent = `${value.length} character${value.length === 1 ? '' : 's'}`;
      live();
    });

    this.on(this.$('#source'), 'change', (event) => this.config.set('source', event.detail.value));
    this.on(this.$('#target'), 'change', (event) => {
      this.config.set('target', event.detail.value);
      if (this.$('#input').value.trim()) run();
    });
    this.on(this.$('#auto'), 'change', (event) => this.config.set('auto', event.detail.checked));

    this.on(this.$('#swap'), 'click', () => {
      const source = this.$('#source').value;
      const target = this.$('#target').value;
      if (source === 'Detect') return;
      this.$('#source').value = target;
      this.$('#target').value = source;
      this.config.set('source', target);
      this.config.set('target', source);
      const out = this.$('#out').textContent;
      if (out) {
        this.$('#input').value = out;
        this.$('#out').textContent = '';
        run();
      }
    });

    this.bind('[data-target]', 'click', (event) => {
      this.$('#target').value = event.currentTarget.dataset.target;
      this.config.set('target', event.currentTarget.dataset.target);
      if (this.$('#input').value.trim()) run();
    });
  }

  async #translate() {
    const text = this.$('#input').value.trim();
    const out = this.$('#out');
    const status = this.$('#status');

    if (!text) {
      out.textContent = '';
      status.textContent = '';
      return;
    }

    const source = this.$('#source').value;
    const target = this.$('#target').value;
    const tone = TONES[this.$('#tone').value];

    this.#controller?.abort();
    this.#controller = new AbortController();
    this.$('#stop').hidden = false;
    this.$('#run').setAttribute('disabled', '');
    status.textContent = 'Translating';
    out.textContent = '';

    const system = [
      'You are a translation engine.',
      `Translate everything the user sends into ${target}.`,
      source === 'Detect' ? 'Detect the source language yourself.' : `The source language is ${source}.`,
      tone,
      'Reply with the translation only. Do not add notes, quotes, labels or explanations.',
      'Preserve line breaks, punctuation style, code, URLs and placeholders such as {name} or %s.',
    ].join(' ');

    const started = performance.now();
    try {
      await ai.complete(system, text, {
        signal: this.#controller.signal,
        onDelta: (delta, streamed) => {
          out.textContent = streamed;
          out.scrollTop = out.scrollHeight;
        },
      });
      status.textContent = `Done in ${((performance.now() - started) / 1000).toFixed(1)}s`;
    } catch (error) {
      if (error.name === 'AbortError') status.textContent = 'Stopped';
      else {
        out.textContent = '';
        status.innerHTML = html`<span class="error">${error.message}</span>`;
      }
    } finally {
      this.#controller = null;
      const stop = this.$('#stop');
      const run = this.$('#run');
      if (stop) stop.hidden = true;
      if (run) run.removeAttribute('disabled');
    }
  }
}

define('jg-app-ai-translate', AiTranslate);
