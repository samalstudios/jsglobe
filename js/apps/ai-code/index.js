import { JGApp, define, html, styleSheet } from '../../core/app.js';
import { appWords } from '../../core/i18n.js';
import { ai } from '../../core/ai.js';
import { copyText } from '../../core/util.js';
import '../../ui/jg-ai-bar.js';

const t = await appWords('ai-code', (lang) => import(`./i18n/${lang}.js`));

const sheet = await styleSheet(import.meta.url);

const TASKS = [
  { value: 'explain', label: t('ai-code.explain', 'Explain'), prompt: 'Explain what this code does, step by step. Be concise and mention edge cases you notice.' },
  { value: 'review', label: t('ai-code.review', 'Review'), prompt: 'Review this code. List concrete bugs, risks and improvements as a short bulleted list. Do not rewrite the whole file.' },
  { value: 'document', label: t('ai-code.document', 'Document'), prompt: 'Add clear doc comments to this code and return the full updated code only, no commentary.' },
  { value: 'tests', label: t('ai-code.writeTests', 'Write tests'), prompt: 'Write focused unit tests for this code. Return only the test code.' },
  { value: 'convert', label: t('ai-code.convert', 'Convert'), prompt: 'Convert this code to the requested target language, keeping behaviour identical. Return only code.' },
  { value: 'simplify', label: t('ai-code.simplify', 'Simplify'), prompt: 'Rewrite this code to be simpler and clearer without changing behaviour. Return only code.' },
];

class AiCode extends JGApp {
  static appId = 'ai-code';
  static styles = [...JGApp.styles, sheet];

  #controller = null;

  renderApp() {
    this.paint(html`<div class="app">
      <jg-ai-bar></jg-ai-bar>

      <div class="row">
        <jg-tabs id="task"></jg-tabs>
        <span class="grow"></span>
        <jg-input id="target" placeholder="${t('ai-code.targetLanguage', 'Target language')}" style="width:180px" hidden></jg-input>
        <jg-button id="run">${t('ai-code.run', 'Run')}</jg-button>
        <jg-button id="stop" variant="outline" hidden>${t('ai-code.stop', 'Stop')}</jg-button>
      </div>

      <div class="split">
        <div class="pane">
          <span class="label">${t('ai-code.code', 'Code')}</span>
          <jg-code id="input" grow gutter language="javascript" placeholder="${t('ai-code.pasteCodeHere', 'Paste code here')}"></jg-code>
        </div>
        <div class="pane">
          <div class="spread">
            <span class="label">${t('ai-code.result', 'Result')}</span>
            <jg-button size="sm" variant="ghost" id="copy">${t('ai-code.copy', 'Copy')}</jg-button>
          </div>
          <div class="out" id="out"></div>
        </div>
      </div>
    </div>`);

    this.$('#task').items = TASKS.map((task) => ({ value: task.value, label: task.label }));
    this.on(this.$('#task'), 'change', (event) => {
      this.$('#target').hidden = event.detail.value !== 'convert';
    });
    this.on(this.$('#run'), 'click', () => this.#run());
    this.on(this.$('#stop'), 'click', () => this.#controller?.abort());
    this.on(this.$('#copy'), 'click', () => copyText(this.$('#out').textContent));
  }

  async #run() {
    const code = this.$('#input').value.trim();
    const out = this.$('#out');
    if (!code) {
      out.textContent = 'Paste some code first.';
      return;
    }

    const task = TASKS.find((item) => item.value === this.$('#task').value) ?? TASKS[0];
    const target = this.$('#target').value.trim();
    const instruction = task.value === 'convert' && target ? `${task.prompt} Target language: ${target}.` : task.prompt;

    out.textContent = '';
    this.#controller = new AbortController();
    this.$('#stop').hidden = false;
    this.$('#run').setAttribute('disabled', '');

    try {
      await ai.complete(
        'You are a precise senior engineer. Answer with the requested artefact and nothing else.',
        `${instruction}\n\n\`\`\`\n${code}\n\`\`\``,
        {
          signal: this.#controller.signal,
          onDelta: (delta, text) => {
            out.textContent = text;
            out.scrollTop = out.scrollHeight;
          },
        },
      );
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

define('jg-app-ai-code', AiCode);
