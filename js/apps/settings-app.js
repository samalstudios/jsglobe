import { JGApp, define, html, css, raw } from '../core/app.js';
import { settings } from '../core/settings.js';
import { workspaces } from '../core/workspaces.js';
import { layout } from '../core/layout.js';
import { registry } from '../core/registry.js';
import { appConfig } from '../core/config.js';
import { storage } from '../core/storage.js';
import { bus } from '../core/bus.js';
import { wallpapers } from '../core/wallpapers.js';
import { usage } from '../core/usage.js';
import { icon } from '../ui/icons.js';
import { download, pickFile, toast, formatBytes } from '../core/util.js';

const sheet = css`
  .shell { display: grid; grid-template-columns: 200px 1fr; height: 100%; min-height: 0; }
  @media (max-width: 700px) { .shell { grid-template-columns: 1fr; } .nav { flex-direction: row; overflow-x: auto; } }
  .nav {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 14px 10px;
    border-right: 1px solid var(--border);
    background: color-mix(in srgb, var(--muted) 45%, transparent);
    overflow: auto;
  }
  .nav-item {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 8px 10px;
    border: 0;
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--muted-foreground);
    font: 500 13px/1 var(--font-sans);
    cursor: pointer;
    white-space: nowrap;
    text-align: left;
  }
  .nav-item:hover { background: var(--accent); color: var(--foreground); }
  .nav-item[aria-current="true"] { background: var(--card); color: var(--foreground); box-shadow: var(--shadow-sm); }
  .pane { overflow: auto; padding: 20px 22px 40px; display: flex; flex-direction: column; gap: 18px; }
  .section-title { font-size: 17px; font-weight: 650; letter-spacing: -0.02em; }
  .section-sub { font-size: 12.5px; color: var(--muted-foreground); margin-top: 2px; }
  .rows { display: flex; flex-direction: column; }
  .settings-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 12px 2px;
    border-bottom: 1px solid var(--border);
  }
  .settings-row:last-child { border-bottom: 0; }
  .settings-row .text { min-width: 0; }
  .settings-row .name { font-size: 13.5px; font-weight: 500; }
  .settings-row .desc { font-size: 12px; color: var(--muted-foreground); }
  .settings-row .control { flex: none; min-width: 140px; display: flex; justify-content: flex-end; }
  .swatches { display: flex; flex-wrap: wrap; gap: 8px; }
  .swatch {
    width: 26px;
    height: 26px;
    border-radius: 999px;
    border: 2px solid transparent;
    cursor: pointer;
    padding: 0;
  }
  .swatch[aria-pressed="true"] { border-color: var(--foreground); }
  .papers { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 10px; }
  .paper {
    height: 60px;
    border-radius: var(--radius-md);
    border: 2px solid transparent;
    cursor: pointer;
    padding: 0;
    overflow: hidden;
    position: relative;
  }
  .paper[aria-pressed="true"] { border-color: var(--ring); }
  .paper span { position: absolute; inset: auto 0 0 0; font-size: 10px; padding: 3px; background: rgba(0,0,0,.45); color: #fff; }
  .ws-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: var(--card);
  }
  .ws-card[data-active="true"] { border-color: color-mix(in srgb, var(--ring) 55%, transparent); }
  .ws-dot { width: 10px; height: 10px; border-radius: 999px; background: var(--tint); flex: none; }
  .app-row { display: flex; align-items: center; gap: 10px; padding: 9px 2px; border-bottom: 1px solid var(--border); }
  .app-badge {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border-radius: 8px;
    background: var(--tint);
    color: #fff;
    font: 700 11px/1 var(--font-mono);
    flex: none;
  }
  .meter { height: 6px; border-radius: 999px; background: var(--muted); overflow: hidden; }
  .meter i { display: block; height: 100%; background: var(--ring); }
`;

const ACCENTS = ['#8a1c3b', '#6f7cff', '#8b5cf6', '#ec4899', '#f97316', '#22c55e', '#14b8a6', '#0ea5e9'];

const SECTIONS = [
  { id: 'appearance', label: 'Appearance', glyph: '◐' },
  { id: 'home', label: 'Home Screen', glyph: '▦' },
  { id: 'behavior', label: 'Behaviour', glyph: '⚙' },
  { id: 'workspaces', label: 'Workspaces', glyph: '⚭' },
  { id: 'apps', label: 'Apps', glyph: '▤' },
  { id: 'data', label: 'Data', glyph: '⌸' },
  { id: 'about', label: 'About', glyph: 'ⓘ' },
];

