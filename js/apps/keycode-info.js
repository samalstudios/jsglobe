import { JGApp, define, html, css } from '../core/app.js';

const sheet = css`
  .stage {
    display: grid;
    place-items: center;
    gap: 10px;
    padding: 26px 16px;
    border: 1px dashed var(--border-strong);
    border-radius: var(--radius-lg);
    background: color-mix(in srgb, var(--muted) 50%, transparent);
    text-align: center;
  }
  .key {
    font: 600 clamp(28px, 8vw, 44px)/1 var(--font-mono);
    letter-spacing: -0.02em;
  }
  .history { display: flex; flex-wrap: wrap; gap: 6px; }
`;

class KeycodeInfo extends JGApp {
  static appId = 'keycode-info';
  static styles = [...JGApp.styles, sheet];

  #history = [];

  renderApp() {
    this.paint(html`<div class="app">
      <div class="stage" tabindex="0" id="stage">
        <div class="key" id="key">Press any key</div>
        <div class="hint">Click here first, then press a key. Modifier combinations are captured too.</div>
      </div>

      <jg-card title="Event properties">
        <div class="kv" id="props">
          <div>event.key</div><div class="mono">-</div>
          <div>event.code</div><div class="mono">-</div>
          <div>event.keyCode</div><div class="mono">-</div>
          <div>Modifiers</div><div class="mono">-</div>
        </div>
      </jg-card>

      <jg-card title="Recent keys">
        <div class="history" id="history"><span class="hint">Nothing yet</span></div>
      </jg-card>

      <jg-card title="Snippet">
        <jg-output id="snippet" placeholder="Press a key to build a matcher"></jg-output>
      </jg-card>
    </div>`);

    const stage = this.$('#stage');
    stage.focus();
    this.on(stage, 'keydown', (event) => this.#capture(event));
    this.on(window, 'keydown', (event) => {
      if (this.shadowRoot.activeElement === stage) return;
      if (event.target !== document.body && event.target.tagName !== 'JG-SHELL') return;
      this.#capture(event);
    });
  }

  #capture(event) {
    event.preventDefault();
    const modifiers = ['ctrlKey', 'shiftKey', 'altKey', 'metaKey']
      .filter((name) => event[name])
      .map((name) => name.replace('Key', ''));

    this.$('#key').textContent = event.key === ' ' ? 'Space' : event.key;
    this.$('#props').innerHTML = html`
      <div>event.key</div><div class="mono">${event.key === ' ' ? '" "' : event.key}</div>
      <div>event.code</div><div class="mono">${event.code}</div>
      <div>event.keyCode</div><div class="mono">${event.keyCode} (deprecated)</div>
      <div>event.which</div><div class="mono">${event.which}</div>
      <div>Modifiers</div><div class="mono">${modifiers.length ? modifiers.join(' + ') : 'none'}</div>
      <div>Location</div><div class="mono">${['standard', 'left', 'right', 'numpad'][event.location] ?? event.location}</div>
      <div>Repeat</div><div class="mono">${String(event.repeat)}</div>
      <div>Unicode</div><div class="mono">${event.key.length === 1 ? `U+${event.key.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}` : '-'}</div>
    `;

    this.#history = [{ key: event.key === ' ' ? 'Space' : event.key, code: event.code }, ...this.#history].slice(0, 12);
    this.$('#history').innerHTML = this.#history
      .map((item) => html`<jg-badge mono>${item.key} · ${item.code}</jg-badge>`)
      .join('');

    const guard = [
      ...modifiers.map((name) => `event.${name}Key`),
      `event.key === '${event.key === "'" ? "\\'" : event.key}'`,
    ].join(' && ');
    this.$('#snippet').value = `if (${guard}) {\n  event.preventDefault();\n}`;
  }
}

define('jg-app-keycode', KeycodeInfo);
