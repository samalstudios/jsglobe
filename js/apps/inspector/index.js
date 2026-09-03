import { JGApp, define, html, styleSheet } from '../../core/app.js';
import { appText } from '../../core/i18n.js';
import strings from './i18n.js';
import { icon } from '../../ui/icons.js';
import { ai } from '../../core/ai.js';
import { toast, pickFile, copyText } from '../../core/util.js';
import { readZip } from '../../core/zip.js';
import { docxToHtml } from '../../lib/docx.js';
import { markdownToHtml } from '../../lib/richtext.js';
import { chunkText, buildIndex, searchIndex, buildPrompt, citedIn, bestLine, tokenise } from '../../lib/rag.js';

const t = appText(strings);

const sheet = await styleSheet(import.meta.url);

const ACCEPTS = '.txt,.md,.markdown,.html,.htm,.json,.csv,.log,.docx';

const plainFrom = (markup) => {
  const holder = document.createElement('div');
  holder.innerHTML = String(markup ?? '').replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
  for (const block of holder.querySelectorAll('p, div, li, h1, h2, h3, h4, h5, h6, tr, br')) block.after('\n');
  return holder.textContent.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
};

class Inspector extends JGApp {
  static appId = 'inspector';
  static settings = [
    { key: 'passages', label: t('inspector.passagesToRead', 'Passages to read for each answer'), type: 'number', default: 5, min: 2, max: 10 },
    { key: 'chunk', label: t('inspector.passageSize', 'Passage size in characters'), type: 'number', default: 900, min: 300, max: 2400 },
  ];
  static styles = [...JGApp.styles, sheet];

  #docs = [];
  #index = null;
  #busy = false;
  #stop = null;

  renderApp() {
    this.#docs = this.store.read()?.docs ?? [];

    this.paint(html`<div class="app">
      <div class="split">
        <aside class="shelf">
          <div class="head">
            <span class="label">${t('inspector.documents', 'Documents')}</span>
            <span class="grow"></span>
            <span class="hint" id="shelfsum"></span>
          </div>
          <div class="docs" id="docs"></div>
          <div class="shelffoot">
            <jg-button size="sm" variant="outline" id="add">${icon('upload', 13)}${t('inspector.addFiles', 'Add files')}</jg-button>
            <jg-button size="sm" variant="ghost" id="paste">${t('inspector.pasteText', 'Paste text')}</jg-button>
          </div>
        </aside>

        <div class="main">
          <div class="thread" id="thread"></div>

          <div class="asker">
            <jg-input id="question" placeholder="${t('inspector.askAboutTheDocuments', 'Ask about the documents')}"></jg-input>
            <jg-button id="ask">${t('inspector.ask', 'Ask')}</jg-button>
            <jg-button id="halt" variant="outline" hidden>${t('inspector.stop', 'Stop')}</jg-button>
          </div>
          <p class="privacy">${t('inspector.staysHere', 'The documents and the model both stay on this device. Nothing is uploaded.')}</p>
        </div>
      </div>

      <jg-dialog id="paste-box" title-text="${t('inspector.pasteText', 'Paste text')}" sub="${t('inspector.pasteAnythingToAsk', 'Paste anything you want to ask questions about.')}">
        <jg-field label="${t('inspector.name', 'Name')}"><jg-input id="paste-name" placeholder="${t('inspector.notes', 'Notes')}"></jg-input></jg-field>
        <jg-textarea id="paste-body" rows="10" placeholder="${t('inspector.theText', 'The text')}"></jg-textarea>
        <div class="row end">
          <jg-button size="sm" variant="outline" id="paste-cancel">${t('inspector.cancel', 'Cancel')}</jg-button>
          <jg-button size="sm" id="paste-add">${t('inspector.addIt', 'Add it')}</jg-button>
        </div>
      </jg-dialog>

      <jg-dialog id="source-box" title-text="${t('inspector.source', 'Source')}" sub="">
        <p class="sourcefrom" id="source-from"></p>
        <div class="sourcetext" id="source-text"></div>
        <div class="row end">
          <jg-button size="sm" variant="ghost" id="source-copy">${t('inspector.copy', 'Copy')}</jg-button>
          <jg-button size="sm" id="source-done">${t('inspector.done', 'Done')}</jg-button>
        </div>
      </jg-dialog>
    </div>`);

    this.on(this.$('#add'), 'click', () => this.#addFiles());
    this.on(this.$('#paste'), 'click', () => this.$('#paste-box').open());
    this.on(this.$('#paste-cancel'), 'click', () => this.$('#paste-box').close());
    this.on(this.$('#paste-add'), 'click', () => this.#addPasted());
    this.on(this.$('#source-done'), 'click', () => this.$('#source-box').close());
    this.on(this.$('#ask'), 'click', () => this.#ask());
    this.on(this.$('#halt'), 'click', () => this.#stop?.abort());

    this.on(this.$('#question'), 'keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        this.#ask();
      }
    });

    this.on(this.$('#docs'), 'click', (event) => {
      const drop = event.target.closest('[data-drop]');
      if (drop) return this.#remove(drop.dataset.drop);
      const row = event.target.closest('[data-doc]');
      if (row) this.#showSource(row.dataset.doc, 0);
    });

    this.on(this.$('#thread'), 'click', (event) => {
      const cite = event.target.closest('[data-source]');
      if (cite) this.#showSource(cite.dataset.source, Number(cite.dataset.at));
    });

    const drop = this.$('.app');
    this.on(drop, 'dragover', (event) => {
      event.preventDefault();
      drop.dataset.over = 'true';
    });
    this.on(drop, 'dragleave', () => delete drop.dataset.over);
    this.on(drop, 'drop', (event) => {
      event.preventDefault();
      delete drop.dataset.over;
      this.#takeFiles([...(event.dataTransfer?.files ?? [])]);
    });

    this.#reindex();
    this.#drawDocs();
    this.#drawThread();
  }

  #keep() {
    this.store.write({ docs: this.#docs });
  }

  #passages() {
    const size = Math.max(300, Math.min(2400, Number(this.config.get('chunk', 900)) || 900));
    const out = [];
    for (const doc of this.#docs) {
      chunkText(doc.text, { size, overlap: Math.round(size / 6) }).forEach((chunk, at) => {
        out.push({ ...chunk, docId: doc.id, title: doc.name, at });
      });
    }
    return out;
  }

  #reindex() {
    this.#index = buildIndex(this.#passages());
  }

  async #addFiles() {
    const picked = await pickFile(ACCEPTS, true);
    if (!picked) return;
    await this.#takeFiles(Array.isArray(picked) ? picked : [picked]);
  }

