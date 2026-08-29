import { JGApp, define, html, styleSheet } from '../../core/app.js';
import { appText } from '../../core/i18n.js';
import strings from './i18n.js';
import { icon } from '../../ui/icons.js';
import { copyText, download, debounce, toast } from '../../core/util.js';
import { templates, GROUPS, buildIgnore, ignores, reviewRules } from '../../lib/gitignore.js';

const t = appText(strings);

const sheet = await styleSheet(import.meta.url);

const ALL = templates();

const GROUP_NAME = {
  language: () => t('gitignore-generator.languages', 'Languages'),
  framework: () => t('gitignore-generator.frameworks', 'Frameworks'),
  tooling: () => t('gitignore-generator.tools', 'Tools'),
  system: () => t('gitignore-generator.systems', 'Systems'),
  editor: () => t('gitignore-generator.editors', 'Editors'),
};

const TRY_PATHS = ['node_modules/left-pad/index.js', 'src/app.js', '.env', '.DS_Store', 'dist/bundle.js', 'README.md'];

class GitignoreGenerator extends JGApp {
  static appId = 'gitignore-generator';
  static settings = [
    { key: 'header', label: t('gitignore-generator.writeAHeader', 'Write a header line'), type: 'switch', default: true },
  ];
  static styles = [...JGApp.styles, sheet];

  #picked = new Set();
  #hunt = '';

