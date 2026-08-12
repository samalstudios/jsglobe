import { JGApp, define, html, css } from '../core/app.js';
import { debounce, copyText } from '../core/util.js';

const sheet = css`
  .split { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; flex: 1; min-height: 0; }
  @media (max-width: 760px) { .split { grid-template-columns: 1fr; } }
  .pane { display: flex; flex-direction: column; gap: 6px; min-height: 0; }
`;

const needsQuotes = (value) =>
  value === '' ||
  /^[\s]|[\s]$/.test(value) ||
  /^(true|false|null|yes|no|on|off|~)$/i.test(value) ||
  /^-?\d/.test(value) ||
  /[:#\-?*&!|>%@`{}[\],]/.test(value) ||
  /\n/.test(value);

const toYaml = (value, depth = 0) => {
  const pad = '  '.repeat(depth);
  if (value === null) return 'null';
  if (Array.isArray(value)) {
    if (!value.length) return '[]';
    return value
      .map((item) => {
        const rendered = toYaml(item, depth + 1);
        return item && typeof item === 'object' && Object.keys(item).length
          ? `${pad}-\n${rendered}`
          : `${pad}- ${rendered}`;
      })
      .join('\n');
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value);
    if (!keys.length) return '{}';
    return keys
      .map((key) => {
        const child = value[key];
        if (child && typeof child === 'object' && Object.keys(child).length) {
          return `${pad}${key}:\n${toYaml(child, depth + 1)}`;
        }
        return `${pad}${key}: ${toYaml(child, depth + 1)}`;
      })
      .join('\n');
  }
  if (typeof value === 'string') return needsQuotes(value) ? JSON.stringify(value) : value;
  return String(value);
};

const scalar = (token) => {
  const text = token.trim();
  if (!text || text === '~' || text === 'null') return null;
  if (/^(true|yes|on)$/i.test(text)) return true;
  if (/^(false|no|off)$/i.test(text)) return false;
  if (/^-?\d+$/.test(text)) return Number(text);
  if (/^-?\d*\.\d+(e[+-]?\d+)?$/i.test(text)) return Number(text);
  if (/^["'].*["']$/.test(text)) return text.slice(1, -1);
  if (text === '[]') return [];
  if (text === '{}') return {};
  if (/^\[.*\]$/.test(text)) return text.slice(1, -1).split(',').map((part) => scalar(part)).filter((part) => part !== null || part === null);
  return text;
};

const fromYaml = (source) => {
  const lines = source
    .split('\n')
    .map((line) => line.replace(/\t/g, '  '))
    .filter((line) => line.trim() && !/^\s*#/.test(line) && line.trim() !== '---');

  let index = 0;

  const parseBlock = (indent) => {
    const isList = lines[index] !== undefined && /^\s*-\s?/.test(lines[index]) && lines[index].search(/\S/) === indent;
    const container = isList ? [] : {};

    while (index < lines.length) {
      const line = lines[index];
      const level = line.search(/\S/);
      if (level < indent) break;
      if (level > indent) {
        index += 1;
        continue;
      }

      if (isList) {
        const content = line.slice(level + 1).trim();
        index += 1;
        if (!content) {
          container.push(parseBlock(nextIndent(indent)));
        } else if (/^[\w"'.-]+:\s*/.test(content)) {
          const nested = {};
          const [, key, rest] = /^([\w"'.-]+):\s*(.*)$/.exec(content);
          nested[key.replace(/^["']|["']$/g, '')] = rest ? scalar(rest) : parseBlock(nextIndent(indent));
          while (index < lines.length && lines[index].search(/\S/) > indent && !/^\s*-\s/.test(lines[index])) {
            const childLine = lines[index];
            const match = /^([\w"'.-]+):\s*(.*)$/.exec(childLine.trim());
            if (!match) break;
            index += 1;
            nested[match[1].replace(/^["']|["']$/g, '')] = match[2] ? scalar(match[2]) : parseBlock(childLine.search(/\S/) + 2);
          }
          container.push(nested);
        } else {
          container.push(scalar(content));
        }
        continue;
      }

      const match = /^([^:]+):\s*(.*)$/.exec(line.trim());
      if (!match) {
        index += 1;
        continue;
      }
      const key = match[1].trim().replace(/^["']|["']$/g, '');
      const rest = match[2];
      index += 1;
      container[key] = rest === '' ? parseBlock(nextIndent(indent)) : scalar(rest);
    }

    return container;
  };

  const nextIndent = (indent) => {
    const line = lines[index];
    if (!line) return indent + 2;
    const level = line.search(/\S/);
    return level > indent ? level : indent + 2;
  };

  return parseBlock(lines[0] ? lines[0].search(/\S/) : 0);
};

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
          <jg-textarea id="json" grow placeholder="{ }"></jg-textarea>
        </div>
        <div class="pane">
          <div class="spread"><span class="label">YAML</span><jg-copy from="#yaml" size="icon"></jg-copy></div>
          <jg-textarea id="yaml" grow placeholder="key: value"></jg-textarea>
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
