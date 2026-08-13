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
    padding: 12px;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--muted) 65%, transparent);
    font-size: 13px;
    line-height: 1.7;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
`;

const TASKS = [
  { value: 'explain', label: 'Explain', prompt: 'Explain what this code does, step by step. Be concise and mention edge cases you notice.' },
  { value: 'review', label: 'Review', prompt: 'Review this code. List concrete bugs, risks and improvements as a short bulleted list. Do not rewrite the whole file.' },
  { value: 'document', label: 'Document', prompt: 'Add clear doc comments to this code and return the full updated code only, no commentary.' },
  { value: 'tests', label: 'Write tests', prompt: 'Write focused unit tests for this code. Return only the test code.' },
  { value: 'convert', label: 'Convert', prompt: 'Convert this code to the requested target language, keeping behaviour identical. Return only code.' },
  { value: 'simplify', label: 'Simplify', prompt: 'Rewrite this code to be simpler and clearer without changing behaviour. Return only code.' },
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
        <jg-input id="target" placeholder="Target language" style="width:180px" hidden></jg-input>
        <jg-button id="run">Run</jg-button>
        <jg-button id="stop" variant="outline" hidden>Stop</jg-button>
      </div>

      <div class="split">
        <div class="pane">
          <span class="label">Code</span>
          <jg-code id="input" grow gutter language="javascript" placeholder="Paste code here"></jg-code>
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
