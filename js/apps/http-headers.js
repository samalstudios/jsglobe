import { JGApp, define, html, css } from '../core/app.js';
import { debounce, copyText } from '../core/util.js';

const sheet = css`
  .split { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; flex: 1; min-height: 0; }
  @media (max-width: 900px) { .split { grid-template-columns: 1fr; } }
  .pane { display: flex; flex-direction: column; gap: 8px; min-width: 0; min-height: 0; overflow: auto; scrollbar-width: thin; }
  .grade {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 16px;
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
  }
  .badge-grade {
    display: grid;
    place-items: center;
    width: 54px;
    height: 54px;
    border-radius: 16px;
    font: 700 24px/1 var(--font-sans);
    color: #fff;
    flex: none;
  }
  .finding { display: grid; gap: 3px; padding: 9px 11px; border: 1px solid var(--border); border-radius: var(--radius-md); }
  .finding .head { display: flex; align-items: center; gap: 8px; }
  .finding .name { font-family: var(--font-mono); font-size: 12px; font-weight: 600; }
  .finding .note { font-size: 12px; color: var(--muted-foreground); line-height: 1.55; }
  .finding .value { font-family: var(--font-mono); font-size: 11px; color: var(--foreground); overflow-wrap: anywhere; }
  .findings { display: grid; gap: 6px; }
  .dot { width: 8px; height: 8px; border-radius: 999px; flex: none; }
  .dot[data-level="good"] { background: var(--success); }
  .dot[data-level="warn"] { background: var(--warning); }
  .dot[data-level="bad"] { background: var(--destructive); }
  .dot[data-level="info"] { background: var(--muted-foreground); }
`;

const SAMPLE = `HTTP/2 200
content-type: text/html; charset=utf-8
strict-transport-security: max-age=31536000
x-content-type-options: nosniff
referrer-policy: strict-origin-when-cross-origin
server: nginx/1.24.0
set-cookie: session=abc123; Path=/; HttpOnly
cache-control: no-cache
x-powered-by: Express`;

const parse = (text) => {
  const headers = new Map();
  let status = null;

  text.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const statusLine = /^HTTP\/[\d.]+\s+(\d{3})/i.exec(trimmed);
    if (statusLine) {
      status = Number(statusLine[1]);
      return;
    }
    const index = trimmed.indexOf(':');
    if (index < 1) return;
    const name = trimmed.slice(0, index).trim().toLowerCase();
    const value = trimmed.slice(index + 1).trim();
    headers.set(name, headers.has(name) ? `${headers.get(name)}, ${value}` : value);
  });

  return { headers, status };
};

