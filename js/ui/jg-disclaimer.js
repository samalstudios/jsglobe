import { JGElement, define, css, html } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { base } from './styles.js';
import { router } from '../core/router.js';
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
  .updated { color: var(--muted-foreground); font-size: 12px; text-align: center; }
`;

class JGDisclaimer extends JGElement {
  static styles = [base, sheet];

  render() {
    this.paint(html`
      <div class="sheet">
        <header>
          <div>
            <h1>${t('disclaimer.title', 'Disclaimer')}</h1>
            <div class="sub">${t('disclaimer.sub', 'What these tools can be relied on for, and what they cannot.')}</div>
          </div>
          <button class="close" title="${t('action.close', 'Close')}">✕</button>
        </header>

        <section>
          <h2>${t('disclaimer.estimates.h', 'Results are estimates')}</h2>
          <p>${t('disclaimer.estimates.p', 'The tools here are built to be useful and are checked against worked examples, but they are simplified models of complicated rules. Tax, currency, unit and finance tools in particular leave things out, and rules change from year to year. Treat every figure as a starting point to be confirmed, not as an answer to act on.')}</p>
        </section>

        <section>
          <h2>${t('disclaimer.advice.h', 'Not professional advice')}</h2>
          <p>${t('disclaimer.advice.p', 'Nothing on this site is legal, tax, financial, medical or engineering advice, and using it creates no professional relationship. For anything that carries real consequence, ask someone qualified who knows your circumstances.')}</p>
        </section>

        <section>
          <h2>${t('disclaimer.data.h', 'Data from elsewhere')}</h2>
          <p>${t('disclaimer.data.p', 'Some tools fetch data from public services when you ask them to, such as exchange rates, prices and domain lookups. That data belongs to those services, may be delayed or wrong, and is passed on as it arrives without any checking.')}</p>
        </section>

        <section>
          <h2>${t('disclaimer.asis.h', 'Offered as they are')}</h2>
          <p>${t('disclaimer.asis.p', 'These tools come without warranty of any kind. They may contain mistakes, may be unavailable, and may change or disappear. To the extent the law allows, no liability is accepted for any loss arising from using them or relying on what they produce.')}</p>
          <ul>
            <li>${t('disclaimer.check.keys', 'Keys, passwords and certificates generated here are for testing and convenience. Judge for yourself whether they suit anything that matters.')}</li>
            <li>${t('disclaimer.check.copy', 'You are responsible for the content you paste in and for what you do with the output.')}</li>
            <li>${t('disclaimer.check.links', 'Links to other sites are for convenience, and those sites are not under our control.')}</li>
          </ul>
        </section>

        <section>
          <h2>${t('disclaimer.source.h', 'Read the code')}</h2>
          <p>${t('disclaimer.source.p', 'The site is open source, so you can check exactly what any tool does rather than take its word for it. Mistakes are worth reporting as an issue.')}</p>
          <p><a href="${REPO_URL}" target="_blank" rel="noopener noreferrer">${REPO_URL.replace('https://', '')}</a></p>
        </section>

        <div class="updated">${t('disclaimer.updated', 'Last updated 24 August 2026')}</div>
      </div>
    `);

    this.on(this.$('.close'), 'click', () => router.home());
  }
}

define('jg-disclaimer', JGDisclaimer);