  renderApp() {
    const saved = this.store.read();
    this.#picked = new Set(saved?.picked ?? ['node', 'macos']);

    this.paint(html`<div class="app">
      <div class="split">
        <div class="side">
          <jg-input id="hunt" size="sm" placeholder="${t('gitignore-generator.findATemplate', 'Find a template')}"></jg-input>
          <div class="picked" id="picked"></div>
          <div class="list" id="list"></div>
        </div>

        <div class="main">
          <div class="pane">
            <div class="head">
              <span class="label">.gitignore</span>
              <span class="grow"></span>
              <span class="hint" id="tally"></span>
            </div>
            <jg-code id="output" grow gutter language="shell" readonly></jg-code>
          </div>

          <div class="foot">
            <div class="pane short">
              <span class="label">${t('gitignore-generator.rulesOfYourOwn', 'Rules of your own')}</span>
              <jg-code id="extra" rows="4" language="shell"
                placeholder="${t('gitignore-generator.onePerLine', 'One per line, comments start with #')}"></jg-code>
            </div>

            <div class="pane short">
              <span class="label">${t('gitignore-generator.wouldThisBeIgnored', 'Would this be ignored?')}</span>
              <jg-input id="probe" size="sm" placeholder="src/app.js"></jg-input>
              <div class="tries" id="tries"></div>
              <div class="verdict" id="verdict"></div>
            </div>
          </div>
        </div>
      </div>

      <p class="note" id="review"></p>
    </div>`);

    this.setActions([
      { id: 'copy', label: t('gitignore-generator.copy', 'Copy'), icon: 'copy', action: () => this.#copy() },
      { id: 'download', label: t('gitignore-generator.download', 'Download'), icon: 'download', action: () => this.#download() },
      { spacer: true },
      { id: 'clear', label: t('gitignore-generator.startOver', 'Start over'), icon: 'eraser', action: () => this.#clear() },
    ]);

    this.on(this.$('#hunt'), 'input', () => {
      this.#hunt = this.$('#hunt').value.trim().toLowerCase();
      this.#drawList();
    });

    this.on(this.$('#list'), 'click', (event) => {
      const card = event.target.closest('[data-pick]');
      if (card) this.#toggle(card.dataset.pick);
    });

    this.on(this.$('#picked'), 'click', (event) => {
      const chip = event.target.closest('[data-drop]');
      if (chip) this.#toggle(chip.dataset.drop);
    });

    this.on(this.$('#extra'), 'input', debounce(() => this.#build(), 250));
    this.on(this.$('#probe'), 'input', debounce(() => this.#test(), 150));
    this.on(this.$('#tries'), 'click', (event) => {
      const chip = event.target.closest('[data-try]');
      if (!chip) return;
      this.$('#probe').value = chip.dataset.try;
      this.#test();
    });

    this.#drawTries();
    this.#drawList();
    this.#build();
  }

  #toggle(id) {
    if (this.#picked.has(id)) this.#picked.delete(id);
    else this.#picked.add(id);
    this.store.write({ picked: [...this.#picked] });
    this.#drawList();
    this.#build();
  }

  #clear() {
    this.#picked.clear();
    this.$('#extra').value = '';
    this.store.write({ picked: [] });
    this.#drawList();
    this.#build();
  }

  #drawTries() {
    this.$('#tries').innerHTML = TRY_PATHS.map(
      (path) => `<button class="try" data-try="${path}">${path}</button>`,
    ).join('');
  }

  #drawList() {
    const host = this.$('#list');
    const chips = this.$('#picked');

    const order = [...this.#picked].map((id) => ALL.find((entry) => entry.id === id)).filter(Boolean);
    chips.innerHTML = order.length
      ? order
          .map((entry) => `<button class="chip" data-drop="${entry.id}">${entry.name}<i>&times;</i></button>`)
          .join('')
      : `<span class="hint">${t('gitignore-generator.pickWhatYouUse', 'Pick what this project uses')}</span>`;

    const shown = ALL.filter((entry) => !this.#hunt || entry.name.toLowerCase().includes(this.#hunt) || entry.id.includes(this.#hunt));

    host.innerHTML = GROUPS.map((group) => {
      const rows = shown.filter((entry) => entry.group === group.id);
      if (!rows.length) return '';
      return (
        `<div class="group"><span class="groupname">${GROUP_NAME[group.id]?.() ?? group.name}</span>` +
        rows
          .map(
            (entry) =>
              `<button class="pick" data-pick="${entry.id}" aria-pressed="${String(this.#picked.has(entry.id))}">` +
              `<span class="tick"></span><span class="name">${entry.name}</span>` +
              `<span class="count">${entry.rules.length}</span></button>`,
          )
          .join('') +
        '</div>'
      );
    }).join('');

    if (!shown.length) {
      host.innerHTML = `<p class="hint">${t('gitignore-generator.nothingMatched', 'Nothing matched that search')}</p>`;
    }
  }

  #order() {
    return ALL.filter((entry) => this.#picked.has(entry.id)).map((entry) => entry.id);
  }

  #text() {
    const body = buildIgnore(this.#order(), this.$('#extra')?.value ?? '');
    if (this.config.get('header', true) === false) return body;
    return `# Built with Toolbox, all of it on this device\n\n${body}`;
  }

  #build() {
    const text = this.#text();
    this.$('#output').value = text;

    const lines = text.split('\n');
    const review = reviewRules(lines);
    this.$('#tally').textContent = t('gitignore-generator.ruleCount', '{count} rules', { count: review.rules });

    const notes = [];
    if (review.repeated.length) {
      notes.push(t('gitignore-generator.repeatedRules', '{count} rules appear twice', { count: review.repeated.length }));
    }
    if (review.looseNegations.length) {
      notes.push(
        t('gitignore-generator.looseNegations', '{count} unignore rules have nothing above them to undo', {
          count: review.looseNegations.length,
        }),
      );
    }
    const note = this.$('#review');
    note.textContent = notes.join(' · ');
    note.hidden = !notes.length;

    this.#test();
  }

  #test() {
    const path = this.$('#probe')?.value.trim();
    const verdict = this.$('#verdict');
    if (!path) {
      verdict.innerHTML = '';
      return;
    }
    const hit = ignores(this.#text().split('\n'), path);
    verdict.innerHTML =
      `<span class="badge ${hit ? 'out' : 'in'}">${icon(hit ? 'close' : 'checkSquare', 13)}` +
      `${hit ? t('gitignore-generator.ignored', 'Ignored') : t('gitignore-generator.kept', 'Kept in the repository')}</span>`;
  }

  #copy() {
    copyText(this.#text());
    toast(t('gitignore-generator.copied', 'Copied the .gitignore'));
  }

  #download() {
    download('.gitignore', this.#text(), 'text/plain');
  }

  renderWidget() {
    this.paint(html`<div class="app" style="padding:12px">
      <div class="stack tight">
        <div class="label">${t('gitignore-generator.gitignore', 'GitIgnore')}</div>
        <div class="hint">${t('gitignore-generator.widgetBlurb', 'Build a .gitignore from the tools you use.')}</div>
      </div>
    </div>`);
  }
}

define('jg-app-gitignore-generator', GitignoreGenerator);
