import { JGApp, define, html, styleSheet } from '../../core/app.js';
import { appWords } from '../../core/i18n.js';
import { uid } from '../../core/util.js';

const t = await appWords('todo', (lang) => import(`./i18n/${lang}.js`));

const sheet = await styleSheet(import.meta.url);

class TodoApp extends JGApp {
  static appId = 'todo';
  static styles = [...JGApp.styles, sheet];

  #filter = 'all';

  #tasks() {
    return this.store.read([]);
  }

  #save(tasks) {
    this.store.write(tasks);
  }

  renderWidget() {
    const tasks = this.#tasks();
    const open = tasks.filter((task) => !task.done);
    this.paint(html`<div class="app" style="padding:0">
      <div class="widget">
        <div class="label">${open.length} open · ${tasks.length - open.length} done</div>
        ${tasks.slice(0, 5).map(
          (task) => html`<div class="line">
            <span class="dot" data-done="${String(task.done)}"></span>
            <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${task.text}</span>
          </div>`,
        )}
        ${tasks.length ? '' : html`<div class="hint">${t('todo.nothingOnTheList', 'Nothing on the list.')}</div>`}
      </div>
    </div>`);
  }

  renderApp() {
    const tasks = this.#tasks();
    const visible = tasks.filter((task) =>
      this.#filter === 'all' ? true : this.#filter === 'open' ? !task.done : task.done,
    );

    this.paint(html`<div class="app">
      <div class="row nowrap">
        <jg-input id="input" class="grow" placeholder="${t('todo.whatNeedsDoing', 'What needs doing?')}"></jg-input>
        <jg-button id="add">${t('todo.add', 'Add')}</jg-button>
      </div>

      <div class="spread">
        <jg-tabs id="filter"></jg-tabs>
        <span class="hint">${tasks.filter((task) => !task.done).length} of ${tasks.length} open</span>
      </div>

      <div class="stack tight">
        ${visible.length
          ? visible.map(
              (task) => html`<div class="task" data-done="${String(task.done)}" data-id="${task.id}">
                <button class="check" data-toggle="${task.id}">✓</button>
                <span class="text">${task.text}</span>
                <jg-button class="del" size="icon-sm" variant="ghost" data-remove="${task.id}">✕</jg-button>
              </div>`,
            )
          : html`<jg-empty glyph="✓" title="${t('todo.allClear', 'All clear')}">${t('todo.nothingInThisView', 'Nothing in this view.')}</jg-empty>`}
      </div>

      ${tasks.some((task) => task.done)
        ? html`<div class="row"><jg-button size="sm" variant="ghost" id="clear">${t('todo.clearCompleted', 'Clear completed')}</jg-button></div>`
        : ''}
    </div>`);

    this.$('#filter').items = [
      { value: 'all', label: t('todo.all', 'All') },
      { value: 'open', label: t('todo.open', 'Open') },
      { value: 'done', label: t('todo.done', 'Done') },
    ];
    this.$('#filter').value = this.#filter;
    this.on(this.$('#filter'), 'change', (event) => {
      this.#filter = event.detail.value;
      this.refresh();
    });

    const add = () => {
      const text = this.$('#input').value.trim();
      if (!text) return;
      this.#save([...tasks, { id: uid().slice(0, 8), text, done: false, created: Date.now() }]);
      this.refresh();
      this.$('#input').focus();
    };
    this.on(this.$('#add'), 'click', add);
    this.on(this.$('#input'), 'keydown', (event) => {
      if (event.key === 'Enter') add();
    });

    this.bind('[data-toggle]', 'click', (event) => {
      const id = event.currentTarget.dataset.toggle;
      this.#save(tasks.map((task) => (task.id === id ? { ...task, done: !task.done } : task)));
      this.refresh();
    });

    this.bind('[data-remove]', 'click', (event) => {
      this.#save(tasks.filter((task) => task.id !== event.currentTarget.dataset.remove));
      this.refresh();
    });

    const clear = this.$('#clear');
    if (clear) {
      this.on(clear, 'click', () => {
        this.#save(tasks.filter((task) => !task.done));
        this.refresh();
      });
    }
  }
}

define('jg-app-todo', TodoApp);
