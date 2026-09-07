import { JGApp, define, html, styleSheet } from '../../core/app.js';
import { appWords } from '../../core/i18n.js';

const t = await appWords('keycode-info', (lang) => import(`./i18n/${lang}.js`));

const sheet = await styleSheet(import.meta.url);

class KeycodeInfo extends JGApp {
  static appId = 'keycode-info';
  static styles = [...JGApp.styles, sheet];

  #history = [];

  renderApp() {
    this.paint(html`<div class="app">
      <div class="stage" tabindex="0" id="stage">
        <div class="key" id="key">${t('keycode-info.pressAnyKey', 'Press any key')}</div>
        <div class="hint">${t('keycode-info.clickHereFirstThenPress', 'Click here first, then press a key. Modifier combinations are captured too.')}</div>
      </div>

      <jg-card title="${t('keycode-info.eventProperties', 'Event properties')}">
        <div class="kv" id="props">
          <div>${t('keycode-info.eventKey', 'event.key')}</div><div class="mono">-</div>
          <div>${t('keycode-info.eventCode', 'event.code')}</div><div class="mono">-</div>
          <div>${t('keycode-info.eventKeycode', 'event.keyCode')}</div><div class="mono">-</div>
          <div>${t('keycode-info.modifiers', 'Modifiers')}</div><div class="mono">-</div>
        </div>
      </jg-card>

      <jg-card title="${t('keycode-info.recentKeys', 'Recent keys')}">
        <div class="history" id="history"><span class="hint">${t('keycode-info.nothingYet', 'Nothing yet')}</span></div>
      </jg-card>

      <jg-card title="${t('keycode-info.snippet', 'Snippet')}">
        <jg-output id="snippet" placeholder="${t('keycode-info.pressAKeyToBuild', 'Press a key to build a matcher')}"></jg-output>
      </jg-card>
    </div>`);

    const stage = this.$('#stage');
    stage.focus();
    this.on(stage, 'keydown', (event) => this.#capture(event));
    this.hotkeys((event) => {
      if (this.shadowRoot.activeElement === stage) return;
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
      <div>${t('keycode-info.eventKey', 'event.key')}</div><div class="mono">${event.key === ' ' ? '" "' : event.key}</div>
      <div>${t('keycode-info.eventCode', 'event.code')}</div><div class="mono">${event.code}</div>
      <div>${t('keycode-info.eventKeycode', 'event.keyCode')}</div><div class="mono">${event.keyCode} (deprecated)</div>
      <div>${t('keycode-info.eventWhich', 'event.which')}</div><div class="mono">${event.which}</div>
      <div>${t('keycode-info.modifiers', 'Modifiers')}</div><div class="mono">${modifiers.length ? modifiers.join(' + ') : 'none'}</div>
      <div>${t('keycode-info.location', 'Location')}</div><div class="mono">${['standard', 'left', 'right', 'numpad'][event.location] ?? event.location}</div>
      <div>${t('keycode-info.repeat', 'Repeat')}</div><div class="mono">${String(event.repeat)}</div>
      <div>${t('keycode-info.unicode', 'Unicode')}</div><div class="mono">${event.key.length === 1 ? `U+${event.key.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}` : '-'}</div>
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
