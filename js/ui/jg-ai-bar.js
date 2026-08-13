import { JGElement, define, css, html } from '../core/dom.js';
import { base } from './styles.js';
import { ai } from '../core/ai.js';
import { bus } from '../core/bus.js';
import { router } from '../core/router.js';

const sheet = css`
  :host { display: block; }
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
  .bar[data-status="loading"] .dot,
  .bar[data-status="generating"] .dot { background: var(--warning); animation: pulse 1s ease-in-out infinite; }
  .bar[data-status="error"] .dot { background: var(--destructive); }
  @keyframes pulse { 50% { opacity: 0.35; } }
  .text { flex: 1; min-width: 0; }
  .name { font-weight: 600; }
  .detail { color: var(--muted-foreground); font-size: 11.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .track { height: 4px; border-radius: 999px; background: var(--border); overflow: hidden; margin-top: 5px; }
  .track i { display: block; height: 100%; background: var(--ring); transition: width 0.2s ease; }
  .setup {
    display: grid;
    gap: 10px;
    padding: 18px;
    border: 1px dashed var(--border-strong);
    border-radius: var(--radius-lg);
    text-align: center;
    justify-items: center;
  }
  .setup h3 { margin: 0; font-size: 14px; }
  .setup p { margin: 0; font-size: 12.5px; color: var(--muted-foreground); max-width: 46ch; }
`;

class JGAiBar extends JGElement {
  static styles = [base, sheet];

  connectedCallback() {
    super.connectedCallback();
    this.keep(bus.on('ai:status', () => this.refresh()));
    this.keep(bus.on('settings:change', () => this.refresh()));
  }

  get ready() {
    return ai.isEnabled();
  }

  render() {
    if (!ai.isEnabled()) {
      this.paint(html`
        <div class="setup">
          <h3>Local AI is turned off</h3>
          <p>
            Turn it on in Settings to run a model in this browser with WebLLM, or point JS Globe at a local
            server such as Ollama or LM Studio. Nothing is sent to a third party either way.
          </p>
          <jg-button size="sm" id="open">Open AI settings</jg-button>
        </div>
      `);
      this.on(this.$('#open'), 'click', () => router.app('settings'));
      return;
    }

    const status = ai.state();
    this.paint(html`
      <div class="bar" data-status="${status.status}">
        <span class="dot"></span>
        <span class="text">
          <span class="name">${ai.describe()}</span>
          <span class="detail">
            ${status.status === 'idle' ? 'Not loaded yet' : status.message || status.status}
          </span>
          ${status.status === 'loading' ? html`<span class="track"><i style="width:${status.progress}%"></i></span>` : ''}
        </span>
        ${status.status === 'idle' && ai.provider === 'webllm'
          ? html`<jg-button size="sm" variant="outline" id="load">Load model</jg-button>`
          : ''}
        ${status.status === 'error' ? html`<jg-button size="sm" variant="outline" id="retry">Retry</jg-button>` : ''}
      </div>
    `);

    const load = this.$('#load') ?? this.$('#retry');
    if (load) {
      this.on(load, 'click', () => {
        ai.engine().catch(() => {});
      });
    }
  }
}

define('jg-ai-bar', JGAiBar);
