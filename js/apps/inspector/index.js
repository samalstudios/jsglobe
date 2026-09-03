import { JGApp, define, html, styleSheet } from '../../core/app.js';
import { appText } from '../../core/i18n.js';
import strings from './i18n.js';
import { icon } from '../../ui/icons.js';
import { ai, MODELS } from '../../core/ai.js';
import { settings } from '../../core/settings.js';
import { toast, pickFiles, copyText } from '../../core/util.js';
import { readZip } from '../../core/zip.js';
import { docxToHtml } from '../../lib/docx.js';
import { markdownToHtml } from '../../lib/richtext.js';
import {
  chunkText, buildIndex, searchIndex, buildPrompt, citedIn, bestLine, tokenise, cosine, fuse,
  withNeighbours, ASK_FOR_LEADS, readLeads,
} from '../../lib/rag.js';

const t = appText(strings);

const sheet = await styleSheet(import.meta.url);

const ACCEPTS = '.txt,.md,.markdown,.html,.htm,.json,.csv,.log,.docx,.pdf';

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
    { key: 'expand', label: t('inspector.workOutWhatToLookFor', 'Work out what an answer would look like before searching'), type: 'switch', default: true },
    { key: 'pdfJs', label: t('inspector.pdfReader', 'PDF reader module'), type: 'text', default: 'https://esm.run/pdfjs-dist@4.0.379/build/pdf.min.mjs' },
  ];
  static styles = [...JGApp.styles, sheet];

  #docs = [];
  #index = null;
  #busy = false;
  #stop = null;
  #pdfjs = null;
  #vecs = new Map();
  #building = false;
  #buildMessage = null;

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

          <div class="models">
            <jg-field label="${t('inspector.answersWrittenBy', 'Answers written by')}">
              <jg-selector id="chatmodel" style="width:100%"></jg-selector>
            </jg-field>
            <jg-field label="${t('inspector.passagesFoundBy', 'Passages found by')}">
              <jg-selector id="finder" style="width:100%"></jg-selector>
            </jg-field>
            <jg-field label="${t('inspector.embeddingModel', 'Embedding model')}" id="embedfield" hidden>
              <jg-selector id="embedmodel" style="width:100%"></jg-selector>
            </jg-field>
            <div class="vecline" id="vecline" hidden>
              <span class="hint" id="vecstate"></span>
              <jg-button size="sm" variant="outline" id="build">${t('inspector.readTheDocuments', 'Read the documents')}</jg-button>
            </div>
          </div>
        </aside>

        <div class="main">
          <div class="thread" id="thread"></div>

          <div class="notice" id="notice" hidden>
            <span class="mark">${icon('clock', 13)}</span>
            <span class="grow" id="noticetext"></span>
            <jg-button size="sm" variant="outline" id="noticeread">${t('inspector.readThemNow', 'Read them now')}</jg-button>
          </div>

          <div class="asker">
            <jg-input id="question" placeholder="${t('inspector.askAboutTheDocuments', 'Ask about the documents')}"></jg-input>
            <jg-button id="ask">${t('inspector.ask', 'Ask')}</jg-button>
            <jg-button id="halt" variant="outline" hidden>${t('inspector.stop', 'Stop')}</jg-button>
          </div>
          <p class="privacy">${t('inspector.staysHere', 'The documents and the model both stay on this device. Nothing is uploaded.')}
            ${t('inspector.pdfNote', 'A PDF fetches a reader from a CDN the first time, then the reading happens here too.')}</p>
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

    this.#wireModels();
    this.#reindex();
    this.#drawDocs();
    this.#drawThread();
  }

  #wireModels() {
    const chat = this.$('#chatmodel');
    chat.items = MODELS.map((model) => ({ value: model.id, label: model.label, hint: model.size }));
    chat.value = settings.get('ai.model');
    this.on(chat, 'change', (event) => settings.set('ai.model', event.detail.value));

    const finder = this.$('#finder');
    finder.items = [
      { value: 'words', label: t('inspector.matchingWords', 'Matching words'), hint: t('inspector.noDownload', 'no download') },
      { value: 'both', label: t('inspector.wordsAndMeaning', 'Words and meaning'), hint: t('inspector.needsAModel', 'needs a model') },
    ];
    finder.value = this.config.get('finder', 'words');
    this.on(finder, 'change', (event) => {
      this.config.set('finder', event.detail.value);
      this.#drawModels();
    });

    const embed = this.$('#embedmodel');
    embed.items = [{ value: settings.get('ai.embedModel'), label: settings.get('ai.embedModel').replace(/-MLC.*$/, '') }];
    embed.value = settings.get('ai.embedModel');
    this.on(embed, 'change', (event) => {
      settings.set('ai.embedModel', event.detail.value);
      this.#vecs.clear();
      this.#drawModels();
    });
    ai.embedModels().then((models) => {
      if (!models.length) return;
      embed.items = models.map((model) => ({ value: model.id, label: model.label, hint: model.size }));
      embed.value = settings.get('ai.embedModel');
    });

    this.on(this.$('#build'), 'click', () => this.#buildVectors());
    this.on(this.$('#noticeread'), 'click', () => this.#buildVectors());
    this.#drawModels();
  }

  #usesVectors() {
    return this.config.get('finder', 'words') === 'both';
  }

  // a passage is the same passage as long as its document, its place in that
  // document and its wording are unchanged
  #keyOf(passage) {
    return `${passage.docId}:${passage.at}:${passage.text.length}:${passage.text.slice(0, 24)}`;
  }

  #unread() {
    if (!this.#usesVectors()) return [];
    return (this.#index?.passages ?? []).filter((passage) => !this.#vecs.has(this.#keyOf(passage)));
  }

  // read, part read, or not read at all, for the mark against each document
  #readState(docId) {
    if (!this.#usesVectors()) return 'plain';
    const mine = (this.#index?.passages ?? []).filter((passage) => passage.docId === docId);
    if (!mine.length) return 'plain';
    const read = mine.filter((passage) => this.#vecs.has(this.#keyOf(passage))).length;
    if (read === mine.length) return 'read';
    return read ? 'part' : 'unread';
  }

  #drawModels() {
    const on = this.#usesVectors();
    this.$('#embedfield').hidden = !on;
    this.$('#vecline').hidden = !on;
    if (!on) return;

    const passages = this.#index?.passages.length ?? 0;
    const ready = passages > 0 && !this.#unread().length;
    this.$('#vecstate').textContent = this.#building
      ? this.#buildMessage ?? t('inspector.reading', 'Reading')
      : ready
        ? t('inspector.passagesRead', '{count} passages read', { count: passages })
        : t('inspector.notReadYet', 'Not read yet');
    this.$('#build').hidden = ready || this.#building;
    this.#drawNotice();
  }

  // the answers only reach into what has been read, so say so where the question
  // is asked rather than leaving it to be noticed
  #drawNotice() {
    const notice = this.$('#notice');
    if (!notice) return;
    const waiting = this.#unread().length;
    notice.hidden = !waiting || this.#building;
    if (!waiting) return;
    this.$('#noticetext').textContent = t('inspector.someNotReadYet', '{count} passages are not read yet, so answers will not draw on them.', {
      count: waiting,
    });
  }

  async #buildVectors() {
    const waiting = this.#unread();
    if (this.#building || !waiting.length) return;
    this.#building = true;
    this.#buildMessage = t('inspector.loadingTheModel', 'Loading the model');
    this.#drawModels();

    try {
      const vectors = await ai.embed(
        waiting.map((passage) => `${passage.title}\n${passage.text}`),
        {
          onProgress: (report) => {
            this.#buildMessage = report.done
              ? t('inspector.readSoFar', 'Read {done} of {total}', { done: report.done, total: report.total })
              : `${report.message ?? ''} ${report.progress ?? 0}%`.trim();
            this.#drawModels();
          },
        },
      );
      vectors.forEach((vector, at) => this.#vecs.set(this.#keyOf(waiting[at]), vector));
      toast(t('inspector.documentsRead', 'The documents are read'));
    } catch (error) {
      toast(t('inspector.couldNotRead', 'Could not read {name}', { name: error.message }), 'danger');
    } finally {
      this.#building = false;
      this.#buildMessage = null;
      this.#drawModels();
      this.#drawDocs();
    }
  }

  // a question is not written in the words its answer uses, so the model is
  // asked what an answer would look like and that is searched for as well
  async #leads(question) {
    if (this.config.get('expand', true) === false || !ai.isEnabled()) return [];
    try {
      const reply = await ai.complete(ASK_FOR_LEADS, question);
      return readLeads(reply, question);
    } catch {
      return [];
    }
  }

  #byWords(text, limit) {
    return searchIndex(this.#index, text, { limit });
  }

  async #byMeaning(texts, limit) {
    if (!this.#usesVectors()) return [];
    const read = this.#index.passages
      .map((passage, at) => ({ at, passage, vector: this.#vecs.get(this.#keyOf(passage)) }))
      .filter((entry) => entry.vector);
    if (!read.length) return [];

    const terms = tokenise(texts.join(' '));
    const asked = await ai.embed(texts);
    return asked.map((vector) =>
      read
        .map((entry) => ({ at: entry.at, passage: entry.passage, score: cosine(vector, entry.vector), matched: terms }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit),
    );
  }

  async #find(question, limit, say) {
    say?.(t('inspector.workingOutWhatToLookFor', 'Working out what to look for'));
    const leads = await this.#leads(question);
    const asks = [question, ...leads];

    say?.(t('inspector.searching', 'Searching the documents'));
    // the leads together count for less than the question, so a poor guess at
    // what an answer looks like can reorder near ties but never overrule what
    // was actually asked
    const share = (at) => (at === 0 ? 1 : 0.6 / leads.length);
    const rankings = asks.map((ask) => this.#byWords(ask, limit * 2));
    const weights = asks.map((ask, at) => share(at));

    try {
      const meaning = await this.#byMeaning(asks, limit * 2);
      meaning.forEach((list, at) => {
        rankings.push(list);
        weights.push(share(at));
      });
    } catch {
      /* the words alone still answer */
    }

    const found = fuse(rankings, { limit, weights });
    if (!found.length) return [];
    return withNeighbours(found, this.#index.passages, { each: 1, limit: Math.max(limit, found.length + 2) });
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
    const alive = new Set(this.#index.passages.map((passage) => this.#keyOf(passage)));
    for (const key of [...this.#vecs.keys()]) if (!alive.has(key)) this.#vecs.delete(key);
    this.#drawModels?.();
  }

  async #addFiles() {
    await this.#takeFiles(await pickFiles(ACCEPTS));
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

  // pdf.js is only fetched when a PDF actually turns up, and only to read the
  // text layer out of it
  async #pdf() {
    if (this.#pdfjs) return this.#pdfjs;
    const module = await import(/* @vite-ignore */ this.config.get('pdfJs', 'https://esm.run/pdfjs-dist@4.0.379/build/pdf.min.mjs'));
    const workerUrl = this.config.get('pdfWorker', 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs');
    const source = await fetch(workerUrl).then((response) => response.text());
    module.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
    this.#pdfjs = module;
    return module;
  }

  async #readPdf(data) {
    const js = await this.#pdf();
    const bytes = data instanceof Blob ? new Uint8Array(await data.arrayBuffer()) : new Uint8Array(data);
    const file = await js.getDocument({ data: bytes.slice() }).promise;
    const pages = [];
    for (let at = 1; at <= file.numPages; at += 1) {
      const page = await file.getPage(at);
      const content = await page.getTextContent();
      const text = content.items.map((item) => item.str).join(' ').replace(/[ \t]+/g, ' ').trim();
      if (text) pages.push(text);
    }
    return pages.join('\n\n');
  }

  async #readFile(file) {
    const name = (file.name ?? '').toLowerCase();
    const data = file.data ?? file;

    if (name.endsWith('.pdf')) return this.#readPdf(data);
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
            const state = this.#readState(doc.id);
            const mark = { read: 'checkSquare', part: 'clock', unread: 'clock' }[state] ?? 'fileText';
            const note = {
              read: t('inspector.readAndSearchable', 'Read, and searched by meaning'),
              part: t('inspector.partlyRead', 'Only partly read'),
              unread: t('inspector.notReadYet', 'Not read yet'),
            }[state];
            return (
              `<div class="doc" data-doc="${doc.id}" data-state="${state}">` +
              `<span class="mark"${note ? ` title="${note}"` : ''}>${icon(mark, 14)}</span>` +
              `<span class="what"><b>${doc.name}</b><i>${t('inspector.passageCount', '{count} passages', { count })}${note ? ` · ${note}` : ''}</i></span>` +
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
      <span class="mark">${icon('inspect', 22)}</span>
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

    this.#busy = true;
    this.$('#halt').hidden = false;
    this.$('#ask').disabled = true;
    this.$('#question').value = '';

    const turn = this.#addTurn(question, '', [], { pending: true });
    const body = turn.querySelector('.answer');
    // an answer drawn from a half read shelf should say as much next to itself
    const waiting = this.#unread().length;
    if (waiting) {
      turn.dataset.warn = t('inspector.answeredWithoutReading', 'Answered without {count} unread passages. Read the documents for the rest.', {
        count: waiting,
      });
    }
    this.#stop = new AbortController();

    const hits = await this.#find(question, limit, (message) => {
      turn.dataset.doing = message;
    });
    delete turn.dataset.doing;

    if (!hits.length) {
      this.#settle(turn, t('inspector.nothingMatched', 'Nothing in these documents mentions that.'), []);
      this.#busy = false;
      this.#stop = null;
      this.$('#halt').hidden = true;
      this.$('#ask').disabled = false;
      return;
    }

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
        <div class="label">${t('inspector.inspector', 'Inspector AI')}</div>
        <div class="hint">${t('inspector.widgetBlurb', 'Ask questions of your own documents.')}</div>
      </div>
    </div>`);
  }
}

define('jg-app-inspector', Inspector);
