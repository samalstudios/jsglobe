const escapeHtml = (text) =>
  String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const JS_KEYWORDS =
  'await|async|break|case|catch|class|const|continue|debugger|default|delete|do|else|export|extends|finally|for|from|function|get|if|import|in|instanceof|let|new|of|return|set|static|super|switch|this|throw|try|typeof|var|void|while|with|yield';
const JS_LITERALS = 'true|false|null|undefined|NaN|Infinity';
const CSS_UNITS = 'px|em|rem|%|vh|vw|s|ms|deg|fr|ch|pt';
const PY_KEYWORDS =
  'and|as|assert|async|await|break|class|continue|def|del|elif|else|except|finally|for|from|global|if|import|in|is|lambda|nonlocal|not|or|pass|raise|return|try|while|with|yield|self|match|case';
const SQL_KEYWORDS =
  'select|from|where|insert|into|values|update|set|delete|create|table|alter|drop|join|left|right|inner|outer|on|group|by|order|having|limit|offset|as|and|or|not|null|distinct|union|index|primary|key|foreign|references|default|case|when|then|else|end';

const GRAMMARS = {
  javascript: [
    ['comment', /\/\*[\s\S]*?\*\/|\/\/[^\n]*/],
    ['string', /`(?:\\[\s\S]|[^\\`])*`|"(?:\\[\s\S]|[^\\"\n])*"|'(?:\\[\s\S]|[^\\'\n])*'/],
    ['literal', new RegExp(`\\b(?:${JS_LITERALS})\\b`)],
    ['keyword', new RegExp(`\\b(?:${JS_KEYWORDS})\\b`)],
    ['number', /\b0[xX][\da-fA-F]+\b|\b\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?\b/],
    ['function', /\b[A-Za-z_$][\w$]*(?=\s*\()/],
    ['punct', /[{}[\]();,.:?=+\-*/%<>!&|^~]/],
  ],
  json: [
    ['attr', /"(?:\\.|[^\\"])*"(?=\s*:)/],
    ['string', /"(?:\\.|[^\\"])*"/],
    ['literal', /\b(?:true|false|null)\b/],
    ['number', /-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/],
    ['punct', /[{}[\],:]/],
  ],
  css: [
    ['comment', /\/\*[\s\S]*?\*\//],
    ['string', /"(?:\\.|[^\\"\n])*"|'(?:\\.|[^\\'\n])*'/],
    ['keyword', /@[\w-]+/],
    ['attr', /[\w-]+(?=\s*:)/],
    ['number', new RegExp(`#[\\da-fA-F]{3,8}\\b|\\b-?\\d*\\.?\\d+(?:${CSS_UNITS})?\\b`)],
    ['function', /\b[\w-]+(?=\()/],
    ['tag', /\.[\w-]+|#[\w-]+|::?[\w-]+|\b[a-z]+(?=[^:;{}]*\{)/],
    ['punct', /[{}();:,>+~]/],
  ],
  html: [
    ['comment', /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>/],
    ['string', /"(?:\\.|[^\\"])*"|'(?:\\.|[^\\'])*'/],
    ['tag', /<\/?[\w:-]+|\/?>/],
    ['attr', /\b[\w:-]+(?==)/],
    ['punct', /[=]/],
  ],
  xml: null,
  svg: null,
  yaml: [
    ['comment', /#[^\n]*/],
    ['attr', /^[ \t]*[\w.-]+(?=\s*:)/m],
    ['string', /"(?:\\.|[^\\"\n])*"|'(?:\\.|[^\\'\n])*'/],
    ['literal', /\b(?:true|false|null|yes|no|on|off)\b/],
    ['number', /-?\b\d+(?:\.\d+)?\b/],
    ['punct', /^[ \t]*-(?=\s)|[:[\]{},]/m],
  ],
  sql: [
    ['comment', /--[^\n]*|\/\*[\s\S]*?\*\//],
    ['string', /'(?:''|[^'])*'/],
    ['keyword', new RegExp(`\\b(?:${SQL_KEYWORDS})\\b`, 'i')],
    ['number', /\b\d+(?:\.\d+)?\b/],
    ['punct', /[(),;*=<>]/],
  ],
  markdown: [
    ['heading', /^#{1,6} [^\n]*/m],
    ['comment', /^>[^\n]*/m],
    ['string', /`[^`\n]*`|```[\s\S]*?```/],
    ['keyword', /\*\*[^*\n]+\*\*|__[^_\n]+__/],
    ['function', /\[[^\]\n]*\]\([^)\n]*\)/],
    ['punct', /^[ \t]*[-*+](?= )|^[ \t]*\d+\.(?= )/m],
  ],
  shell: [
    ['comment', /#[^\n]*/],
    ['string', /"(?:\\.|[^\\"])*"|'[^']*'/],
    ['keyword', /\b(?:if|then|else|fi|for|in|do|done|while|case|esac|function|return|export|local|source|sudo|cd|echo|set)\b/],
    ['attr', /(?:^|\s)--?[\w-]+/],
    ['number', /\b\d+\b/],
    ['punct', /[|&;()<>$]/],
  ],
  python: [
    ['comment', /#[^\n]*/],
    ['string', /"""[\s\S]*?"""|f?"(?:\\.|[^\\"\n])*"|f?'(?:\\.|[^\\'\n])*'/],
    ['literal', /\b(?:True|False|None)\b/],
    ['keyword', new RegExp(`\\b(?:${PY_KEYWORDS})\\b`)],
    ['number', /\b0[xXbBoO][\da-fA-F_]+\b|\b\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?\b/],
    ['function', /\b[A-Za-z_]\w*(?=\s*\()/],
    ['attr', /@[\w.]+/],
    ['punct', /[{}[\]();,.:=+\-*/%<>!&|^~]/],
  ],
  plain: [],
};

GRAMMARS.xml = GRAMMARS.html;
GRAMMARS.svg = GRAMMARS.html;
GRAMMARS.js = GRAMMARS.javascript;
GRAMMARS.jsx = GRAMMARS.javascript;
GRAMMARS.ts = GRAMMARS.javascript;
GRAMMARS.typescript = GRAMMARS.javascript;
GRAMMARS.md = GRAMMARS.markdown;
GRAMMARS.yml = GRAMMARS.yaml;
GRAMMARS.bash = GRAMMARS.shell;
GRAMMARS.py = GRAMMARS.python;
GRAMMARS.sh = GRAMMARS.shell;
GRAMMARS.text = GRAMMARS.plain;

const compile = (rules) => {
  const source = rules.map(([, pattern]) => `(${pattern.source})`).join('|');
  const flags = `gm${rules.some(([, pattern]) => pattern.flags.includes('i')) ? 'i' : ''}`;
  return rules.length ? new RegExp(source, flags) : null;
};

const compiled = new Map();

const grammarFor = (language) => {
  const rules = GRAMMARS[language] ?? GRAMMARS.plain;
  if (!compiled.has(rules)) compiled.set(rules, { rules, pattern: compile(rules) });
  return compiled.get(rules);
};

export const highlight = (code, language = 'plain') => {
  const { rules, pattern } = grammarFor(language);
  if (!pattern) return escapeHtml(code);

  let out = '';
  let last = 0;
  pattern.lastIndex = 0;

  for (let match = pattern.exec(code); match; match = pattern.exec(code)) {
    const index = match.findIndex((group, position) => position > 0 && group !== undefined);
    if (index < 1) {
      pattern.lastIndex += 1;
      continue;
    }
    out += escapeHtml(code.slice(last, match.index));
    out += `<span class="tok-${rules[index - 1][0]}">${escapeHtml(match[0])}</span>`;
    last = match.index + match[0].length;
    if (match[0].length === 0) pattern.lastIndex += 1;
  }

  return out + escapeHtml(code.slice(last));
};


// the same colours as inline styles, for anywhere the classes cannot follow:
// a PDF, a Word file, an email
export const highlightInline = (code, language = 'plain') =>
  highlight(code, language).replace(
    /<span class="tok-([a-z]+)">/g,
    (whole, token) => `<span style="color:${TOKEN_COLOURS[token] ?? '#111111'}">`,
  );

export const LANGUAGES = [
  { id: 'plain', label: 'Plain text' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'typescript', label: 'TypeScript' },
  { id: 'json', label: 'JSON' },
  { id: 'html', label: 'HTML' },
  { id: 'css', label: 'CSS' },
  { id: 'python', label: 'Python' },
  { id: 'sql', label: 'SQL' },
  { id: 'yaml', label: 'YAML' },
  { id: 'shell', label: 'Shell' },
  { id: 'markdown', label: 'Markdown' },
];

export const TOKEN_COLOURS = {
  comment: '#6b7785',
  string: '#0a7d4b',
  number: '#9a5b00',
  keyword: '#8250df',
  literal: '#8250df',
  function: '#1a5fb4',
  tag: '#b02a37',
  attr: '#0a6e8a',
  punct: '#57606a',
  heading: '#8250df',
};
