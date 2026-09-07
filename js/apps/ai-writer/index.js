import { JGApp, define, html, styleSheet } from '../../core/app.js';
import { appWords } from '../../core/i18n.js';
import { ai } from '../../core/ai.js';
import { copyText } from '../../core/util.js';
import '../../ui/jg-ai-bar.js';

const t = await appWords('ai-writer', (lang) => import(`./i18n/${lang}.js`));

const sheet = await styleSheet(import.meta.url);

const TASKS = [
  { value: 'summarise', label: t('ai-writer.summarise', 'Summarise'), prompt: 'Summarise the text in at most five bullet points.' },
  { value: 'rewrite', label: t('ai-writer.rewrite', 'Rewrite'), prompt: 'Rewrite the text so it is clearer and shorter, keeping the meaning.' },
  { value: 'tone', label: t('ai-writer.changeTone', 'Change tone'), prompt: 'Rewrite the text in the requested tone.' },
  { value: 'translate', label: t('ai-writer.translate', 'Translate'), prompt: 'Translate the text into the requested language. Return only the translation.' },
  { value: 'proofread', label: t('ai-writer.proofread', 'Proofread'), prompt: 'Fix grammar, spelling and punctuation. Return only the corrected text.' },
  { value: 'bullets', label: t('ai-writer.toBullets', 'To bullets'), prompt: 'Turn the text into a tight bulleted list.' },
  { value: 'commit', label: t('ai-writer.commitMessage', 'Commit message'), prompt: 'Write a conventional commit message for this diff. One subject line under 72 characters, then a short body.' },
];

const TONES = ['neutral', 'friendly', 'formal', 'confident', 'playful', 'technical'];

class AiWriter extends JGApp {
  static appId = 'ai-writer';
  static styles = [...JGApp.styles, sheet];

  #controller = null;

  renderApp() {
    this.paint(html`<div class="app">
      <jg-ai-bar></jg-ai-bar>

      <div class="row">
        <jg-tabs id="task"></jg-tabs>
        <span class="grow"></span>
        <jg-select id="tone" style="width:150px" hidden>
          ${TONES.map((tone) => html`<option value="${tone}">${tone}</option>`)}
        </jg-select>
        <jg-input id="language" placeholder="${t('ai-writer.language', 'Language')}" style="width:150px" hidden></jg-input>
        <jg-button id="run">${t('ai-writer.run', 'Run')}</jg-button>
        <jg-button id="stop" variant="outline" hidden>${t('ai-writer.stop', 'Stop')}</jg-button>
      </div>

      <div class="split">
        <div class="pane">
          <span class="label">${t('ai-writer.input', 'Input')}</span>
          <jg-textarea id="input" grow sans placeholder="${t('ai-writer.pasteTextNotesOrA', 'Paste text, notes or a diff')}"></jg-textarea>
        </div>
        <div class="pane">
          <div class="spread">
            <span class="label">${t('ai-writer.result', 'Result')}</span>
            <jg-button size="sm" variant="ghost" id="copy">${t('ai-writer.copy', 'Copy')}</jg-button>
          </div>
          <div class="out" id="out"></div>
        </div>
      </div>
    </div>`);

    this.$('#task').items = TASKS.map((task) => ({ value: task.value, label: task.label }));
    this.on(this.$('#task'), 'change', (event) => {
      this.$('#tone').hidden = event.detail.value !== 'tone';
      this.$('#language').hidden = event.detail.value !== 'translate';
    });
    this.on(this.$('#run'), 'click', () => this.#run());
    this.on(this.$('#stop'), 'click', () => this.#controller?.abort());
    this.on(this.$('#copy'), 'click', () => copyText(this.$('#out').textContent));
  }

  async #run() {
    const text = this.$('#input').value.trim();
    const out = this.$('#out');
    if (!text) {
      out.textContent = 'Add some text first.';
      return;
    }

    const task = TASKS.find((item) => item.value === this.$('#task').value) ?? TASKS[0];
    let instruction = task.prompt;
    if (task.value === 'tone') instruction += ` Tone: ${this.$('#tone').value}.`;
    if (task.value === 'translate') instruction += ` Language: ${this.$('#language').value || 'English'}.`;

    out.textContent = '';
    this.#controller = new AbortController();
    this.$('#stop').hidden = false;
    this.$('#run').setAttribute('disabled', '');

    try {
      await ai.complete('You are a careful editor. Return only the requested output, with no preamble.', `${instruction}\n\n${text}`, {
        signal: this.#controller.signal,
        onDelta: (delta, streamed) => {
          out.textContent = streamed;
          out.scrollTop = out.scrollHeight;
        },
      });
    } catch (error) {
      out.textContent = `Could not complete that request. ${error.message}`;
    } finally {
      this.#controller = null;
      const stop = this.$('#stop');
      const run = this.$('#run');
      if (stop) stop.hidden = true;
      if (run) run.removeAttribute('disabled');
    }
  }
}

define('jg-app-ai-writer', AiWriter);