const CHECKS = [
  {
    name: 'strict-transport-security',
    weight: 20,
    review: (value) => {
      if (!value) return { level: 'bad', note: 'Missing. Browsers will try plain HTTP first on the next visit.' };
      const age = /max-age=(\d+)/i.exec(value);
      if (!age || Number(age[1]) < 15552000) {
        return { level: 'warn', note: 'Present, but max-age is under six months, which most preload lists reject.' };
      }
      return { level: 'good', note: `Forces HTTPS for ${Math.round(Number(age[1]) / 86400)} days.` };
    },
  },
  {
    name: 'content-security-policy',
    weight: 22,
    review: (value) => {
      if (!value) return { level: 'bad', note: 'Missing. This is the main defence against injected scripts.' };
      if (/unsafe-inline/.test(value) && /script-src|default-src/.test(value)) {
        return { level: 'warn', note: "Set, but 'unsafe-inline' in a script directive undoes much of the protection." };
      }
      if (!/(default|script)-src/.test(value)) return { level: 'warn', note: 'Set without a script-src or default-src directive.' };
      return { level: 'good', note: 'Script sources are restricted.' };
    },
  },
  {
    name: 'x-content-type-options',
    weight: 10,
    review: (value) =>
      /nosniff/i.test(value ?? '')
        ? { level: 'good', note: 'Stops the browser guessing content types.' }
        : { level: 'bad', note: 'Missing nosniff, so a mistyped response can be run as script.' },
  },
  {
    name: 'x-frame-options',
    weight: 8,
    review: (value, headers) => {
      const csp = headers.get('content-security-policy') ?? '';
      if (/frame-ancestors/.test(csp)) return { level: 'good', note: 'Covered by frame-ancestors in the policy.' };
      if (!value) return { level: 'warn', note: 'Missing, and the policy has no frame-ancestors, so the page can be framed.' };
      return { level: 'good', note: 'Framing is restricted.' };
    },
  },
  {
    name: 'referrer-policy',
    weight: 8,
    review: (value) => {
      if (!value) return { level: 'warn', note: 'Missing. Full URLs may leak to other sites.' };
      if (/unsafe-url|no-referrer-when-downgrade/i.test(value)) return { level: 'warn', note: 'This value still sends full URLs across origins.' };
      return { level: 'good', note: 'Referrer information is limited.' };
    },
  },
  {
    name: 'permissions-policy',
    weight: 6,
    review: (value) =>
      value
        ? { level: 'good', note: 'Powerful features are gated.' }
        : { level: 'warn', note: 'Missing. Camera, microphone and geolocation stay available to embedded frames.' },
  },
  {
    name: 'cross-origin-opener-policy',
    weight: 6,
    review: (value) =>
      value
        ? { level: 'good', note: 'The browsing context is isolated from openers.' }
        : { level: 'warn', note: 'Missing. Cross origin windows keep a handle on this page.' },
  },
  {
    name: 'cross-origin-resource-policy',
    weight: 4,
    review: (value) =>
      value
        ? { level: 'good', note: 'Other sites cannot embed these responses freely.' }
        : { level: 'info', note: 'Not set. Useful when a response should not be readable cross origin.' },
  },
  {
    name: 'set-cookie',
    weight: 10,
    review: (value) => {
      if (!value) return { level: 'info', note: 'No cookies are set on this response.' };
      const missing = [];
      if (!/httponly/i.test(value)) missing.push('HttpOnly');
      if (!/secure/i.test(value)) missing.push('Secure');
      if (!/samesite/i.test(value)) missing.push('SameSite');
      return missing.length
        ? { level: 'warn', note: `Cookies are missing ${missing.join(', ')}.` }
        : { level: 'good', note: 'Cookies carry HttpOnly, Secure and SameSite.' };
    },
  },
  {
    name: 'content-type',
    weight: 6,
    review: (value) => {
      if (!value) return { level: 'warn', note: 'Missing. The browser has to guess how to treat the body.' };
      if (/text\/html/i.test(value) && !/charset/i.test(value)) return { level: 'warn', note: 'HTML without a charset invites encoding attacks.' };
      return { level: 'good', note: 'Type and encoding are declared.' };
    },
  },
];

const LEAKY = {
  server: 'Reveals the server software and often its version.',
  'x-powered-by': 'Reveals the framework behind the app. Remove it.',
  'x-aspnet-version': 'Reveals the ASP.NET version. Remove it.',
  'x-aspnetmvc-version': 'Reveals the ASP.NET MVC version. Remove it.',
  'x-generator': 'Reveals the generator used to build the site.',
  via: 'Exposes intermediate proxies.',
};

const GRADES = [
  [90, 'A', 'var(--success)'],
  [75, 'B', '#4a7a58'],
  [60, 'C', 'var(--warning)'],
  [40, 'D', '#96703f'],
  [0, 'F', 'var(--destructive)'],
];

class HttpHeaders extends JGApp {
  static appId = 'http-headers';
  static styles = [...JGApp.styles, sheet];

