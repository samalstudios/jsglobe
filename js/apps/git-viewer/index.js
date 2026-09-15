import { JGApp, define, html, raw, styleSheet } from '../../core/app.js';
import { appWords, language } from '../../core/i18n.js';
import { blobs } from '../../core/blobs.js';
import { copyText, toast, uid } from '../../core/util.js';
import { confirm } from '../../ui/jg-dialog.js';
import {
  openRepository, directoryReader, fileListReader, graphLayout, diffLines, hunks, isBinary, decodeText, refNameProblem, collectHistory, analyseHistory,
} from '../../lib/git.js';

const t = await appWords('git-viewer', (lang) => import(`./i18n/${lang}.js`));

const sheet = await styleSheet(import.meta.url);

const PAGE = 400;
const ROW = 30;
const LANE = 14;
const COLOURS = ['#0a84ff', '#ff9f0a', '#30d158', '#bf5af2', '#ff375f', '#64d2ff', '#ffd60a', '#ac8e68'];
const DIFF_LINE_LIMIT = 4000;
const IMAGE = /\.(png|jpe?g|gif|webp|avif|svg|ico|bmp)$/i;
const MIME = { svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', ico: 'image/x-icon', bmp: 'image/bmp' };

const canOpenFolders = () => typeof globalThis.showDirectoryPicker === 'function';

const relative = (seconds) => {
  const delta = seconds - Date.now() / 1000;
  const format = new Intl.RelativeTimeFormat(language(), { numeric: 'auto' });
  const steps = [[60, 'second'], [3600, 'minute'], [86400, 'hour'], [604800, 'day'], [2629800, 'week'], [31557600, 'month'], [Infinity, 'year']];
  const sizes = { second: 1, minute: 60, hour: 3600, day: 86400, week: 604800, month: 2629800, year: 31557600 };
  for (const [limit, unit] of steps) if (Math.abs(delta) < limit) return format.format(Math.round(delta / sizes[unit]), unit);
  return '';
};

const absolute = (seconds) => new Intl.DateTimeFormat(language(), { dateStyle: 'medium', timeStyle: 'short' }).format(seconds * 1000);

const STATUS_LETTER = { added: 'A', modified: 'M', deleted: 'D', renamed: 'R', untracked: 'U' };

const graphCell = (row, width) => {
  const x = (column) => LANE / 2 + 4 + column * LANE;
  const mid = ROW / 2;
  const colour = (column) => COLOURS[column % COLOURS.length];
  const curve = (x1, y1, x2, y2) => (x1 === x2 ? `M${x1} ${y1}V${y2}` : `M${x1} ${y1}C${x1} ${(y1 + y2) / 2} ${x2} ${(y1 + y2) / 2} ${x2} ${y2}`);
  let paths = '';
  row.before.forEach((sha, column) => {
    if (!sha) return;
    if (sha === row.sha) paths += `<path d="${curve(x(column), 0, x(row.column), mid)}" stroke="${colour(row.column)}"/>`;
    else {
      const next = row.after.indexOf(sha);
      if (next >= 0) paths += `<path d="${curve(x(column), 0, x(next), ROW)}" stroke="${colour(next)}"/>`;
    }
  });
  row.parents.forEach((column) => {
    paths += `<path d="${curve(x(row.column), mid, x(column), ROW)}" stroke="${colour(column)}"/>`;
  });
  const size = x(width - 1) + LANE / 2 + 4;
  return raw(`<svg class="graph" width="${size}" height="${ROW}" viewBox="0 0 ${size} ${ROW}" aria-hidden="true"><g fill="none" stroke-width="2" stroke-linecap="round">${paths}</g><circle cx="${x(row.column)}" cy="${mid}" r="4.2" fill="var(--card)" stroke="${colour(row.column)}" stroke-width="2.4"/></svg>`);
};

class GitViewer extends JGApp {
  static appId = 'git-viewer';
  static styles = [...JGApp.styles, sheet];

  #repo = null;
  #reader = null;
  #head = null;
  #refs = [];
  #commits = [];
  #cursor = null;
  #layout = null;
  #scope = 'all';
  #filter = '';
  #selected = null;
  #file = null;
  #status = null;
  #recents = [];
  #urls = new Set();
  #busy = false;
  #view = 'history';
  #history = null;
  #insightOptions = { folder: '', noise: false };

  renderApp() {
    this.paint(html`<div class="gv">
      <aside class="sidebar">
        <jg-button id="open" size="sm">${t('git-viewer.openRepository', 'Open repository…')}</jg-button>
        <input id="picker" type="file" webkitdirectory multiple hidden />
        <div id="side"></div>
      </aside>
      <section class="main">
        <div class="toolbar">
          <div class="repo-title" id="repo-title"></div>
          <span class="spring"></span>
          <jg-tabs id="scope" value="${this.#scope}">
            <option value="all">${t('git-viewer.allBranches', 'All branches')}</option>
            <option value="head">${t('git-viewer.currentBranch', 'Current branch')}</option>
          </jg-tabs>
          <label class="search"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 4.5 4.5"/></svg><input id="filter" type="search" placeholder="${t('git-viewer.searchCommits', 'Search commits')}" /></label>
          <button class="insights-button" id="insights" aria-pressed="false" disabled><svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M2.5 13.5h11M4.5 11V7.5M8 11V3.5M11.5 11V6"/></svg>${t('git-viewer.insights', 'Insights')}</button>
          <button class="tool" id="reload" title="${t('git-viewer.reload', 'Reload')}" disabled><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12a7 7 0 1 1-2.1-5"/><path d="M19.2 4.5V8h-3.5"/></svg></button>
        </div>
        <div class="log" id="log"></div>
        <div class="insights" id="insights-view" hidden></div>
      </section>
      <aside class="detail" id="detail" hidden></aside>
    </div>`);

    this.on(this.$('#open'), 'click', () => this.#pick());
    this.on(this.$('#picker'), 'change', (event) => {
      if (event.target.files.length) this.#open(fileListReader(event.target.files));
      event.target.value = '';
    });
    this.on(this.$('#scope'), 'change', (event) => {
      this.#scope = event.detail.value;
      this.#loadLog();
    });
    this.on(this.$('#filter'), 'input', (event) => {
      this.#filter = event.target.value.trim().toLowerCase();
      this.#paintLog();
    });
    this.on(this.$('#reload'), 'click', () => this.#reload());
    this.on(this.$('#insights'), 'click', () => this.#setView(this.#view === 'insights' ? 'history' : 'insights'));
    this.#loadRecents();
    if (this.#repo) {
      this.$('#insights').disabled = false;
      this.$('#reload').disabled = false;
      this.#paintSide();
      this.#paintLog();
      this.#paintDetail();
      this.#setView(this.#view);
    } else this.#paintWelcome();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#releaseUrls();
  }

  // ---- opening ---------------------------------------------------------

  async #pick() {
    if (!canOpenFolders()) {
      this.$('#picker').click();
      return;
    }
    let handle;
    try {
      handle = await window.showDirectoryPicker({ mode: 'read', id: 'git-viewer' });
    } catch (error) {
      if (error?.name !== 'AbortError') toast(error.message, 'error');
      return;
    }
    if (await this.#open(directoryReader(handle))) this.#remember(handle);
  }

  async #openRecent(record) {
    try {
      if (record.handle.queryPermission && (await record.handle.queryPermission({ mode: 'read' })) !== 'granted') {
        if ((await record.handle.requestPermission({ mode: 'read' })) !== 'granted') return;
      }
    } catch (error) {
      toast(error.message, 'error');
      return;
    }
    if (await this.#open(directoryReader(record.handle))) this.#remember(record.handle);
  }

  async #open(reader) {
    this.$('#log').innerHTML = html`<div class="loading">${t('git-viewer.readingRepository', 'Reading the repository…')}</div>`;
    try {
      const repo = await openRepository(reader);
      this.#repo = repo;
      this.#reader = reader;
      this.#selected = null;
      this.#file = null;
      this.#status = null;
      this.$('#reload').disabled = false;
      this.$('#insights').disabled = false;
      this.#history = null;
      await this.#reload();
      return true;
    } catch (error) {
      this.#repo = null;
      this.#paintWelcome(error.message);
      return false;
    }
  }

  async #reload() {
    if (!this.#repo) return;
    this.#head = await this.#repo.head().catch(() => null);
    this.#refs = await this.#repo.refs().catch(() => []);
    this.#status = null;
    this.#history = null;
    this.#paintSide();
    await this.#loadLog();
    if (this.#repo.worktree) this.#loadStatus();
    if (this.#view === 'insights') this.#loadInsights();
  }

  async #loadRecents() {
    if (!canOpenFolders()) return;
    try {
      this.#recents = (await blobs.list('git-viewer')).filter((record) => record.handle).slice(0, 8);
    } catch {
      this.#recents = [];
    }
    if (!this.#repo) this.#paintWelcome();
    else this.#paintSide();
  }

  async #remember(handle) {
    try {
      for (const record of await blobs.list('git-viewer')) {
        if (record.handle && (await record.handle.isSameEntry(handle))) await blobs.remove(record.id);
      }
      await blobs.put('git-viewer', { id: uid(), name: handle.name, handle, created: Date.now() });
      for (const record of (await blobs.list('git-viewer')).slice(8)) await blobs.remove(record.id);
    } catch {}
    this.#loadRecents();
  }

  #paintWelcome(problem = '') {
    this.$('#repo-title').textContent = '';
    this.$('#detail').hidden = true;
    this.$('#side').innerHTML = this.#recents.length
      ? html`<div class="group"><div class="group-title">${t('git-viewer.recent', 'Recent')}</div>${this.#recents.map((record) => html`<button class="item" data-recent="${record.id}">${raw(this.#branchGlyph())}<span>${record.name}</span></button>`)}</div>`
      : '';
    this.bind('[data-recent]', 'click', (event) => {
      const record = this.#recents.find((item) => item.id === event.currentTarget.dataset.recent);
      if (record) this.#openRecent(record);
    });
    this.$('#log').innerHTML = html`<div class="welcome">
      <svg viewBox="0 0 64 64" width="72" height="72" aria-hidden="true"><g fill="none" stroke="var(--ring)" stroke-width="4" stroke-linecap="round"><path d="M20 12v40M20 40c0-12 24-8 24-20"/></g><g fill="var(--card)" stroke="var(--ring)" stroke-width="4"><circle cx="20" cy="12" r="6"/><circle cx="20" cy="52" r="6"/><circle cx="44" cy="18" r="6"/></g></svg>
      <div class="welcome-title">${t('git-viewer.openAGitRepository', 'Open a git repository')}</div>
      <p>${t('git-viewer.pickTheFolderThatHolds', 'Pick the folder that holds your project’s .git folder to see its history, branches, changes and diffs. It is read on this device and never uploaded.')}</p>
      ${problem ? html`<p class="problem">${problem}</p>` : ''}
      <jg-button id="welcome-open">${t('git-viewer.openRepository', 'Open repository…')}</jg-button>
    </div>`;
    this.on(this.$('#welcome-open'), 'click', () => this.#pick());
  }

  #branchGlyph() {
    return '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="4.5" cy="3.5" r="1.8"/><circle cx="4.5" cy="12.5" r="1.8"/><circle cx="11.5" cy="5" r="1.8"/><path d="M4.5 5.3v5.4M11.5 6.8c0 3-7 2-7 4"/></svg>';
  }

  // ---- sidebar ---------------------------------------------------------

  #paintSide() {
    const side = this.$('#side');
    if (!side || !this.#repo) return;
    const current = this.#head?.ref;
    const groups = [
      ['branch', t('git-viewer.branches', 'Branches')],
      ['remote', t('git-viewer.remoteBranches', 'Remote branches')],
      ['tag', t('git-viewer.tags', 'Tags')],
      ['stash', t('git-viewer.stashes', 'Stashes')],
    ];
    const status = this.#status;
    const changeCount = status ? status.staged.length + status.unstaged.length + status.untracked.length : null;
    this.$('#repo-title').innerHTML = html`<strong>${this.#repo.name}</strong>${this.#head ? html`<span class="head-pill">${raw(this.#branchGlyph())}${current ? current.replace(/^refs\/heads\//, '') : t('git-viewer.detached', 'detached')}</span>` : ''}`;
    side.innerHTML = html`
      ${this.#repo.worktree ? html`<div class="group">
        <button class="item changes" data-changes aria-current="${String(this.#selected === 'changes')}">
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M8 2.5v11M2.5 8h11"/></svg>
          <span>${t('git-viewer.localChanges', 'Local changes')}</span>
          <span class="count">${changeCount === null ? '…' : changeCount}</span>
        </button>
      </div>` : ''}
      ${groups.map(([kind, title]) => {
        const refs = this.#refs.filter((ref) => ref.kind === kind && !ref.symbolic);
        if (!refs.length) return '';
        return html`<div class="group">
          <div class="group-title">${title}<span class="count">${refs.length}</span></div>
          ${refs.map((ref) => html`<div class="item-row">
            <button class="item" data-ref="${ref.name}" title="${ref.name}" aria-current="${String(ref.name === current)}">
              ${kind === 'tag' ? raw('<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M2.5 2.5h5.3l5.7 5.7-5.3 5.3-5.7-5.7Z"/><circle cx="5.5" cy="5.5" r="1" fill="currentColor"/></svg>') : raw(this.#branchGlyph())}
              <span>${ref.short}</span>
            </button>
            ${(kind === 'branch' || kind === 'tag') && ref.name !== current && this.#reader?.write ? html`<button class="forget" data-delete="${ref.name}" title="${t('git-viewer.delete', 'Delete')}">×</button>` : ''}
          </div>`)}
        </div>`;
      })}
      ${this.#recents.length ? html`<div class="group"><div class="group-title">${t('git-viewer.recent', 'Recent')}</div>${this.#recents.map((record) => html`<button class="item" data-recent="${record.id}"><svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 4.5a1.5 1.5 0 0 1 1.5-1.5h3l1.5 1.5h4.5A1.5 1.5 0 0 1 14 6v5.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11.5Z"/></svg><span>${record.name}</span></button>`)}</div>` : ''}`;
    this.bind('[data-changes]', 'click', () => {
      this.#selected = 'changes';
      this.#file = null;
      this.#paintSide();
      this.#paintLogSelection();
      this.#paintDetail();
    });
    this.bind('[data-ref]', 'click', (event) => {
      const ref = this.#refs.find((item) => item.name === event.currentTarget.dataset.ref);
      if (ref) this.#reveal(ref.commit);
    });
    this.bind('[data-delete]', 'click', (event) => this.#deleteRef(event.currentTarget.dataset.delete));
    this.bind('[data-recent]', 'click', (event) => {
      const record = this.#recents.find((item) => item.id === event.currentTarget.dataset.recent);
      if (record) this.#openRecent(record);
    });
  }

  async #loadStatus() {
    const repo = this.#repo;
    try {
      const status = await repo.status();
      if (this.#repo !== repo) return;
      this.#status = status;
    } catch (error) {
      this.#status = { staged: [], unstaged: [], untracked: [], conflicts: [], error: error.message };
    }
    this.#paintSide();
    if (this.#selected === 'changes') this.#paintDetail();
  }

  // ---- log -------------------------------------------------------------

  async #loadLog() {
    const repo = this.#repo;
    if (!repo) return;
    const tips = this.#scope === 'head'
      ? [this.#head?.sha].filter(Boolean)
      : [...new Set([this.#head?.sha, ...this.#refs.filter((ref) => ref.kind !== 'stash').map((ref) => ref.commit)].filter(Boolean))];
    this.$('#log').innerHTML = html`<div class="loading">${t('git-viewer.readingHistory', 'Reading history…')}</div>`;
    try {
      const { commits, cursor } = await repo.log({ from: tips, limit: PAGE });
      if (this.#repo !== repo) return;
      this.#commits = commits;
      this.#cursor = cursor;
      this.#layout = graphLayout(commits);
      if (!this.#selected && commits.length) this.#selected = commits[0].sha;
      this.#paintLog();
      this.#paintDetail();
    } catch (error) {
      this.$('#log').innerHTML = html`<div class="welcome"><p class="problem">${error.message}</p></div>`;
    }
  }

  async #more() {
    if (!this.#cursor || this.#busy) return;
    this.#busy = true;
    const { commits, cursor } = await this.#repo.log({ limit: PAGE, cursor: this.#cursor });
    this.#busy = false;
    this.#commits = [...this.#commits, ...commits];
    this.#cursor = cursor;
    this.#layout = graphLayout(this.#commits);
    const scroll = this.$('.rows')?.scrollTop ?? 0;
    this.#paintLog();
    const rows = this.$('.rows');
    if (rows) rows.scrollTop = scroll;
  }

  #labels() {
    const labels = new Map();
    for (const ref of this.#refs) {
      if (ref.symbolic) continue;
      if (!labels.has(ref.commit)) labels.set(ref.commit, []);
      labels.get(ref.commit).push(ref);
    }
    return labels;
  }

  #paintLog() {
    const log = this.$('#log');
    if (!this.#repo) return;
    const filter = this.#filter;
    const labels = this.#labels();
    const headSha = this.#head?.sha;
    const width = Math.min(this.#layout?.width ?? 1, 14);
    const rows = this.#commits
      .map((commit, index) => ({ commit, index }))
      .filter(({ commit }) => !filter || commit.message.toLowerCase().includes(filter) || commit.sha.startsWith(filter) || commit.author?.name.toLowerCase().includes(filter) || commit.author?.email.toLowerCase().includes(filter));
    if (!rows.length) {
      log.innerHTML = html`<div class="welcome"><p>${filter ? t('git-viewer.noCommitsMatch', 'No commits match') : t('git-viewer.noCommitsYet', 'This repository has no commits yet')}</p></div>`;
      return;
    }
    log.innerHTML = html`<div class="rows">
      ${rows.map(({ commit, index }) => {
        const refs = labels.get(commit.sha) ?? [];
        return html`<div class="commit" data-sha="${commit.sha}" aria-selected="${String(this.#selected === commit.sha)}">
          <span class="graph-cell">${filter ? '' : graphCell(this.#layout.rows[index], width)}</span>
          <span class="subject">
            ${commit.sha === headSha ? html`<span class="ref head">HEAD</span>` : ''}
            ${refs.map((ref) => html`<span class="ref ${ref.kind}">${ref.short}</span>`)}
            <span class="text">${commit.subject}</span>
          </span>
          <span class="author">${commit.author?.name ?? ''}</span>
          <span class="when" title="${absolute(commit.committer?.time ?? 0)}">${relative(commit.author?.time ?? 0)}</span>
          <span class="sha">${commit.sha.slice(0, 7)}</span>
        </div>`;
      })}
      ${this.#cursor ? html`<div class="more"><jg-button size="sm" variant="outline" id="more">${t('git-viewer.loadOlderCommits', 'Load older commits')}</jg-button></div>` : ''}
    </div>`;
    this.bind('[data-sha]', 'click', (event) => {
      this.#selected = event.currentTarget.dataset.sha;
      this.#file = null;
      this.#paintLogSelection();
      this.#paintSide();
      this.#paintDetail();
    });
    this.on(this.$('#more'), 'click', () => this.#more());
    this.on(this.$('.rows'), 'keydown', (event) => this.#keys(event));
    this.$('.rows').tabIndex = 0;
  }

  #paintLogSelection() {
    this.$$('[data-sha]').forEach((row) => row.setAttribute('aria-selected', String(row.dataset.sha === this.#selected)));
  }

  #keys(event) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const rows = this.$$('[data-sha]');
    const at = rows.findIndex((row) => row.dataset.sha === this.#selected);
    const next = rows[Math.max(0, Math.min(rows.length - 1, at + (event.key === 'ArrowDown' ? 1 : -1)))];
    if (!next) return;
    this.#selected = next.dataset.sha;
    this.#file = null;
    this.#paintLogSelection();
    next.scrollIntoView({ block: 'nearest' });
    this.#paintDetail();
  }

  async #reveal(sha) {
    while (!this.#commits.some((commit) => commit.sha === sha) && this.#cursor) await this.#more();
    if (!this.#commits.some((commit) => commit.sha === sha)) {
      if (this.#scope === 'head') {
        this.#scope = 'all';
        this.$('#scope').value = 'all';
        await this.#loadLog();
        return this.#reveal(sha);
      }
      return;
    }
    this.#selected = sha;
    this.#file = null;
    if (this.#filter) {
      this.#filter = '';
      this.$('#filter').value = '';
      this.#paintLog();
    }
    this.#paintLogSelection();
    this.$(`[data-sha="${sha}"]`)?.scrollIntoView({ block: 'center' });
    this.#paintSide();
    this.#paintDetail();
  }

  // ---- insights --------------------------------------------------------

  #setView(view) {
    this.#view = view;
    const insights = view === 'insights';
    this.$('.gv').dataset.view = view;
    this.$('#insights').setAttribute('aria-pressed', String(insights));
    this.$('#log').hidden = insights;
    this.$('#insights-view').hidden = !insights;
    this.$('#scope').hidden = insights;
    this.$('.search').hidden = insights;
    if (insights) this.#loadInsights();
  }

  async #loadInsights() {
    const repo = this.#repo;
    const holder = this.$('#insights-view');
    if (!repo || !holder) return;
    if (this.#history?.head === this.#head?.sha) return this.#paintInsights();
    if (!this.#head?.sha) {
      holder.innerHTML = html`<div class="welcome"><p>${t('git-viewer.noCommitsYet', 'This repository has no commits yet')}</p></div>`;
      return;
    }
    holder.innerHTML = html`<div class="loading"><span id="insight-progress">${t('git-viewer.readingHistory', 'Reading history…')}</span><jg-progress id="insight-bar" size="sm" style="width:220px"></jg-progress></div>`;
    try {
      const history = await collectHistory(repo, {
        from: [this.#head.sha],
        onProgress: ({ stage, done, total }) => {
          const label = this.$('#insight-progress');
          const bar = this.$('#insight-bar');
          if (!label) return;
          label.textContent = stage === 'commits'
            ? t('git-viewer.readCommits', 'Read {count} commits…', { count: done })
            : t('git-viewer.readingChangedFiles', 'Reading changed files {done} of {total}…', { done, total });
          if (bar && total) bar.setAttribute('value', String(Math.round((done / total) * 100)));
        },
      });
      if (this.#repo !== repo) return;
      history.head = this.#head.sha;
      this.#history = history;
      if (this.#view === 'insights') this.#paintInsights();
    } catch (error) {
      holder.innerHTML = html`<div class="welcome"><p class="problem">${error.message}</p></div>`;
    }
  }

  #paintInsights() {
    const holder = this.$('#insights-view');
    const history = this.#history;
    if (!holder || !history) return;
    const { folder, noise } = this.#insightOptions;
    const result = analyseHistory(history, { folder, noise });
    const number = (value) => new Intl.NumberFormat(language()).format(value);
    const percent = (value) => `${Math.round(value * 100)}%`;
    const month = (key) => new Intl.DateTimeFormat(language(), { month: 'short', year: 'numeric' }).format(new Date(`${key}-15T00:00:00Z`));
    const riskyPaths = new Set(result.risky.map((file) => file.path));
    const { people, pace, firefighting } = result;
    const top = people.contributors[0];
    const scale = (list) => Math.max(1, ...list.map((item) => item.count));

    const fileList = (files, tone) => {
      if (!files.length) return html`<div class="hint">${t('git-viewer.noFilesFound', 'No files found for this view')}</div>`;
      const max = scale(files);
      return html`<ol class="ranked">${files.map((file) => html`<li>
        <span class="bar-track"><span class="bar-fill" data-tone="${riskyPaths.has(file.path) ? 'risk' : tone}" style="width:${Math.max(3, (file.count / max) * 100)}%"></span></span>
        <span class="ranked-path" title="${file.path}">${file.path}</span>
        ${riskyPaths.has(file.path) ? html`<span class="flag risk">${t('git-viewer.highRisk', 'high risk')}</span>` : ''}
        <span class="ranked-count">${number(file.count)}</span>
      </li>`)}</ol>`;
    };

    const finding = (tone, text) => html`<div class="finding" data-tone="${tone}"><span class="dot"></span><span>${text}</span></div>`;

    const peopleFindings = [];
    if (people.busFactorRisk) peopleFindings.push(finding('warn', t('git-viewer.busFactor', '{name} wrote {share} of all commits. If they leave, most of the knowledge leaves with them.', { name: top.name, share: percent(people.topShare) })));
    if (people.topGone) peopleFindings.push(finding('bad', t('git-viewer.topGone', 'The top contributor, {name}, has not committed in the last six months.', { name: top.name })));
    if (people.contributors.length > 3 && people.activeLastYear <= Math.ceil(people.contributors.length / 4)) {
      peopleFindings.push(finding('warn', t('git-viewer.fewActive', '{total} people have contributed, but only {active} were active in the last year. The people who built it are not the people maintaining it.', { total: people.contributors.length, active: people.activeLastYear })));
    }
    if (!peopleFindings.length && people.contributors.length) peopleFindings.push(finding('good', t('git-viewer.peopleSpread', 'No single person dominates the history, and the main contributors are still active.')));

    const paceFindings = [];
    if (pace.quietDays !== null && pace.quietDays > 182) paceFindings.push(finding('bad', t('git-viewer.quiet', 'Nothing has been committed for {days} days.', { days: number(pace.quietDays) })));
    if (pace.trend === 'declining') paceFindings.push(finding('warn', t('git-viewer.declining', 'The last six months had {change} fewer commits than the six before. The team is losing momentum.', { change: percent(-pace.change) })));
    else if (pace.trend === 'accelerating') paceFindings.push(finding('good', t('git-viewer.accelerating', 'The last six months had {change} more commits than the six before.', { change: percent(pace.change) })));
    else if (pace.trend === 'steady') paceFindings.push(finding('good', t('git-viewer.steady', 'The pace over the last year is steady.')));
    else paceFindings.push(finding('neutral', t('git-viewer.young', 'There is less than a year of history, too little to call a trend.')));
    for (const drop of pace.drops.slice(-3)) paceFindings.push(finding('warn', t('git-viewer.halved', 'Commits fell from {from} to {to} in {month}. A drop like that often means someone left.', { from: drop.from, to: drop.to, month: month(drop.month) })));
    if (pace.bursty) paceFindings.push(finding('neutral', t('git-viewer.bursty', 'Busy months are followed by quiet ones, a sign that work is batched into releases.')));

    const fireText = {
      none: [t('git-viewer.fireNone', 'No reverts or hotfixes in the last year. Either the team is stable, or commit messages do not say so.'), 'neutral'],
      normal: [t('git-viewer.fireNormal', 'A handful of reverts and hotfixes in a year is normal.'), 'good'],
      frequent: [t('git-viewer.fireFrequent', 'Reverts and hotfixes come more than once a month. Worth asking how much the team trusts its releases.'), 'warn'],
      constant: [t('git-viewer.fireConstant', 'Reverts and hotfixes arrive every couple of weeks. The deploy process is probably not trusted: look at tests, staging and rollbacks.'), 'bad'],
    }[firefighting.level];

    const chartMonths = pace.months;
    const maxMonth = Math.max(1, ...chartMonths.map((entry) => entry.count));
    const barWidth = chartMonths.length ? Math.max(2, Math.min(28, 720 / chartMonths.length)) : 0;
    const chartWidth = chartMonths.length * barWidth;
    const years = chartMonths.map((entry, index) => ({ index, year: entry.month.slice(0, 4), first: entry.month.endsWith('-01') || index === 0 })).filter((entry) => entry.first);

    holder.innerHTML = html`<div class="insights-body">
      <div class="insights-head">
        <div>
          <h2>${t('git-viewer.repositoryInsights', 'Repository insights')}</h2>
          <p class="muted">${t('git-viewer.insightsScope', '{count} commits on {branch}', { count: number(result.commitCount), branch: this.#head?.ref?.replace(/^refs\/heads\//, '') ?? 'HEAD' })}${result.idle ? ` · ${t('git-viewer.idleNote', 'the last year is counted back from the latest commit')}` : ''}${result.filesCapped ? ` · ${t('git-viewer.filesCapped', 'files counted for the most recent commits only')}` : ''}</p>
        </div>
        <div class="insight-controls">
          <label class="folder-filter"><span>${t('git-viewer.folder', 'Folder')}</span><input id="insight-folder" value="${folder}" placeholder="src" spellcheck="false" /></label>
          <label class="noise-toggle"><input type="checkbox" id="insight-noise" ${noise ? raw('checked') : ''} /> ${t('git-viewer.includeGenerated', 'Include lockfiles and generated files')}</label>
        </div>
      </div>

      <div class="summary">
        <div class="stat"><span class="stat-label">${t('git-viewer.mostChanged', 'Most changed file')}</span><span class="stat-value path" title="${result.churn[0]?.path ?? ''}">${result.churn[0]?.path.split('/').pop() ?? '—'}</span><span class="stat-sub">${result.churn[0] ? t('git-viewer.changesThisYear', '{count} changes in a year', { count: result.churn[0].count }) : ''}</span></div>
        <div class="stat" data-tone="${people.busFactorRisk ? 'warn' : ''}"><span class="stat-label">${t('git-viewer.topContributor', 'Top contributor')}</span><span class="stat-value">${top ? percent(people.topShare) : '—'}</span><span class="stat-sub">${top?.name ?? ''}</span></div>
        <div class="stat" data-tone="${result.risky.length ? 'risk' : ''}"><span class="stat-label">${t('git-viewer.riskyFiles', 'High risk files')}</span><span class="stat-value">${result.risky.length}</span><span class="stat-sub">${t('git-viewer.churnAndBugs', 'changed often and fixed often')}</span></div>
        <div class="stat" data-tone="${pace.trend === 'declining' ? 'warn' : pace.trend === 'accelerating' ? 'good' : ''}"><span class="stat-label">${t('git-viewer.momentum', 'Momentum')}</span><span class="stat-value">${pace.change === null ? '—' : `${pace.change > 0 ? '+' : ''}${Math.round(pace.change * 100)}%`}</span><span class="stat-sub">${t('git-viewer.lastSixMonths', 'last six months against the six before')}</span></div>
        <div class="stat" data-tone="${firefighting.level === 'constant' ? 'bad' : firefighting.level === 'frequent' ? 'warn' : ''}"><span class="stat-label">${t('git-viewer.firefights', 'Reverts and hotfixes')}</span><span class="stat-value">${firefighting.count}</span><span class="stat-sub">${t('git-viewer.inTheLastYear', 'in the last year')}</span></div>
      </div>

      ${result.risky.length ? html`<section class="card risk-card">
        <h3>${t('git-viewer.highestRisk', 'Highest risk code')}</h3>
        <p class="lead">${t('git-viewer.highestRiskLead', 'Of the five most changed files, these also keep getting fixed. They are the biggest risk, so read them first.')}</p>
        <ol class="risk-list">${result.risky.slice(0, 8).map((file) => html`<li><span class="ranked-path" title="${file.path}">${file.path}</span><span class="flag">${t('git-viewer.changesCount', '{count} changes', { count: file.count })}</span><span class="flag risk">${t('git-viewer.fixesCount', '{count} fixes', { count: file.bugCount })}</span></li>`)}</ol>
      </section>` : ''}

      <div class="insight-grid">
        <section class="card">
          <h3>${t('git-viewer.whatChangesMost', 'What changes the most')}</h3>
          <p class="lead">${t('git-viewer.whatChangesMostLead', 'The 20 files changed most often in the last year. High churn on a file nobody wants to own is the clearest trouble signal.')}</p>
          ${fileList(result.churn, 'churn')}
        </section>
        <section class="card">
          <h3>${t('git-viewer.whereBugsCluster', 'Where bugs cluster')}</h3>
          <p class="lead">${t('git-viewer.whereBugsClusterLead', 'Files touched by the {count} commits whose messages mention fix, bug or broken. This depends on how descriptive the messages are.', { count: number(result.bugCommits) })}</p>
          ${fileList(result.bugs, 'bug')}
        </section>
      </div>

      <section class="card">
        <h3>${t('git-viewer.whoBuiltThis', 'Who built this')}</h3>
        <p class="lead">${t('git-viewer.whoBuiltThisLead', 'Contributors by commit count, merges left out. Squash merging credits whoever merged rather than whoever wrote the code.')}</p>
        <div class="findings">${peopleFindings}</div>
        <table class="people">
          <thead><tr><th>${t('git-viewer.person', 'Person')}</th><th class="num">${t('git-viewer.commits', 'Commits')}</th><th>${t('git-viewer.share', 'Share')}</th><th class="num">${t('git-viewer.lastSixMonthsShort', 'Last 6 months')}</th><th>${t('git-viewer.lastCommit', 'Last commit')}</th></tr></thead>
          <tbody>${people.contributors.slice(0, 15).map((person) => html`<tr data-gone="${String(!person.recent)}">
            <td><span class="person-name">${person.name}</span></td>
            <td class="num">${number(person.commits)}</td>
            <td><span class="share"><span class="bar-track"><span class="bar-fill" data-tone="people" style="width:${Math.max(2, person.share * 100)}%"></span></span><span class="share-value">${percent(person.share)}</span></span></td>
            <td class="num">${person.recent ? number(person.recent) : '—'}</td>
            <td class="muted">${relative(person.last)}</td>
          </tr>`)}</tbody>
        </table>
        ${people.contributors.length > 15 ? html`<div class="hint">${t('git-viewer.morePeople', 'and {count} more people', { count: people.contributors.length - 15 })}</div>` : ''}
      </section>

      <section class="card">
        <h3>${t('git-viewer.acceleratingOrDying', 'Is it accelerating or dying')}</h3>
        <p class="lead">${t('git-viewer.acceleratingLead', 'Commits per month over the whole history. A steady rhythm is healthy; a sudden halving usually means someone left.')}</p>
        <div class="findings">${paceFindings}</div>
        <div class="chart-scroll"><svg class="months" viewBox="0 0 ${Math.max(chartWidth, 1)} 150" width="${Math.max(chartWidth, 1)}" height="150" role="img" aria-label="${t('git-viewer.commitsPerMonth', 'Commits per month')}">
          ${raw(chartMonths.map((entry, index) => {
            const height = Math.round((entry.count / maxMonth) * 118);
            const dropped = pace.drops.some((drop) => drop.month === entry.month);
            const unfinished = pace.partial && index === chartMonths.length - 1;
            return `<rect x="${index * barWidth + 1}" y="${126 - height}" width="${Math.max(1, barWidth - 2)}" height="${Math.max(entry.count ? 2 : 0, height)}" rx="${Math.min(3, barWidth / 3)}" class="${unfinished ? 'partial' : dropped ? 'drop' : 'bar'}"><title>${month(entry.month)}: ${entry.count}${unfinished ? ` (${t('git-viewer.soFar', 'so far')})` : ''}</title></rect>`;
          }).join(''))}
          ${raw(years.map((entry) => `<text x="${entry.index * barWidth + 1}" y="143" class="axis">${entry.year}</text>`).join(''))}
        </svg></div>
      </section>

      <section class="card">
        <h3>${t('git-viewer.firefighting', 'How often is the team firefighting')}</h3>
        <p class="lead">${t('git-viewer.firefightingLead', 'Commits in the last year whose subject mentions a revert, hotfix, emergency or rollback.')}</p>
        <div class="findings">${finding(fireText[1], fireText[0])}</div>
        ${firefighting.commits.length ? html`<div class="fires">${firefighting.commits.slice(0, 40).map((commit) => html`<button class="fire" data-fire="${commit.sha}"><span class="sha">${commit.sha.slice(0, 7)}</span><span class="fire-subject">${commit.subject}</span><span class="muted">${relative(commit.time)}</span></button>`)}</div>` : ''}
      </section>
    </div>`;

    const folderInput = holder.querySelector('#insight-folder');
    let timer = null;
    this.on(folderInput, 'input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        this.#insightOptions.folder = folderInput.value.trim();
        const at = folderInput.selectionStart;
        this.#paintInsights();
        const again = this.$('#insight-folder');
        again?.focus();
        again?.setSelectionRange(at, at);
      }, 250);
    });
    this.on(holder.querySelector('#insight-noise'), 'change', (event) => {
      this.#insightOptions.noise = event.target.checked;
      this.#paintInsights();
    });
    holder.querySelectorAll('[data-fire]').forEach((node) => this.on(node, 'click', () => {
      this.#setView('history');
      this.#reveal(node.dataset.fire);
    }));
  }

  // ---- detail ----------------------------------------------------------

  #releaseUrls() {
    this.#urls.forEach((url) => URL.revokeObjectURL(url));
    this.#urls.clear();
  }

  async #paintDetail() {
    const detail = this.$('#detail');
    if (!this.#repo || !this.#selected) {
      detail.hidden = true;
      return;
    }
    detail.hidden = false;
    this.#releaseUrls();
    if (this.#selected === 'changes') return this.#paintChanges();
    const sha = this.#selected;
    const commit = await this.#repo.commit(sha).catch(() => null);
    if (!commit || this.#selected !== sha) return;
    const body = commit.message.slice(commit.subject.length).trim();
    const sameCommitter = commit.committer && commit.author && commit.committer.email === commit.author.email && commit.committer.time === commit.author.time;
    const writable = Boolean(this.#reader?.write);
    detail.innerHTML = html`<div class="detail-body">
      <div class="detail-head">
        <h2>${commit.subject}</h2>
        ${body ? html`<pre class="message">${body}</pre>` : ''}
      </div>
      <div class="facts">
        <div>${t('git-viewer.commit', 'Commit')}</div><div><button class="sha-copy" data-copy="${commit.sha}" title="${t('git-viewer.copy', 'Copy')}">${commit.sha.slice(0, 12)}</button>${commit.signed ? html` <jg-badge tone="success">${t('git-viewer.signed', 'signed')}</jg-badge>` : ''}</div>
        <div>${t('git-viewer.author', 'Author')}</div><div>${commit.author?.name} <span class="muted">&lt;${commit.author?.email}&gt;</span></div>
        <div>${t('git-viewer.date', 'Date')}</div><div>${absolute(commit.author?.time ?? 0)}</div>
        ${sameCommitter ? '' : html`<div>${t('git-viewer.committer', 'Committer')}</div><div>${commit.committer?.name} <span class="muted">${absolute(commit.committer?.time ?? 0)}</span></div>`}
        <div>${commit.parents.length > 1 ? t('git-viewer.parents', 'Parents') : t('git-viewer.parent', 'Parent')}</div><div class="parents">${commit.parents.length ? commit.parents.map((parent) => html`<button class="sha-link" data-parent="${parent}">${parent.slice(0, 7)}</button>`) : '—'}</div>
      </div>
      ${writable ? html`<div class="actions">
        <jg-button size="sm" variant="outline" id="new-branch">${t('git-viewer.newBranchHere', 'New branch here')}</jg-button>
        <jg-button size="sm" variant="outline" id="new-tag">${t('git-viewer.newTagHere', 'New tag here')}</jg-button>
      </div>
      <form class="ref-form" id="ref-form" hidden>
        <input id="ref-name" autocomplete="off" spellcheck="false" />
        <jg-button size="sm" id="ref-create">${t('git-viewer.create', 'Create')}</jg-button>
        <jg-button size="sm" variant="ghost" id="ref-cancel">${t('git-viewer.cancel', 'Cancel')}</jg-button>
      </form>` : ''}
      <div class="files-head"><span class="label">${t('git-viewer.changedFiles', 'Changed files')}</span><span class="count" id="file-count">…</span></div>
      <div class="files" id="files"></div>
      <div id="diff"></div>
    </div>`;
    this.bind('[data-copy]', 'click', (event) => copyText(event.currentTarget.dataset.copy));
    this.bind('[data-parent]', 'click', (event) => this.#reveal(event.currentTarget.dataset.parent));
    this.#refForm(commit.sha);

    const changes = await this.#repo.changes(sha).catch((error) => {
      toast(error.message, 'error');
      return [];
    });
    if (this.#selected !== sha) return;
    this.#paintFiles(changes, (change) => this.#showDiff(change, () => this.#blobPair(change)));
  }

  #refForm(sha) {
    const form = this.$('#ref-form');
    if (!form) return;
    let kind = 'branch';
    const open = (next) => {
      kind = next;
      form.hidden = false;
      const input = this.$('#ref-name');
      input.placeholder = kind === 'branch' ? t('git-viewer.branchName', 'Branch name') : t('git-viewer.tagName', 'Tag name');
      input.value = '';
      input.focus();
    };
    const create = async () => {
      const name = this.$('#ref-name').value.trim();
      const problem = refNameProblem(name);
      if (problem) {
        toast(problem, 'error');
        return;
      }
      try {
        await this.#repo.createRef(kind, name, sha);
        toast(kind === 'branch' ? t('git-viewer.createdBranch', 'Created branch {name}', { name }) : t('git-viewer.createdTag', 'Created tag {name}', { name }), 'success');
        form.hidden = true;
        this.#refs = await this.#repo.refs();
        this.#paintSide();
        this.#paintLog();
      } catch (error) {
        toast(error.message, 'error');
      }
    };
    this.on(this.$('#new-branch'), 'click', () => open('branch'));
    this.on(this.$('#new-tag'), 'click', () => open('tag'));
    this.on(this.$('#ref-cancel'), 'click', (event) => {
      event.preventDefault();
      form.hidden = true;
    });
    this.on(this.$('#ref-create'), 'click', (event) => {
      event.preventDefault();
      create();
    });
    this.on(form, 'submit', (event) => {
      event.preventDefault();
      create();
    });
  }

  async #deleteRef(full) {
    const ref = this.#refs.find((item) => item.name === full);
    if (!ref) return;
    const ok = await confirm({
      title: ref.kind === 'tag' ? t('git-viewer.deleteTag', 'Delete tag {name}?', { name: ref.short }) : t('git-viewer.deleteBranch', 'Delete branch {name}?', { name: ref.short }),
      message: t('git-viewer.deleteRefMessage', 'Only the name is removed. Commits that nothing else points at can still be found with git reflog for a while.'),
      confirmLabel: t('git-viewer.delete', 'Delete'),
      danger: true,
    });
    if (!ok) return;
    try {
      await this.#repo.deleteRef(full);
      this.#refs = await this.#repo.refs();
      this.#paintSide();
      this.#paintLog();
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  #paintFiles(changes, onPick, { holder = this.$('#files'), count = this.$('#file-count') } = {}) {
    if (count) count.textContent = String(changes.length);
    if (!holder) return;
    const shown = changes.slice(0, 2000);
    holder.innerHTML = shown.length
      ? html`${shown.map((change, index) => html`<button class="file" data-file="${index}" data-status="${change.status}" title="${change.from ? `${change.from} → ${change.path}` : change.path}">
          <span class="letter">${STATUS_LETTER[change.status]}</span>
          <span class="path">${change.from ? html`<span class="muted">${change.from} → </span>` : ''}${change.path}</span>
        </button>`)}${changes.length > shown.length ? html`<div class="hint">${t('git-viewer.moreFiles', 'and {count} more', { count: changes.length - shown.length })}</div>` : ''}`
      : html`<div class="hint">${t('git-viewer.noFileChanges', 'No file changes')}</div>`;
    holder.querySelectorAll('[data-file]').forEach((node) => this.on(node, 'click', () => {
      holder.querySelectorAll('[data-file]').forEach((other) => other.setAttribute('aria-current', String(other === node)));
      onPick(shown[Number(node.dataset.file)]);
    }));
  }

  async #blobPair(change) {
    const repo = this.#repo;
    const read = async (sha) => (sha ? repo.blob(sha) : new Uint8Array());
    return [await read(change.oldSha), change.file ? new Uint8Array(await change.file.arrayBuffer()) : await read(change.newSha)];
  }

  async #showDiff(change, load) {
    const holder = this.$('#diff');
    if (!holder) return;
    holder.innerHTML = html`<div class="loading small">${t('git-viewer.loadingDiff', 'Loading the diff…')}</div>`;
    let before;
    let after;
    try {
      [before, after] = await load();
    } catch (error) {
      holder.innerHTML = html`<div class="problem">${error.message}</div>`;
      return;
    }
    const title = html`<div class="diff-title"><span class="letter" data-status="${change.status}">${STATUS_LETTER[change.status]}</span><span class="path">${change.path}</span></div>`;
    if (IMAGE.test(change.path)) {
      const type = MIME[change.path.split('.').pop().toLowerCase()];
      const url = (bytes) => {
        const made = URL.createObjectURL(new Blob([bytes], { type }));
        this.#urls.add(made);
        return made;
      };
      holder.innerHTML = html`${title}<div class="images">
        ${before.length ? html`<figure><img alt="" src="${url(before)}" /><figcaption>${t('git-viewer.before', 'Before')}</figcaption></figure>` : ''}
        ${after.length ? html`<figure><img alt="" src="${url(after)}" /><figcaption>${t('git-viewer.after', 'After')}</figcaption></figure>` : ''}
      </div>`;
      return;
    }
    if (isBinary(before) || isBinary(after)) {
      holder.innerHTML = html`${title}<div class="hint">${t('git-viewer.binaryFile', 'Binary file, {before} bytes before and {after} after', { before: before.length, after: after.length })}</div>`;
      return;
    }
    const ops = diffLines(decodeText(before), decodeText(after));
    const added = ops.filter((op) => op.type === 'added').length;
    const removed = ops.filter((op) => op.type === 'removed').length;
    const groups = hunks(ops);
    let budget = DIFF_LINE_LIMIT;
    holder.innerHTML = html`${title}
      <div class="diff-stats"><span class="plus">+${added}</span><span class="minus">−${removed}</span></div>
      ${groups.length ? html`<div class="diff">${groups.map((group) => {
        if (budget <= 0) return '';
        const lines = group.lines.slice(0, budget);
        budget -= lines.length;
        return html`<div class="hunk">@@ −${group.oldStart},${group.oldLines} +${group.newStart},${group.newLines} @@</div>
          ${lines.map((line) => html`<div class="line" data-type="${line.type}"><span class="no">${line.old ?? ''}</span><span class="no">${line.new ?? ''}</span><span class="mark">${line.type === 'added' ? '+' : line.type === 'removed' ? '−' : ''}</span><span class="src">${line.text || ' '}</span></div>`)}`;
      })}${budget <= 0 ? html`<div class="hint pad">${t('git-viewer.diffTooLong', 'The rest of this diff is too long to show')}</div>` : ''}</div>` : html`<div class="hint">${t('git-viewer.onlyModeChanged', 'The contents did not change')}</div>`}`;
  }

  #paintChanges() {
    const detail = this.$('#detail');
    const status = this.#status;
    if (!status) {
      detail.innerHTML = html`<div class="detail-body"><div class="loading small">${t('git-viewer.checkingFiles', 'Checking files for changes…')}</div></div>`;
      return;
    }
    const sections = [
      ['staged', t('git-viewer.staged', 'Staged'), status.staged],
      ['unstaged', t('git-viewer.notStaged', 'Not staged'), status.unstaged],
      ['untracked', t('git-viewer.untracked', 'Untracked'), status.untracked],
    ];
    detail.innerHTML = html`<div class="detail-body">
      <div class="detail-head"><h2>${t('git-viewer.localChanges', 'Local changes')}</h2>
        <p class="muted">${status.branch ? t('git-viewer.onBranch', 'On branch {name}', { name: status.branch }) : t('git-viewer.detachedHead', 'HEAD is detached')}</p></div>
      ${status.error ? html`<div class="problem">${status.error}</div>` : ''}
      ${status.conflicts.length ? html`<div class="problem">${t('git-viewer.conflicts', 'Unresolved conflicts: {files}', { files: status.conflicts.join(', ') })}</div>` : ''}
      ${sections.map(([id, title, list]) => html`<div class="files-head"><span class="label">${title}</span><span class="count">${list.length}${id === 'untracked' && status.untrackedCapped ? '+' : ''}</span></div><div class="files" id="files-${id}"></div>`)}
      <div id="diff"></div>
    </div>`;
    const index = this.#repo;
    const reader = this.#reader;
    for (const [id, , list] of sections) {
      this.#paintFiles(list, (change) => this.#showDiff(change, async () => {
        const blob = async (sha) => (sha ? index.blob(sha) : new Uint8Array());
        if (change.status === 'untracked') {
          if (change.folder) return [new Uint8Array(), new TextEncoder().encode(t('git-viewer.untrackedFolder', 'A folder git is not tracking yet'))];
          const file = await reader.file(change.path);
          return [new Uint8Array(), file ? new Uint8Array(await file.slice(0, 2 * 1024 * 1024).arrayBuffer()) : new Uint8Array()];
        }
        if (id === 'unstaged') {
          const file = await reader.file(change.path);
          return [await blob(change.oldSha), file ? new Uint8Array(await file.arrayBuffer()) : new Uint8Array()];
        }
        return [await blob(change.oldSha), await blob(change.newSha)];
      }), { holder: this.$(`#files-${id}`), count: null });
    }
  }
}

define('jg-app-git-viewer', GitViewer);