class SettingsApp extends JGApp {
  static appId = 'settings';
  static styles = [...JGApp.styles, sheet];

  #section = 'appearance';

  connectedCallback() {
    super.connectedCallback();
    this.keep(bus.on('workspaces:change', () => this.refresh()));
    this.keep(bus.on('workspace:switch', () => this.refresh()));
  }

  renderWidget() {
    this.paint(html`<div class="app"><div class="stack tight">
      <div class="label">Workspace</div>
      <div class="title">${workspaces.active().name}</div>
      <div class="hint">${registry.all().length} tools installed</div>
    </div></div>`);
  }

  renderApp() {
    this.paint(html`
      <div class="shell">
        <nav class="nav">
          ${SECTIONS.map(
            (section) => html`<button class="nav-item" data-section="${section.id}" aria-current="${String(section.id === this.#section)}">
              <span>${section.glyph}</span><span>${section.label}</span>
            </button>`,
          )}
        </nav>
        <div class="pane scroll" id="pane"></div>
      </div>
    `);
    this.bind('.nav-item', 'click', (event) => {
      this.#section = event.currentTarget.dataset.section;
      this.refresh();
    });
    this.#renderSection();
  }

  #renderSection() {
    const pane = this.$('#pane');
    const render = {
      appearance: () => this.#appearance(),
      home: () => this.#home(),
      behavior: () => this.#behaviour(),
      workspaces: () => this.#workspaces(),
      apps: () => this.#apps(),
      data: () => this.#data(),
      about: () => this.#about(),
    }[this.#section];
    pane.innerHTML = render();
    this.#wireSection();
  }

