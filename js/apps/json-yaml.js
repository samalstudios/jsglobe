import { JGApp, define, html, css } from '../core/app.js';
import { debounce, copyText } from '../core/util.js';
import { toYaml, fromYaml } from '../core/yaml.js';

const sheet = css`
  .split { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; flex: 1; min-height: 0; }
  @media (max-width: 760px) { .split { grid-template-columns: 1fr; } }
  .pane { display: flex; flex-direction: column; gap: 6px; min-height: 0; }
`;

const SAMPLE = { name: 'jsglobe', version: 1, tools: ['json', 'yaml'], server: { port: 8080, tls: true } };

class JsonYaml extends JGApp {
  static appId = 'json-yaml';
  static styles = [...JGApp.styles, sheet];

  renderApp() {
    this.paint(html`<div class="app">
      <div class="row">
        <jg-button size="sm" variant="outline" id="sample">Load sample</jg-button>
        <span class="grow"></span>
        <span class="hint" id="status"></span>
      </div>
      <div class="split">
        <div class="pane">
          <div class="spread"><span class="label">JSON</span><jg-copy from="#json" size="icon"></jg-copy></div>
          <jg-code id="json" grow gutter language="json" placeholder="{ }"></jg-code>
        </div>
        <div class="pane">
          <div class="spread"><span class="label">YAML</span><jg-copy from="#yaml" size="icon"></jg-copy></div>
          <jg-code id="yaml" grow gutter language="yaml" placeholder="key: value"></jg-code>
        </div>
      </div>
      <div class="hint">The YAML parser covers the common configuration subset: nested maps, lists and scalars.</div>
    </div>`);

    const json = this.$('#json');
    const yaml = this.$('#yaml');
    const status = this.$('#status');

    const toYamlSide = debounce(() => {
      try {
        yaml.value = toYaml(JSON.parse(json.value || '{}'));
        status.textContent = 'Converted to YAML';
      } catch (error) {
        status.textContent = error.message;
      }
    }, 160);

    const toJsonSide = debounce(() => {
      try {
        json.value = JSON.stringify(fromYaml(yaml.value), null, 2);
        status.textContent = 'Converted to JSON';
      } catch (error) {
        status.textContent = error.message;
      }
    }, 160);

    this.on(json, 'input', toYamlSide);
    this.on(yaml, 'input', toJsonSide);
    this.on(this.$('#sample'), 'click', () => {
      json.value = JSON.stringify(SAMPLE, null, 2);
      toYamlSide();
    });

    json.value = JSON.stringify(SAMPLE, null, 2);
    yaml.value = toYaml(SAMPLE);
  }
}

define('jg-app-json-yaml', JsonYaml);