  renderApp() {
    this.paint(html`<div class="app">
      <div class="row">
        <jg-button size="sm" variant="outline" id="sample">Sample response</jg-button>
        <jg-button size="sm" variant="ghost" id="clear">Clear</jg-button>
        <span class="grow"></span>
        <jg-button size="sm" variant="ghost" id="copy">Copy report</jg-button>
      </div>

      <div class="split">
        <div class="pane">
          <span class="label">Paste response headers</span>
          <jg-code id="input" grow language="plain" placeholder="curl -I https://example.com"></jg-code>
          <div class="hint">
            Paste the output of <span class="mono">curl -I</span> or the response headers from developer tools.
            Nothing is requested from here, so no site sees the check.
          </div>
        </div>

        <div class="pane">
          <div class="grade">
            <span class="badge-grade" id="grade">-</span>
            <div>
              <div id="summary" style="font-weight:600">Waiting for headers</div>
              <div class="hint" id="counts"></div>
            </div>
          </div>
          <div class="findings" id="findings"></div>
        </div>
      </div>
    </div>`);

    this.on(this.$('#input'), 'input', debounce(() => this.#run(), 250));
    this.on(this.$('#sample'), 'click', () => {
      this.$('#input').value = SAMPLE;
      this.#run();
    });
    this.on(this.$('#clear'), 'click', () => {
      this.$('#input').value = '';
      this.#run();
    });
    this.on(this.$('#copy'), 'click', () => copyText(this.#report()));

    const saved = this.store.read({ text: '' });
    this.$('#input').value = saved.text || SAMPLE;
    this.#run();
  }

  #analyse() {
    const { headers, status } = parse(this.$('#input').value);
    if (!headers.size) return null;

    const findings = CHECKS.map((check) => {
      const value = headers.get(check.name);
      const result = check.review(value, headers);
      return { name: check.name, value, weight: check.weight, ...result };
    });

    [...headers.keys()]
      .filter((name) => LEAKY[name])
      .forEach((name) => findings.push({ name, value: headers.get(name), weight: 4, level: 'warn', note: LEAKY[name] }));

    const total = findings.reduce((sum, finding) => sum + finding.weight, 0);
    const earned = findings.reduce((sum, finding) => {
      const share = { good: 1, info: 0.85, warn: 0.45, bad: 0 }[finding.level];
      return sum + finding.weight * share;
    }, 0);

    return { headers, status, findings, score: Math.round((earned / total) * 100) };
  }

  #report() {
    const analysis = this.#analyse();
    if (!analysis) return '';
    return [
      `Header review${analysis.status ? ` for a ${analysis.status} response` : ''}`,
      `Score ${analysis.score} of 100`,
      '',
      ...analysis.findings.map((finding) => `[${finding.level}] ${finding.name}: ${finding.note}`),
    ].join('\n');
  }

  #run() {
    this.store.write({ text: this.$('#input').value });
    const analysis = this.#analyse();

    if (!analysis) {
      this.$('#grade').textContent = '-';
      this.$('#grade').style.background = 'var(--muted-foreground)';
      this.$('#summary').textContent = 'Waiting for headers';
      this.$('#counts').textContent = '';
      this.$('#findings').innerHTML = '';
      return;
    }

    const [, letter, colour] = GRADES.find(([threshold]) => analysis.score >= threshold);
    const counts = analysis.findings.reduce((totals, finding) => ({ ...totals, [finding.level]: (totals[finding.level] ?? 0) + 1 }), {});

    this.$('#grade').textContent = letter;
    this.$('#grade').style.background = colour;
    this.$('#summary').textContent = `${analysis.score} of 100${analysis.status ? ` on a ${analysis.status} response` : ''}`;
    this.$('#counts').textContent = `${analysis.headers.size} headers - ${counts.good ?? 0} good, ${counts.warn ?? 0} to improve, ${counts.bad ?? 0} missing`;

    const order = { bad: 0, warn: 1, info: 2, good: 3 };
    this.$('#findings').innerHTML = [...analysis.findings]
      .sort((a, b) => order[a.level] - order[b.level])
      .map(
        (finding) => html`<div class="finding">
          <span class="head">
            <span class="dot" data-level="${finding.level}"></span>
            <span class="name">${finding.name}</span>
          </span>
          <span class="note">${finding.note}</span>
          ${finding.value ? html`<span class="value">${finding.value}</span>` : ''}
        </div>`,
      )
      .join('');
  }
}

define('jg-app-http-headers', HttpHeaders);