  #head(title, sub) {
    return html`<div><div class="section-title">${title}</div><div class="section-sub">${sub}</div></div>`;
  }

  #row(name, desc, control) {
    return html`<div class="settings-row">
      <div class="text"><div class="name">${name}</div><div class="desc">${desc}</div></div>
      <div class="control">${{ raw: control }}</div>
    </div>`;
  }

  #appearance() {
    const theme = settings.get('appearance.theme');
    const paper = settings.get('appearance.wallpaper');
    const ring = settings.get('appearance.ring');
    return html`
      ${{ raw: this.#head('Appearance', 'Theme, wallpaper and accent for this workspace.') }}
      <div class="rows panel">
        ${{
          raw: this.#row(
            'Theme',
            'Follow the system or lock to a mode.',
            html`<jg-select data-setting="appearance.theme" value="${theme}" size="sm">
              <option value="dark">Dark</option><option value="light">Light</option><option value="auto">System</option>
            </jg-select>`,
          ),
        }}
        ${{
          raw: this.#row(
            'Density',
            'Overall spacing of controls.',
            html`<jg-select data-setting="appearance.density" value="${settings.get('appearance.density')}" size="sm">
              <option value="compact">Compact</option><option value="cozy">Cozy</option><option value="roomy">Roomy</option>
            </jg-select>`,
          ),
        }}
        ${{
          raw: this.#row(
            'Animations',
            'Window and icon motion effects.',
            html`<jg-switch data-setting="appearance.motion" ${settings.get('appearance.motion') ? 'checked' : ''}></jg-switch>`,
          ),
        }}
      </div>
      <div class="panel stack">
        <div class="label">Accent</div>
        <div class="swatches">
          ${ACCENTS.map(
            (color) => html`<button class="swatch" data-accent="${color}" style="background:${color}" aria-pressed="${String(color === ring)}"></button>`,
          )}
        </div>
      </div>
      <div class="panel stack">
        <div class="label">Wallpaper</div>
        <div class="papers">
          ${wallpapers.map(
            (item) => html`<button
              class="paper"
              data-paper="${item.id}"
              aria-pressed="${String(item.id === paper)}"
              style="background:${(document.documentElement.dataset.theme === 'light' ? item.light : item.dark).replace(/\s+/g, ' ')};background-size:cover"
            >
              <span>${item.label}</span>
            </button>`,
          )}
        </div>
      </div>
    `;
  }

  #home() {
    return html`
      ${{ raw: this.#head('Home Screen', 'Icon grid, labels, dock and widgets.') }}
      <div class="rows panel">
        ${{
          raw: this.#row(
            'Icon size',
            'Size of app icons on the home grid.',
            html`<jg-select data-setting="home.iconSize" value="${settings.get('home.iconSize')}" size="sm">
              <option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option>
            </jg-select>`,
          ),
        }}
        ${{
          raw: this.#row(
            'Columns',
            'Fixed column count or automatic.',
            html`<jg-select data-setting="home.columns" value="${settings.get('home.columns')}" size="sm">
              <option value="auto">Auto</option><option value="4">4</option><option value="5">5</option>
              <option value="6">6</option><option value="7">7</option><option value="8">8</option>
            </jg-select>`,
          ),
        }}
        ${{
          raw: this.#row(
            'Show labels',
            'App names under each icon.',
            html`<jg-switch data-setting="home.labels" ${settings.get('home.labels') ? 'checked' : ''}></jg-switch>`,
          ),
        }}
        ${{
          raw: this.#row(
            'Show dock',
            'Pinned apps along the bottom edge.',
            html`<jg-switch data-setting="home.dock" ${settings.get('home.dock') ? 'checked' : ''}></jg-switch>`,
          ),
        }}
        ${{
          raw: this.#row(
            'Group apps into folders',
            'Organise the home screen by category.',
            html`<jg-switch id="groups" ${settings.get('home.groups') ? 'checked' : ''}></jg-switch>`,
          ),
        }}
        ${{
          raw: this.#row(
            'Show widgets',
            'Today panel beside the app grid.',
            html`<jg-switch data-setting="home.widgets" ${settings.get('home.widgets') ? 'checked' : ''}></jg-switch>`,
          ),
        }}
      </div>
      <div class="rows panel">
        ${{
          raw: this.#row(
            'Dock position',
            'Where the dock sits on screen.',
            html`<jg-select data-setting="dock.position" value="${settings.get('dock.position')}" size="sm">
              <option value="bottom">Bottom</option><option value="left">Left</option>
              <option value="right">Right</option><option value="hidden">Hidden</option>
            </jg-select>`,
          ),
        }}
        ${{
          raw: this.#row(
            'Auto-hide dock',
            'Slide it away until the pointer reaches the edge.',
            html`<jg-switch data-setting="dock.autoHide" ${settings.get('dock.autoHide') ? 'checked' : ''}></jg-switch>`,
          ),
        }}
        ${{
          raw: this.#row(
            'Fill dock automatically',
            'Keep your most used tools in the dock alongside pinned ones.',
            html`<jg-switch data-setting="dock.mode" data-truthy="auto" data-falsy="manual" ${settings.get('dock.mode') === 'auto' ? 'checked' : ''}></jg-switch>`,
          ),
        }}
        ${{
          raw: this.#row(
            'Show recents',
            'A separate section for recently opened tools.',
            html`<jg-switch data-setting="dock.recents" ${settings.get('dock.recents') ? 'checked' : ''}></jg-switch>`,
          ),
        }}
      </div>

      <div class="panel stack">
        <div class="spread">
          <div><div class="name strong">Layout</div><div class="hint">Pages, dock and widget arrangement.</div></div>
          <div class="row tight">
            <jg-button variant="outline" size="sm" id="reset-usage">Clear usage data</jg-button>
            <jg-button variant="outline" size="sm" id="reset-layout">Reset layout</jg-button>
          </div>
        </div>
      </div>
    `;
  }

  #behaviour() {
    return html`
      ${{ raw: this.#head('Behaviour', 'How apps open and how the shell responds.') }}
      <div class="rows panel">
        ${{
          raw: this.#row(
            'Open apps as',
            'Floating windows or full screen.',
            html`<jg-select data-setting="behavior.openMode" value="${settings.get('behavior.openMode')}" size="sm">
              <option value="window">Windows</option><option value="fullscreen">Full screen</option>
            </jg-select>`,
          ),
        }}
        ${{
          raw: this.#row(
            'Single window',
            'Opening an app closes the previous one.',
            html`<jg-switch data-setting="behavior.singleWindow" ${settings.get('behavior.singleWindow') ? 'checked' : ''}></jg-switch>`,
          ),
        }}
        ${{
          raw: this.#row(
            'Live results',
            'Tools recompute as you type.',
            html`<jg-switch data-setting="behavior.autoRun" ${settings.get('behavior.autoRun') ? 'checked' : ''}></jg-switch>`,
          ),
        }}
      </div>
    `;
  }

  #workspaces() {
    const active = workspaces.activeId;
    return html`
      ${{ raw: this.#head('Workspaces', 'Separate layouts and app settings for you or a team.') }}
      <div class="stack">
        ${workspaces.all().map(
          (workspace) => html`<div class="ws-card" data-active="${String(workspace.id === active)}" style="--tint:${workspace.tint}">
            <span class="ws-dot"></span>
            <div class="grow">
              <div class="strong">${workspace.name}</div>
              <div class="hint">${workspace.kind === 'team' ? 'Team' : 'Personal'} · ${Object.keys(storage.snapshot(`ws/${workspace.id}/`)).length} stored keys</div>
            </div>
            <div class="row tight">
              ${workspace.id === active
                ? html`<jg-badge tone="accent">Active</jg-badge>`
                : html`<jg-button size="sm" variant="outline" data-switch="${workspace.id}">Use</jg-button>`}
              <jg-button size="sm" variant="ghost" data-rename="${workspace.id}">Rename</jg-button>
              <jg-button size="sm" variant="ghost" data-export="${workspace.id}">Export</jg-button>
              <jg-button size="sm" variant="ghost" data-duplicate="${workspace.id}">Duplicate</jg-button>
              <jg-button size="sm" variant="destructive" data-delete="${workspace.id}">Delete</jg-button>
            </div>
          </div>`,
        )}
      </div>
      <div class="panel stack">
        <div class="label">New workspace</div>
        <div class="row nowrap">
          <jg-input id="ws-name" placeholder="Design team" class="grow"></jg-input>
          <jg-select id="ws-kind" value="personal" style="width:140px">
            <option value="personal">Personal</option><option value="team">Team</option>
          </jg-select>
          <jg-button id="ws-create">Create</jg-button>
        </div>
        <div class="hint">Workspaces keep their own home layout, widgets and per-app settings. Export one to share it with a teammate.</div>
        <div class="row"><jg-button variant="outline" size="sm" id="ws-import">Import workspace file</jg-button></div>
      </div>
    `;
  }

  #apps() {
    const hidden = layout.state().hidden;
    return html`
      ${{ raw: this.#head('Apps', 'Per-app preferences and what appears on the home screen.') }}
      ${hidden.length
        ? html`<div class="panel stack">
            <div class="label">Hidden from home</div>
            <div class="row">
              ${hidden.map((id) => {
                const meta = registry.find(id);
                return meta ? html`<jg-button size="sm" variant="outline" data-restore="${id}">${meta.name} ＋</jg-button>` : '';
              })}
            </div>
          </div>`
        : ''}
      ${registry
        .all()
        .filter((app) => app.settings?.length)
        .map(
          (app) => html`<div class="panel stack" style="--tint:${app.tint}">
            <div class="row nowrap">
              <span class="app-badge">${icon(app.icon, 15)}</span>
              <div class="grow"><div class="strong">${app.name}</div><div class="hint">${app.tagline}</div></div>
              <jg-button size="sm" variant="ghost" data-reset-app="${app.id}">Reset</jg-button>
            </div>
            <div class="rows">
              ${app.settings.map((field) => {
                const value = appConfig(app.id).get(field.key, field.default);
                const control =
                  field.type === 'switch'
                    ? html`<jg-switch data-app="${app.id}" data-key="${field.key}" ${value ? 'checked' : ''}></jg-switch>`
                    : field.type === 'number'
                      ? html`<jg-input type="number" size="sm" data-app="${app.id}" data-key="${field.key}" value="${value}" min="${field.min ?? ''}" max="${field.max ?? ''}" style="width:120px"></jg-input>`
                      : html`<jg-select size="sm" data-app="${app.id}" data-key="${field.key}" value="${value}">
                          ${field.options.map((option) => html`<option value="${option.value}">${option.label}</option>`)}
                        </jg-select>`;
                return raw(this.#row(field.label, `${app.id}.${field.key}`, control));
              })}
            </div>
          </div>`,
        )}
      <div class="panel stack">
        <div class="label">Installed</div>
        ${registry.categories().map(
          (group) => html`<div class="stack tight">
            <div class="hint strong">${group.name}</div>
            ${registry.byCategory(group.id).map(
              (app) => html`<div class="app-row" style="--tint:${app.tint}">
                <span class="app-badge">${icon(app.icon, 15)}</span>
                <div class="grow"><div class="strong">${app.name}</div><div class="hint mono tiny">/${app.id}</div></div>
                <jg-badge>${app.widget ? 'widget' : 'app'}</jg-badge>
              </div>`,
            )}
          </div>`,
        )}
      </div>
    `;
  }

  #data() {
    const keys = storage.keys();
    const bytes = keys.reduce((total, key) => total + JSON.stringify(storage.get(key) ?? '').length, 0);
    return html`
      ${{ raw: this.#head('Data', 'Everything is stored locally in this browser. Nothing leaves your device.') }}
      <div class="panel stack">
        <div class="spread"><span class="label">Local storage</span><span class="hint mono">${formatBytes(bytes)} · ${keys.length} keys</span></div>
        <div class="meter"><i style="width:${Math.min(100, (bytes / 5_000_000) * 100).toFixed(1)}%"></i></div>
        <div class="hint">Browser quota is typically around 5 MB per origin.</div>
      </div>
      <div class="panel stack">
        <div class="label">Backup</div>
        <div class="row">
          <jg-button variant="outline" size="sm" id="export-all">Export everything</jg-button>
          <jg-button variant="outline" size="sm" id="import-all">Import backup</jg-button>
          <jg-button variant="outline" size="sm" id="export-ws">Export this workspace</jg-button>
        </div>
      </div>
      <div class="panel stack">
        <div class="label">Danger zone</div>
        <div class="row">
          <jg-button variant="destructive" size="sm" id="reset-settings">Reset settings</jg-button>
          <jg-button variant="destructive" size="sm" id="reset-all">Erase all data</jg-button>
        </div>
      </div>
    `;
  }

  #about() {
    return html`
      ${{ raw: this.#head('About JS Globe', 'A home screen for small, fast developer tools.') }}
      <div class="panel stack">
        <div class="kv">
          <div>Tools installed</div><div>${registry.all().length}</div>
          <div>Categories</div><div>${registry.categories().length}</div>
          <div>Runtime</div><div>Custom elements, no framework</div>
          <div>Storage</div><div>Local only - nothing is uploaded</div>
          <div>Direct links</div><div class="mono">jsglobe.com/&lt;app-id&gt;</div>
        </div>
      </div>
      <div class="panel stack">
        <div class="label">Keyboard</div>
        <div class="kv">
          <div>⌘K / Ctrl+K</div><div>Search every tool</div>
          <div>⌘/ / Ctrl+/</div><div>Open the app library</div>
          <div>Esc</div><div>Back to the home screen</div>
        </div>
      </div>
    `;
  }

  #wireSection() {
    this.$$('[data-setting]').forEach((node) => {
      this.on(node, 'change', (event) => {
        const key = node.dataset.setting;
        let value = node.tagName === 'JG-SWITCH' ? event.detail.checked : event.detail.value;
        if (node.dataset.truthy) value = value ? node.dataset.truthy : node.dataset.falsy;
        settings.set(key, value);
        if (key === 'appearance.density' || key === 'appearance.theme') this.refresh();
      });
    });

    this.$$('[data-app][data-key]').forEach((node) => {
      this.on(node, 'change', (event) => {
        const value = node.tagName === 'JG-SWITCH' ? event.detail.checked : event.detail.value;
        appConfig(node.dataset.app).set(node.dataset.key, value);
        toast('Saved');
      });
    });

    this.bind('[data-accent]', 'click', (event) => {
      settings.set('appearance.ring', event.currentTarget.dataset.accent);
      this.refresh();
    });

    this.bind('[data-paper]', 'click', (event) => {
      settings.set('appearance.wallpaper', event.currentTarget.dataset.paper);
      this.refresh();
    });

    this.bind('[data-switch]', 'click', (event) => workspaces.switchTo(event.currentTarget.dataset.switch));
    this.bind('[data-rename]', 'click', (event) => {
      const id = event.currentTarget.dataset.rename;
      const name = prompt('Workspace name', workspaces.all().find((item) => item.id === id)?.name);
      if (name) workspaces.update(id, { name });
    });
    this.bind('[data-duplicate]', 'click', (event) => {
      workspaces.duplicate(event.currentTarget.dataset.duplicate);
      toast('Workspace duplicated', 'success');
    });
    this.bind('[data-delete]', 'click', (event) => {
      const id = event.currentTarget.dataset.delete;
      if (!confirm('Delete this workspace and everything stored in it?')) return;
      if (!workspaces.remove(id)) toast('The last workspace cannot be deleted', 'error');
    });
    this.bind('[data-export]', 'click', (event) => {
      const id = event.currentTarget.dataset.export;
      const payload = workspaces.export(id);
      download(`jsglobe-${payload.workspace.name.toLowerCase().replace(/\s+/g, '-')}.json`, JSON.stringify(payload, null, 2), 'application/json');
    });

    const create = this.$('#ws-create');
    if (create) {
      this.on(create, 'click', () => {
        const name = this.$('#ws-name').value.trim();
        if (!name) return toast('Name the workspace first', 'error');
        const workspace = workspaces.create({ name, kind: this.$('#ws-kind').value });
        workspaces.switchTo(workspace.id);
        toast('Workspace created', 'success');
      });
    }

    const importWs = this.$('#ws-import');
    if (importWs) {
      this.on(importWs, 'click', async () => {
        const file = await pickFile('application/json');
        if (!file) return;
        try {
          const workspace = workspaces.import(JSON.parse(file.data));
          workspaces.switchTo(workspace.id);
          toast('Workspace imported', 'success');
        } catch (error) {
          toast(error.message, 'error');
        }
      });
    }

    this.bind('[data-restore]', 'click', (event) => layout.restore(event.currentTarget.dataset.restore));
    this.bind('[data-reset-app]', 'click', (event) => {
      appConfig(event.currentTarget.dataset.resetApp).reset();
      this.refresh();
    });

    const groups = this.$('#groups');
    if (groups) {
      this.on(groups, 'change', (event) => {
        settings.set('home.groups', event.detail.checked);
        if (event.detail.checked) layout.groupByCategory();
        else layout.ungroupAll();
        toast(event.detail.checked ? 'Apps grouped into folders' : 'Folders removed', 'success');
      });
    }

    const resetUsage = this.$('#reset-usage');
    if (resetUsage) {
      this.on(resetUsage, 'click', () => {
        usage.clear();
        toast('Usage history cleared');
      });
    }

    const resetLayout = this.$('#reset-layout');
    if (resetLayout) this.on(resetLayout, 'click', () => { layout.reset(); toast('Layout reset', 'success'); });

    const exportAll = this.$('#export-all');
    if (exportAll) {
      this.on(exportAll, 'click', () =>
        download('jsglobe-backup.json', JSON.stringify({ format: 'jsglobe.backup', version: 1, data: storage.snapshot() }, null, 2), 'application/json'),
      );
    }

    const importAll = this.$('#import-all');
    if (importAll) {
      this.on(importAll, 'click', async () => {
        const file = await pickFile('application/json');
        if (!file) return;
        try {
          const payload = JSON.parse(file.data);
          if (payload.format !== 'jsglobe.backup') throw new Error('Not a JSGlobe backup');
          storage.restore(payload.data);
          location.reload();
        } catch (error) {
          toast(error.message, 'error');
        }
      });
    }

    const exportWs = this.$('#export-ws');
    if (exportWs) {
      this.on(exportWs, 'click', () => {
        const payload = workspaces.export();
        download('jsglobe-workspace.json', JSON.stringify(payload, null, 2), 'application/json');
      });
    }

    const resetSettings = this.$('#reset-settings');
    if (resetSettings) this.on(resetSettings, 'click', () => { settings.reset(); this.refresh(); toast('Settings reset'); });

    const resetAll = this.$('#reset-all');
    if (resetAll) {
      this.on(resetAll, 'click', () => {
        if (!confirm('Erase every workspace, layout and saved tool state?')) return;
        storage.clear();
        location.reload();
      });
    }
  }
}

define('jg-app-settings', SettingsApp);