  async #takeFiles(files) {
    if (!files.length) return;
    let added = 0;
    for (const file of files) {
      const name = file.name ?? 'Document';
      try {
        const text = await this.#readFile(file);
        if (!text.trim()) continue;
        this.#docs.push({ id: `d${Date.now().toString(36)}${added}`, name, text, added: Date.now() });
        added += 1;
      } catch {
        toast(t('inspector.couldNotRead', 'Could not read {name}', { name }), 'danger');
      }
    }
    if (!added) return;
    this.#keep();
    this.#reindex();
    this.#drawDocs();
    toast(t('inspector.added', 'Added {count} documents', { count: added }));
  }

  async #readFile(file) {
    const name = (file.name ?? '').toLowerCase();
    const data = file.data ?? file;

    if (name.endsWith('.docx')) {
      const zip = await readZip(data);
      const xml = await zip.text('word/document.xml');
      return plainFrom(docxToHtml(xml ?? ''));
    }

    const text = typeof data === 'string' ? data : await this.#asText(data);
    if (/\.html?$/.test(name)) return plainFrom(text);
    if (/\.(md|markdown)$/.test(name)) return plainFrom(markdownToHtml(text));
    if (name.endsWith('.json')) {
      try {
        return JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        return text;
      }
    }
    return text;
  }

  async #asText(data) {
    if (data instanceof Blob) return data.text();
    if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) return new TextDecoder().decode(data);
    return String(data);
  }

  #addPasted() {
    const body = this.$('#paste-body').value.trim();
    if (!body) return;
    const name = this.$('#paste-name').value.trim() || t('inspector.notes', 'Notes');
    this.#docs.push({ id: `d${Date.now().toString(36)}`, name, text: body, added: Date.now() });
    this.$('#paste-body').value = '';
    this.$('#paste-name').value = '';
    this.$('#paste-box').close();
    this.#keep();
    this.#reindex();
    this.#drawDocs();
  }

  #remove(id) {
    this.#docs = this.#docs.filter((doc) => doc.id !== id);
    this.#keep();
    this.#reindex();
    this.#drawDocs();
  }

  #drawDocs() {
    const host = this.$('#docs');
    const passages = this.#index?.passages.length ?? 0;
    this.$('#shelfsum').textContent = this.#docs.length
      ? t('inspector.passageCount', '{count} passages', { count: passages })
      : '';

    host.innerHTML = this.#docs.length
      ? this.#docs
          .map((doc) => {
            const count = this.#index.passages.filter((passage) => passage.docId === doc.id).length;
            return (
              `<div class="doc" data-doc="${doc.id}">` +
              `<span class="mark">${icon('fileText', 14)}</span>` +
              `<span class="what"><b>${doc.name}</b><i>${t('inspector.passageCount', '{count} passages', { count })}</i></span>` +
              `<button class="drop" data-drop="${doc.id}" title="${t('inspector.remove', 'Remove')}">${icon('eraser', 13)}</button>` +
              '</div>'
            );
          })
          .join('')
      : `<p class="empty">${t('inspector.dropFilesHere', 'Drop files here, or add them below. Nothing leaves this device.')}</p>`;
  }

  #drawThread() {
    const host = this.$('#thread');
    if (host.children.length) return;
    host.innerHTML = `<div class="welcome">
      <span class="mark">${icon('search', 22)}</span>
      <p>${t('inspector.welcome', 'Add a few documents, then ask a question. The answer cites the passages it came from, and each one opens.')}</p>
    </div>`;
  }

  async #ask() {
    if (this.#busy) return;
    const question = this.$('#question').value.trim();
    if (!question) return;

    if (!this.#docs.length) {
      toast(t('inspector.addADocumentFirst', 'Add a document first'), 'danger');
      return;
    }
    if (!ai.isEnabled()) {
      toast(t('inspector.turnOnAi', 'Turn on local AI in Settings first'), 'danger');
      return;
    }

    const limit = Math.max(2, Math.min(10, Number(this.config.get('passages', 5)) || 5));
    const hits = searchIndex(this.#index, question, { limit });

    if (!hits.length) {
      this.#addTurn(question, t('inspector.nothingMatched', 'Nothing in these documents mentions that.'), []);
      this.$('#question').value = '';
      return;
    }

    this.#busy = true;
    this.$('#halt').hidden = false;
    this.$('#ask').disabled = true;
    this.$('#question').value = '';

    const turn = this.#addTurn(question, '', hits, { pending: true });
    const body = turn.querySelector('.answer');
    this.#stop = new AbortController();

    try {
      const answer = await ai.chat(buildPrompt(question, hits), {
        signal: this.#stop.signal,
        onDelta: (piece, whole) => {
          body.textContent = whole;
          turn.scrollIntoView({ block: 'end' });
        },
      });
      this.#settle(turn, answer, hits);
    } catch (error) {
      body.textContent = t('inspector.couldNotAnswer', 'Could not answer: {reason}', { reason: error.message });
      turn.dataset.state = 'failed';
    } finally {
      this.#busy = false;
      this.#stop = null;
      this.$('#halt').hidden = true;
      this.$('#ask').disabled = false;
    }
  }

  #addTurn(question, answer, hits, { pending = false } = {}) {
    const host = this.$('#thread');
    host.querySelector('.welcome')?.remove();

    const turn = document.createElement('article');
    turn.className = 'turn';
    if (pending) turn.dataset.state = 'thinking';
    turn.innerHTML =
      `<p class="question">${this.#safe(question)}</p>` +
      '<div class="answer"></div>' +
      '<div class="sources"></div>';
    turn.querySelector('.answer').textContent = answer;
    host.append(turn);
    if (!pending) this.#settle(turn, answer, hits);
    turn.scrollIntoView({ block: 'end' });
    return turn;
  }

  // the answer names its sources by number, so only those become references
  #settle(turn, answer, hits) {
    delete turn.dataset.state;
    const used = citedIn(answer, hits.length);
    const shown = used.length ? used.map((at) => ({ at, hit: hits[at - 1] })) : hits.map((hit, at) => ({ at: at + 1, hit }));

    turn.querySelector('.answer').innerHTML = this.#withMarks(answer, hits);
    turn.querySelector('.sources').innerHTML = shown
      .map(
        ({ at, hit }) =>
          `<button class="source" data-source="${hit.passage.docId}" data-at="${hit.passage.at}">` +
          `<span class="num">${at}</span>` +
          `<span class="from"><b>${this.#safe(hit.passage.title)}</b>` +
          `<i>${this.#safe(bestLine(hit.passage.text, hit.matched))}</i></span>` +
          '</button>',
      )
      .join('');
  }

  #withMarks(answer, hits) {
    return this.#safe(answer).replace(/\[(\d{1,2})\]/g, (whole, number) => {
      const hit = hits[Number(number) - 1];
      if (!hit) return whole;
      return `<button class="cite" data-source="${hit.passage.docId}" data-at="${hit.passage.at}">${number}</button>`;
    });
  }

  #safe(text) {
    return String(text ?? '').replace(/[<>&]/g, (character) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[character]));
  }

  #showSource(docId, at) {
    const doc = this.#docs.find((entry) => entry.id === docId);
    if (!doc) return;
    const passage = this.#index.passages.find((entry) => entry.docId === docId && entry.at === at) ?? this.#index.passages.find((entry) => entry.docId === docId);
    if (!passage) return;

    const question = this.$('#question').value;
    const terms = tokenise(question);
    this.$('#source-from').textContent = t('inspector.fromDocument', 'From {name}, passage {number}', {
      name: doc.name,
      number: passage.at + 1,
    });
    this.$('#source-text').innerHTML = this.#safe(passage.text)
      .split('\n')
      .map((line) => `<p>${terms.length ? this.#markTerms(line, terms) : line}</p>`)
      .join('');
    this.$('#source-copy').onclick = () => {
      copyText(passage.text);
      toast(t('inspector.copiedThePassage', 'Copied the passage'));
    };
    this.$('#source-box').open();
  }

  #markTerms(line, terms) {
    return line.replace(/[\p{L}\p{N}_'-]+/gu, (word) => {
      const [stemmed] = tokenise(word);
      return stemmed && terms.includes(stemmed) ? `<mark>${word}</mark>` : word;
    });
  }

  renderWidget() {
    this.paint(html`<div class="app" style="padding:12px">
      <div class="stack tight">
        <div class="label">${t('inspector.inspector', 'Inspector')}</div>
        <div class="hint">${t('inspector.widgetBlurb', 'Ask questions of your own documents.')}</div>
      </div>
    </div>`);
  }
}

define('jg-app-inspector', Inspector);
