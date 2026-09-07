import { JGApp, define, html, styleSheet } from '../../core/app.js';
import { appWords } from '../../core/i18n.js';
import { icon } from '../../ui/icons.js';
import { debounce, copyText, toast } from '../../core/util.js';
import { STATUSES, CLASSES, statusByCode, classOf, searchStatuses } from '../../lib/http-status.js';

const t = await appWords('http-status', (lang) => import(`./i18n/${lang}.js`));

const sheet = await styleSheet(import.meta.url);

const CLASS_NAME = {
  1: () => t('http-status.informational', 'Informational'),
  2: () => t('http-status.success', 'Success'),
  3: () => t('http-status.redirection', 'Redirection'),
  4: () => t('http-status.clientError', 'Client error'),
  5: () => t('http-status.serverError', 'Server error'),
};

class HttpStatus extends JGApp {
  static appId = 'http-status';
  static styles = [...JGApp.styles, sheet];

  #open = null;

  renderApp() {
    this.paint(html`<div class="app">
      <jg-input id="search" placeholder="${t('http-status.searchByCodeOrMeaning', 'Search by code or meaning - 404, timeout, redirect')}"></jg-input>
      <div class="row"><jg-tabs id="filter"></jg-tabs></div>

      <div class="split">
        <div id="list" class="list"></div>

        <aside class="detail" id="detail" hidden>
          <button class="shut" id="shut" title="${t('http-status.close', 'Close')}">${icon('close', 14)}</button>
          <div class="crown">
            <span class="big" id="big"></span>
            <div class="titles">
              <span class="title" id="title"></span>
              <span class="family" id="family"></span>
            </div>
          </div>
          <p class="summary" id="summary"></p>

          <div class="block">
            <span class="label">${t('http-status.whenToUseIt', 'When to use it')}</span>
            <ul class="uses" id="uses"></ul>
          </div>

          <div class="block" id="notesblock">
            <span class="label">${t('http-status.worthKnowing', 'Worth knowing')}</span>
            <p class="notes" id="notes"></p>
          </div>

          <div class="block" id="nearblock">
            <span class="label">${t('http-status.easilyConfusedWith', 'Easily confused with')}</span>
            <div class="near" id="near"></div>
          </div>

          <div class="foot">
            <span class="rfc" id="rfc"></span>
            <span class="grow"></span>
            <button class="tool" id="copy" title="${t('http-status.copy', 'Copy')}">${icon('copy', 14)}</button>
          </div>
        </aside>
      </div>
    </div>`);

    this.$('#filter').items = [
      { value: 'all', label: t('http-status.all', 'All') },
      ...Object.entries(CLASSES).map(([key]) => ({ value: key, label: `${key}xx ${CLASS_NAME[key]()}` })),
    ];

    this.on(this.$('#search'), 'input', debounce(() => this.#run(), 120));
    this.on(this.$('#filter'), 'change', () => this.#run());
    this.on(this.$('#shut'), 'click', () => this.#close());
    this.on(this.$('#copy'), 'click', () => this.#copy());

    this.on(this.$('#list'), 'click', (event) => {
      const row = event.target.closest('[data-code]');
      if (row) this.#show(Number(row.dataset.code));
    });

    this.on(this.$('#near'), 'click', (event) => {
      const chip = event.target.closest('[data-code]');
      if (chip) this.#show(Number(chip.dataset.code));
    });

    this.listen(window, 'keydown', (event) => {
      if (event.key !== 'Escape' || this.offsetParent === null || !this.#open) return;
      event.preventDefault();
      this.#close();
    });

    this.#run();
  }

  #run() {
    const matches = searchStatuses(this.$('#search').value, this.$('#filter').value);
    const groups = [...new Set(matches.map((status) => classOf(status.code)))];

    this.$('#list').innerHTML = matches.length
      ? groups
          .map(
            (group) => html`<div class="group">
              <h3>${group}xx - ${CLASS_NAME[group]?.() ?? CLASSES[group].name}</h3>
              ${matches
                .filter((status) => classOf(status.code) === group)
                .map(
                  (status) => html`<button class="status" data-code="${status.code}" data-class="${group}"
                    aria-pressed="${String(status.code === this.#open)}">
                    <span class="code">${status.code}</span>
                    <span class="what"><span class="name">${status.name}</span><span class="desc">${status.summary}</span></span>
                    <span class="more">${icon('chevronRight', 14)}</span>
                  </button>`,
                )}
            </div>`,
          )
          .join('')
      : html`<jg-empty glyph="⌕" title="${t('http-status.noMatches', 'No matches')}">${t('http-status.tryACodeLike404', 'Try a code like 404 or a word like "timeout".')}</jg-empty>`;
  }

  #show(code) {
    const status = statusByCode(code);
    if (!status) return;
    this.#open = code;

    const group = classOf(code);
    const detail = this.$('#detail');
    detail.hidden = false;
    detail.dataset.class = group;

    this.$('#big').textContent = String(status.code);
    this.$('#title').textContent = status.name;
    this.$('#family').textContent = `${group}xx · ${CLASS_NAME[group]?.() ?? CLASSES[group].name}`;
    this.$('#summary').textContent = status.summary;

    this.$('#uses').innerHTML = (status.uses ?? []).map((use) => `<li>${use}</li>`).join('');

    this.$('#notesblock').hidden = !status.notes;
    this.$('#notes').textContent = status.notes ?? '';

    const near = (status.related ?? []).map((other) => statusByCode(other)).filter(Boolean);
    this.$('#nearblock').hidden = !near.length;
    this.$('#near').innerHTML = near
      .map(
        (other) =>
          `<button class="chip" data-code="${other.code}" data-class="${classOf(other.code)}">` +
          `<b>${other.code}</b> ${other.name}</button>`,
      )
      .join('');

    this.$('#rfc').textContent = status.rfc ?? '';

    for (const row of this.$$('[data-code]')) {
      if (row.classList.contains('status')) row.setAttribute('aria-pressed', String(Number(row.dataset.code) === code));
    }
    this.$(`.status[data-code="${code}"]`)?.scrollIntoView({ block: 'nearest' });
  }

  #close() {
    this.#open = null;
    this.$('#detail').hidden = true;
    for (const row of this.$$('.status')) row.setAttribute('aria-pressed', 'false');
  }

  #copy() {
    const status = statusByCode(this.#open);
    if (!status) return;
    const lines = [
      `${status.code} ${status.name}`,
      status.summary,
      '',
      ...(status.uses ?? []).map((use) => `- ${use}`),
    ];
    if (status.notes) lines.push('', status.notes);
    if (status.rfc) lines.push('', status.rfc);
    copyText(lines.join('\n'));
    toast(t('http-status.copied', 'Copied {code}', { code: status.code }));
  }

  renderWidget() {
    this.paint(html`<div class="app" style="padding:12px">
      <div class="stack tight">
        <div class="label">${t('http-status.httpStatus', 'HTTP Status')}</div>
        <div class="hint">${t('http-status.widgetBlurb', 'Every status code, what it means and when to reach for it.')}</div>
      </div>
    </div>`);
  }
}

define('jg-app-http-status', HttpStatus);
