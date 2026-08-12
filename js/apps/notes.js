import { JGApp, define, html, css } from '../core/app.js';
import { uid, debounce, download } from '../core/util.js';
import { router } from '../core/router.js';

const sheet = css`
  .shell { display: grid; grid-template-columns: 220px 1fr; gap: 12px; height: 100%; min-height: 0; }
  @media (max-width: 640px) { .shell { grid-template-columns: 1fr; } .sidebar { max-height: 180px; } }
  .sidebar { display: flex; flex-direction: column; gap: 8px; min-height: 0; }
  .notes { display: flex; flex-direction: column; gap: 4px; overflow: auto; min-height: 0; }
  .note {
    display: block;
    width: 100%;
    text-align: left;
    padding: 9px 10px;
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    background: transparent;
    color: inherit;
    font-family: inherit;
    cursor: pointer;
  }
  .note:hover { background: var(--accent); }
  .note[aria-current="true"] { background: var(--card); border-color: var(--border); }
  .note .t { font-size: 13px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .note .d { font-size: 11px; color: var(--muted-foreground); }
  .editor { display: flex; flex-direction: column; gap: 8px; min-height: 0; }
  .widget { display: flex; flex-direction: column; gap: 6px; height: 100%; padding: 0 12px 12px; }
  .widget .body { flex: 1; font-size: 12px; color: var(--muted-foreground); overflow: hidden; white-space: pre-wrap; }
`;

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
        <jg-button size="sm" variant="outline" id="new">New note</jg-button>
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
          <jg-button id="new" size="sm">New note</jg-button>
          <div class="notes">
            ${notes.length
              ? notes.map(
                  (note) => html`<button class="note" data-id="${note.id}" aria-current="${String(note.id === this.#active)}">
                    <span class="t">${preview(note.text).slice(0, 40) || 'Untitled'}</span>
                    <span class="d">${new Date(note.updated).toLocaleDateString()} · ${note.text.trim().split(/\s+/).filter(Boolean).length} words</span>
                  </button>`,
                )
              : html`<div class="hint" style="padding:8px">No notes yet</div>`}
          </div>
        </aside>
        <div class="editor">
          ${active
            ? html`
                <div class="spread">
                  <span class="hint">Edited ${new Date(active.updated).toLocaleString()}</span>
                  <span class="row tight">
                    <jg-button size="sm" variant="ghost" id="export">Export</jg-button>
                    <jg-button size="sm" variant="destructive" id="delete">Delete</jg-button>
                  </span>
                </div>
                <jg-textarea id="text" grow sans placeholder="Start typing..."></jg-textarea>
              `
            : html`<jg-empty glyph="✎" title="Nothing selected">Create a note to get started.</jg-empty>`}
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
