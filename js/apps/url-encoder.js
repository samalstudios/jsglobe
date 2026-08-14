import { JGApp, define, html, css } from '../core/app.js';
import { debounce } from '../core/util.js';

const sheet = css`
  .split { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; flex: 1; min-height: 0; }
  @media (max-width: 760px) { .split { grid-template-columns: 1fr; } }
  .pane { display: flex; flex-direction: column; gap: 6px; min-height: 0; }
`;

class UrlEncoder extends JGApp {
  static appId = 'url-encoder';
  static styles = [...JGApp.styles, sheet];

  renderApp() {
    this.paint(html`<div class="app">
      <div class="row">
        <jg-tabs id="strategy"></jg-tabs>
        <span class="grow"></span>
        <jg-button size="sm" variant="outline" id="swap">Swap ⇅</jg-button>
      </div>
      <div class="split">
        <div class="pane">
          <div class="spread"><span class="label">Decoded</span><jg-copy from="#plain" size="icon"></jg-copy></div>
          <jg-textarea id="plain" grow placeholder="https://example.com/search?q=hello world"></jg-textarea>
        </div>
        <div class="pane">
          <div class="spread"><span class="label">Encoded</span><jg-copy from="#encoded" size="icon"></jg-copy></div>
          <jg-textarea id="encoded" grow placeholder="https%3A%2F%2Fexample.com"></jg-textarea>
        </div>
      </div>
      <div class="hint" id="status"></div>
    </div>`);

    this.$('#strategy').items = [
      { value: 'component', label: 'Component' },
      { value: 'uri', label: 'Full URI' },
    ];

    const plain = this.$('#plain');
    const encoded = this.$('#encoded');
    const status = this.$('#status');

    const encode = debounce(() => {
      const fn = this.$('#strategy').value === 'uri' ? encodeURI : encodeURIComponent;
      encoded.value = fn(plain.value);
      status.textContent = `${plain.value.length} → ${encoded.value.length} characters`;
    }, 110);

    const decode = debounce(() => {
      try {
        const fn = this.$('#strategy').value === 'uri' ? decodeURI : decodeURIComponent;
        plain.value = fn(encoded.value);
        status.textContent = 'Decoded successfully';
      } catch {
        status.textContent = 'Malformed percent-encoding';
      }
    }, 110);

    this.on(plain, 'input', encode);
    this.on(encoded, 'input', decode);
    this.on(this.$('#strategy'), 'change', encode);
    this.on(this.$('#swap'), 'click', () => {
      const value = plain.value;
      plain.value = encoded.value;
      encoded.value = value;
      encode();
    });
  }
}

define('jg-app-url-encoder', UrlEncoder);
