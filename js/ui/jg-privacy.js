import { JGElement, define, css, html } from '../core/dom.js';
import { base } from './styles.js';
import { consent } from '../core/consent.js';
import { analytics } from '../core/analytics.js';
import { router } from '../core/router.js';
import { bus } from '../core/bus.js';
import { REPO_URL } from '../core/site.js';

const sheet = css`
  :host {
    position: absolute;
    inset: 0;
    z-index: 55;
    overflow: auto;
    padding: 28px 20px 60px;
    background: color-mix(in srgb, var(--background) 78%, transparent);
    backdrop-filter: blur(22px);
    -webkit-backdrop-filter: blur(22px);
    scrollbar-width: thin;
  }
  .sheet {
    width: min(760px, 100%);
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 18px;
  }
  header { display: flex; align-items: flex-start; gap: 14px; }
  h1 { margin: 0; font-size: 22px; letter-spacing: -0.01em; }
  .sub { color: var(--muted-foreground); font-size: 13px; margin-top: 4px; }
  .close {
    appearance: none;
    margin-left: auto;
    width: 32px;
    height: 32px;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: var(--card);
    color: var(--muted-foreground);
    cursor: pointer;
    flex: none;
  }
  .close:hover { color: var(--foreground); }

  section {
    padding: 16px 18px;
    border-radius: var(--radius-lg);
    border: 1px solid var(--border);
    background: color-mix(in srgb, var(--card) 88%, transparent);
  }
  h2 { margin: 0 0 8px; font-size: 14px; }
  p, li { color: var(--muted-foreground); font-size: 13px; line-height: 1.65; margin: 0 0 8px; }
  ul { margin: 0; padding-left: 20px; list-style: disc; }
  li::marker { color: color-mix(in srgb, var(--muted-foreground) 70%, transparent); }
  a { color: var(--foreground); }
  code { font-family: var(--font-mono); font-size: 12px; }

  .choice { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .state { font-size: 13px; color: var(--foreground); }
  button.action {
    appearance: none;
    height: 30px;
    padding: 0 12px;
    border-radius: var(--radius-md);
    border: 1px solid var(--border);
    background: transparent;
    color: var(--foreground);
    font: 500 12.5px/1 var(--font-sans);
    cursor: pointer;
  }
  button.action:hover { background: var(--accent); border-color: var(--border-strong); }
  .updated { color: var(--muted-foreground); font-size: 12px; text-align: center; }
`;

const LABELS = {
  granted: 'Analytics cookies are allowed on this device.',
  denied: 'Analytics cookies are declined on this device.',
  unknown: 'You have not answered the cookie banner yet.',
};

class JGPrivacy extends JGElement {
  static styles = [base, sheet];

  connectedCallback() {
    super.connectedCallback();
    this.keep(bus.on('consent:change', () => this.refresh()));
  }

  render() {
    this.paint(html`
      <div class="sheet">
        <header>
          <div>
            <h1>Privacy policy</h1>
            <div class="sub">Toolbox is a static site. Your data stays in your browser.</div>
          </div>
          <button class="close" title="Close">✕</button>
        </header>

        <section>
          <h2>What the tools do with your data</h2>
          <p>
            Every tool runs as JavaScript inside your browser. Text you type, files you open and images you drop
            are processed on your device and are never sent to a server. Saved notes, tasks, settings and app state
            live in this browser's local storage and IndexedDB, and you can erase them from Settings under Data.
          </p>
          <p>
            Some tools call a third party only when you explicitly ask them to: DNS lookups go to Cloudflare or
            Google resolvers, the speed test uses Cloudflare, the portfolio tool can fetch free public prices from
            CoinGecko or an open exchange rate dataset, and the local AI and media tools download model or codec
            files from public CDNs. Those requests carry only what the feature needs, such as a domain name or a
            ticker symbol.
          </p>
        </section>

        <section>
          <h2>Cookies and analytics</h2>
          <p>
            We use Google Analytics 4 (measurement id <code>${analytics.id}</code>) to count page views so we know
            which tools are worth improving. It only loads after you accept, and it is configured with IP
            anonymisation, no advertising storage and no personalisation signals. It never receives the content you
            type, paste or upload.
          </p>
          <p>Declining means no analytics cookies are set and no data is sent to Google.</p>
          <div class="choice">
            <span class="state" id="state">${LABELS[consent.state]}</span>
            <button class="action" id="accept">Allow analytics</button>
            <button class="action" id="decline">Decline analytics</button>
            <button class="action" id="reset">Ask me again</button>
          </div>
        </section>

        <section>
          <h2>What we never do</h2>
          <ul>
            <li>No accounts, no sign up, no email collection.</li>
            <li>No advertising, no cross site tracking, no data sold or shared.</li>
            <li>No uploading of the files or text you use in a tool.</li>
          </ul>
        </section>

        <section>
          <h2>Your rights and the source</h2>
          <p>
            You can withdraw consent at any time on this page or in Settings, and clear every stored value with
            "Erase all data". Because the site holds no account data, there is nothing for us to delete on your
            behalf.
          </p>
          <p>
            The site is open source. You can read exactly what it does at
            <a href="${REPO_URL}" target="_blank" rel="noopener noreferrer">github.com/samalstudios/jsglobe</a>,
            and questions or requests can be raised as an issue there.
          </p>
        </section>

        <div class="updated">Last updated 13 August 2026</div>
      </div>
    `);

    this.on(this.$('.close'), 'click', () => router.home());
    this.on(this.$('#accept'), 'click', () => {
      consent.set(true);
      analytics.start();
    });
    this.on(this.$('#decline'), 'click', () => {
      consent.set(false);
      analytics.stop();
    });
    this.on(this.$('#reset'), 'click', () => consent.reset());
  }
}

define('jg-privacy', JGPrivacy);
