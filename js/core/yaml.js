const needsQuotes = (value) =>
  value === '' ||
  /^[\s]|[\s]$/.test(value) ||
  /^(true|false|null|yes|no|on|off|~)$/i.test(value) ||
  /^-?\d/.test(value) ||
  /^[-?*&!|>%@`{}[\],]/.test(value) ||
  /:\s|\s#|:$/.test(value) ||
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
        } else if (/^"[^"]*"$/.test(content) || /^'[^']*'$/.test(content)) {
          container.push(scalar(content));
        } else if (/^[\w"'.-]+:(\s|$)/.test(content)) {
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

export { toYaml, fromYaml };
