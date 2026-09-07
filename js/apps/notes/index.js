import { JGApp, define, html, styleSheet } from '../../core/app.js';
import { appWords } from '../../core/i18n.js';
import { uid, debounce, download } from '../../core/util.js';
import { router } from '../../core/router.js';

const t = await appWords('notes', (lang) => import(`./i18n/${lang}.js`));

const sheet = await styleSheet(import.meta.url);

const preview = (text) => text.split('\n').find((line) => line.trim()) ?? 'Untitled';

class NotesApp extends JGApp {
  static appId = 'notes';
  static styles = [...JGApp.styles, sheet];

  #active = null;

  #notes() {
    return this.store.read([]);
  }

  #save(notes) {
    this.store.write(notes);
  }

  renderWidget() {
    const notes = this.#notes();
    const latest = notes[0];
    this.paint(html`<div class="app" style="padding:0">
      <div class="widget">
        <div class="strong">${latest ? preview(latest.text).slice(0, 40) : 'No notes yet'}</div>
        <div class="body">${latest ? latest.text.split('\n').slice(1, 6).join('\n') : 'Open Notes to write something.'}</div>
        <jg-button size="sm" variant="outline" id="new">${t('notes.newNote', 'New note')}</jg-button>
      </div>
    </div>`);
    this.on(this.$('#new'), 'click', () => {
      const note = { id: uid().slice(0, 8), text: '', updated: Date.now() };
      this.#save([note, ...this.#notes()]);
      router.app('notes');
    });
  }

  renderApp() {
    const notes = this.#notes();
    if (!this.#active || !notes.some((note) => note.id === this.#active)) this.#active = notes[0]?.id ?? null;
    const active = notes.find((note) => note.id === this.#active);

    this.paint(html`<div class="app">
      <div class="shell">
        <aside class="sidebar">
          <jg-button id="new" size="sm">${t('notes.newNote', 'New note')}</jg-button>
          <div class="notes">
            ${notes.length
              ? notes.map(
                  (note) => html`<button class="note" data-id="${note.id}" aria-current="${String(note.id === this.#active)}">
                    <span class="t">${preview(note.text).slice(0, 40) || 'Untitled'}</span>
                    <span class="d">${new Date(note.updated).toLocaleDateString()} · ${note.text.trim().split(/\s+/).filter(Boolean).length} words</span>
                  </button>`,
                )
              : html`<div class="hint" style="padding:8px">${t('notes.noNotesYet', 'No notes yet')}</div>`}
          </div>
        </aside>
        <div class="editor">
          ${active
            ? html`
                <div class="spread">
                  <span class="hint">Edited ${new Date(active.updated).toLocaleString()}</span>
                  <span class="row tight">
                    <jg-button size="sm" variant="ghost" id="export">${t('notes.export', 'Export')}</jg-button>
                    <jg-button size="sm" variant="destructive" id="delete">${t('notes.delete', 'Delete')}</jg-button>
                  </span>
                </div>
                <jg-textarea id="text" grow sans placeholder="${t('notes.startTyping', 'Start typing...')}"></jg-textarea>
              `
            : html`<jg-empty glyph="✎" title="${t('notes.nothingSelected', 'Nothing selected')}">${t('notes.createANoteToGet', 'Create a note to get started.')}</jg-empty>`}
        </div>
      </div>
    </div>`);

    this.on(this.$('#new'), 'click', () => {
      const note = { id: uid().slice(0, 8), text: '', updated: Date.now() };
      this.#save([note, ...notes]);
      this.#active = note.id;
      this.refresh();
      this.$('#text')?.focus();
    });

    this.bind('.note', 'click', (event) => {
      this.#active = event.currentTarget.dataset.id;
      this.refresh();
    });

    if (!active) return;
    const editor = this.$('#text');
    editor.value = active.text;

    const persist = debounce(() => {
      const next = this.#notes().map((note) =>
        note.id === this.#active ? { ...note, text: editor.value, updated: Date.now() } : note,
      );
      next.sort((a, b) => b.updated - a.updated);
      this.#save(next);
      this.$$('.note').forEach((node) => {
        if (node.dataset.id !== this.#active) return;
        node.querySelector('.t').textContent = preview(editor.value).slice(0, 40) || 'Untitled';
      });
    }, 400);
    this.on(editor, 'input', persist);

    this.on(this.$('#delete'), 'click', () => {
      this.#save(notes.filter((note) => note.id !== this.#active));
      this.#active = null;
      this.refresh();
    });

    this.on(this.$('#export'), 'click', () => {
      download(`${preview(active.text).slice(0, 32).replace(/[^\w-]+/g, '-') || 'note'}.md`, editor.value, 'text/markdown');
    });
  }
}

define('jg-app-notes', NotesApp);
