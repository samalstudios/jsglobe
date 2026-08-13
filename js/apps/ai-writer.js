import { JGApp, define, html, css } from '../core/app.js';
import { ai } from '../core/ai.js';
import { copyText } from '../core/util.js';
import '../ui/jg-ai-bar.js';

const sheet = css`
  .split { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; flex: 1; min-height: 0; }
  @media (max-width: 820px) { .split { grid-template-columns: 1fr; } }
  .pane { display: flex; flex-direction: column; gap: 6px; min-height: 0; }
  .out {
    flex: 1;
    min-height: 200px;
    overflow: auto;
    padding: 14px 16px;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--card);
    font-size: 13.5px;
    line-height: 1.75;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
`;

const TASKS = [
  { value: 'summarise', label: 'Summarise', prompt: 'Summarise the text in at most five bullet points.' },
  { value: 'rewrite', label: 'Rewrite', prompt: 'Rewrite the text so it is clearer and shorter, keeping the meaning.' },
  { value: 'tone', label: 'Change tone', prompt: 'Rewrite the text in the requested tone.' },
  { value: 'translate', label: 'Translate', prompt: 'Translate the text into the requested language. Return only the translation.' },
  { value: 'proofread', label: 'Proofread', prompt: 'Fix grammar, spelling and punctuation. Return only the corrected text.' },
  { value: 'bullets', label: 'To bullets', prompt: 'Turn the text into a tight bulleted list.' },
  { value: 'commit', label: 'Commit message', prompt: 'Write a conventional commit message for this diff. One subject line under 72 characters, then a short body.' },
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
        <jg-input id="language" placeholder="Language" style="width:150px" hidden></jg-input>
        <jg-button id="run">Run</jg-button>
        <jg-button id="stop" variant="outline" hidden>Stop</jg-button>
      </div>

      <div class="split">
        <div class="pane">
          <span class="label">Input</span>
          <jg-textarea id="input" grow sans placeholder="Paste text, notes or a diff"></jg-textarea>
        </div>
        <div class="pane">
          <div class="spread">
            <span class="label">Result</span>
            <jg-button size="sm" variant="ghost" id="copy">Copy</jg-button>
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
