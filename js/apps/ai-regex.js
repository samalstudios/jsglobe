import { JGApp, define, html, css } from '../core/app.js';
import { escapeHtml } from '../core/dom.js';
import { ai } from '../core/ai.js';
import { copyText } from '../core/util.js';
import '../ui/jg-ai-bar.js';

const sheet = css`
  .pattern { font-family: var(--font-mono); font-size: 14px; overflow-wrap: anywhere; }
  .preview {
    max-height: 180px;
    overflow: auto;
    padding: 10px 12px;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--muted) 65%, transparent);
    font-family: var(--font-mono);
    font-size: 12.5px;
    line-height: 1.7;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  mark {
    background: color-mix(in srgb, var(--ring) 34%, transparent);
    color: inherit;
    border-radius: 3px;
    outline: 1px solid color-mix(in srgb, var(--ring) 55%, transparent);
  }
  .out { white-space: pre-wrap; font-size: 13px; line-height: 1.7; }
`;

const SYSTEM =
  'You write JavaScript regular expressions. Reply with a single line containing only the pattern between slashes, for example /^a.*z$/i. No explanation, no code fences.';

class AiRegex extends JGApp {
  static appId = 'ai-regex';
  static styles = [...JGApp.styles, sheet];

  #controller = null;

  renderApp() {
    this.paint(html`<div class="app">
      <jg-ai-bar></jg-ai-bar>

      <jg-field label="Describe what to match" hint="Plain language, for example: an ISO date followed by a comma">
        <div class="row nowrap">
          <jg-input id="prompt" class="grow" placeholder="A UK postcode, case insensitive"></jg-input>
          <jg-button id="run">Generate</jg-button>
          <jg-button id="stop" variant="outline" hidden>Stop</jg-button>
        </div>
      </jg-field>

      <jg-card title="Pattern">
        <div class="pattern" id="pattern">-</div>
        <div class="row">
          <jg-button size="sm" variant="outline" id="copy">Copy</jg-button>
          <jg-button size="sm" variant="ghost" id="explain">Explain this pattern</jg-button>
          <span class="hint" id="status"></span>
        </div>
      </jg-card>

      <jg-field label="Test against">
        <jg-textarea id="sample" rows="4" placeholder="Paste sample text to see live matches"></jg-textarea>
      </jg-field>
      <div class="preview" id="preview"></div>

      <jg-card title="Explanation" id="explaincard" hidden>
        <div class="out" id="explanation"></div>
      </jg-card>
    </div>`);

    this.on(this.$('#run'), 'click', () => this.#generate());
    this.on(this.$('#stop'), 'click', () => this.#controller?.abort());
    this.on(this.$('#prompt'), 'keydown', (event) => {
      if (event.key === 'Enter') this.#generate();
    });
    this.on(this.$('#sample'), 'input', () => this.#test());
    this.on(this.$('#copy'), 'click', () => copyText(this.$('#pattern').textContent));
    this.on(this.$('#explain'), 'click', () => this.#explain());
  }

  #expression() {
    const raw = this.$('#pattern').textContent.trim();
    const match = /^\/(.*)\/([gimsuy]*)$/.exec(raw);
    if (!match) return null;
    try {
      return new RegExp(match[1], match[2].includes('g') ? match[2] : `${match[2]}g`);
    } catch {
      return null;
    }
  }

  #test() {
    const expression = this.#expression();
    const sample = this.$('#sample').value;
    const preview = this.$('#preview');
    const status = this.$('#status');

    if (!expression || !sample) {
      preview.textContent = sample;
      return;
    }

    const matches = [...sample.matchAll(expression)];
    status.textContent = `${matches.length} match${matches.length === 1 ? '' : 'es'}`;

    let cursor = 0;
    let markup = '';
    matches.forEach((match) => {
      if (match.index === undefined) return;
      markup += escapeHtml(sample.slice(cursor, match.index));
      markup += `<mark>${escapeHtml(match[0])}</mark>`;
      cursor = match.index + match[0].length;
    });
    markup += escapeHtml(sample.slice(cursor));
    preview.innerHTML = markup;
  }

  async #generate() {
    const prompt = this.$('#prompt').value.trim();
    if (!prompt) return;
    const pattern = this.$('#pattern');
    const status = this.$('#status');

    pattern.textContent = '';
    status.textContent = 'Generating';
    this.#controller = new AbortController();
    this.$('#stop').hidden = false;
    this.$('#run').setAttribute('disabled', '');

    try {
      const answer = await ai.complete(SYSTEM, prompt, {
        signal: this.#controller.signal,
        onDelta: (delta, text) => {
          pattern.textContent = text.trim();
        },
      });
      const cleaned = /\/.*\/[gimsuy]*/.exec(answer.replace(/```[a-z]*|```/g, '')) ?? [answer.trim()];
      pattern.textContent = cleaned[0].trim();
      status.textContent = this.#expression() ? 'Valid pattern' : 'The model returned something that is not a valid pattern';
      this.#test();
    } catch (error) {
      status.textContent = error.message;
    } finally {
      this.#controller = null;
      const stop = this.$('#stop');
      const run = this.$('#run');
      if (stop) stop.hidden = true;
      if (run) run.removeAttribute('disabled');
    }
  }

  async #explain() {
    const raw = this.$('#pattern').textContent.trim();
    if (!raw || raw === '-') return;
    const card = this.$('#explaincard');
    const out = this.$('#explanation');
    card.hidden = false;
    out.textContent = '';
    try {
      await ai.complete(
        'You explain regular expressions to developers in short, plain sentences.',
        `Explain this regular expression piece by piece: ${raw}`,
        { onDelta: (delta, text) => (out.textContent = text) },
      );
    } catch (error) {
      out.textContent = error.message;
    }
  }
}

define('jg-app-ai-regex', AiRegex);
