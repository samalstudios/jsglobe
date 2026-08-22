import { JGApp, define, html, raw, styleSheet } from '../../core/app.js';
import { appText } from '../../core/i18n.js';
import strings from './i18n.js';
import { settings } from '../../core/settings.js';
import { appSettings } from '../../core/app-settings.js';
import { workspaces } from '../../core/workspaces.js';
import { layout } from '../../core/layout.js';
import { registry } from '../../core/registry.js';
import { appConfig } from '../../core/config.js';
import { storage } from '../../core/storage.js';
import { bus } from '../../core/bus.js';
import { wallpapers } from '../../core/wallpapers.js';
import { usage } from '../../core/usage.js';
import { analytics } from '../../core/analytics.js';
import { consent } from '../../core/consent.js';
import { router } from '../../core/router.js';
import { REPO_URL } from '../../core/site.js';
import { MODELS as aiModels } from '../../core/ai.js';
import { WHISPER_MODELS as whisperModels } from '../../core/speech.js';
import { icon } from '../../ui/icons.js';
import { download, pickFile, toast, formatBytes } from '../../core/util.js';

const t = appText(strings);

const sheet = await styleSheet(import.meta.url);

const ACCENTS = ['#8a1c3b', '#6f7cff', '#8b5cf6', '#ec4899', '#f97316', '#22c55e', '#14b8a6', '#0ea5e9'];

const SECTIONS = [
  { id: 'appearance', label: t('settings-app.appearance', 'Appearance'), icon: 'palette' },
  { id: 'home', label: t('settings-app.homeScreen', 'Home Screen'), icon: 'home' },
  { id: 'behavior', label: t('settings-app.behaviour', 'Behaviour'), icon: 'cog' },
  { id: 'ai', label: t('settings-app.localAi', 'Local AI'), icon: 'sparkles' },
  { id: 'media', label: t('settings-app.mediaEngine', 'Media engine'), icon: 'film' },
  { id: 'workspaces', label: t('settings-app.workspaces', 'Workspaces'), icon: 'layers' },
  { id: 'apps', label: t('settings-app.apps', 'Apps'), icon: 'launcher' },
  { id: 'data', label: t('settings-app.data', 'Data'), icon: 'database' },
  { id: 'about', label: t('settings-app.about', 'About'), icon: 'info' },
];

class SettingsApp extends JGApp {
  static appId = 'settings';
  static styles = [...JGApp.styles, sheet];

  #section = 'appearance';
  #query = '';
  #scanned = false;
  #scanning = false;

  connectedCallback() {
    super.connectedCallback();
    this.keep(bus.on('workspaces:change', () => this.refresh()));
    this.keep(bus.on('workspace:switch', () => this.refresh()));
  }

  renderWidget() {
    this.paint(html`<div class="app"><div class="stack tight">
      <div class="label">${t('settings-app.workspace', 'Workspace')}</div>
      <div class="title">${workspaces.active().name}</div>
      <div class="hint">${registry.all().length} tools installed</div>
    </div></div>`);
  }

  renderApp() {
    this.paint(html`
      <div class="shell">
        <nav class="nav">
          <jg-input id="find" size="sm" placeholder="${t('settings-app.searchSettings', 'Search settings')}" value="${this.#query}"></jg-input>
          ${SECTIONS.map(
            (section) => html`<button class="nav-item" data-section="${section.id}" aria-current="${String(section.id === this.#section)}">
              <span class="nav-icon">${icon(section.icon, 16)}</span><span>${section.label}</span>
            </button>`,
          )}
        </nav>
        <div class="pane scroll" id="pane"></div>
      </div>
    `);
    this.bind('.nav-item', 'click', (event) => {
      this.#section = event.currentTarget.dataset.section;
      this.#query = '';
      this.refresh();
    });
    const find = this.$('#find');
    this.on(find, 'input', () => {
      this.#query = find.value.trim();
      this.#renderSection();
    });
    this.#renderSection();
  }

  #renderSection() {
    const pane = this.$('#pane');
    if (this.#query) {
      this.#renderSearch(pane);
      return;
    }
    const render = {
      appearance: () => this.#appearance(),
      home: () => this.#home(),
      behavior: () => this.#behaviour(),
      ai: () => this.#ai(),
      media: () => this.#media(),
      workspaces: () => this.#workspaces(),
      apps: () => this.#apps(),
      data: () => this.#data(),
      about: () => this.#about(),
    }[this.#section];
    pane.innerHTML = render();
    this.#wireSection();
    if (this.#section === 'apps') this.#scanApps();
  }

  #renderSearch(pane) {
    const sections = SECTIONS.filter((section) => section.id !== 'about');
    pane.innerHTML = html`${{
      raw: sections
        .map((section) => {
          const body = { appearance: () => this.#appearance(), home: () => this.#home(), behavior: () => this.#behaviour(), ai: () => this.#ai(), media: () => this.#media(), workspaces: () => this.#workspaces(), apps: () => this.#apps(), data: () => this.#data() }[section.id];
          return body ? `<div data-search-section="${section.id}">${body()}</div>` : '';
        })
        .join(''),
    }}`;
    this.#wireSection();

    const term = this.#query.toLowerCase();
    let hits = 0;
    this.$$('#pane .settings-row').forEach((row) => {
      const match = row.textContent.toLowerCase().includes(term) || (row.dataset.key ?? '').toLowerCase().includes(term);
      row.hidden = !match;
      if (match) hits += 1;
    });
    this.$$('#pane .panel').forEach((panel) => {
      const rows = [...panel.querySelectorAll('.settings-row')];
      const visible = rows.some((row) => !row.hidden);
      const own = panel.textContent.toLowerCase().includes(term);
      panel.hidden = rows.length ? !visible : !own;
      if (!panel.hidden && !rows.length) hits += 1;
    });
    this.$$('[data-search-section]').forEach((section) => {
      const alive = [...section.querySelectorAll('.settings-row, .panel')].some((node) => !node.hidden);
      section.hidden = !alive;
    });

    if (!hits) {
      pane.innerHTML = html`<div class="center" style="padding:60px 20px"><div class="hint">Nothing matches "${this.#query}".</div></div>`;
    }
  }

  #head(title, sub) {
    return html`<div><div class="section-title">${title}</div><div class="section-sub">${sub}</div></div>`;
  }

  #row(name, desc, control) {
    const key = String(control).match(/data-setting="([^"]+)"/)?.[1] ?? '';
    return html`<div class="settings-row" data-key="${key}">
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
              <option value="dark">${t('settings-app.dark', 'Dark')}</option><option value="light">${t('settings-app.light', 'Light')}</option><option value="auto">${t('settings-app.system', 'System')}</option>
            </jg-select>`,
          ),
        }}
        ${{
          raw: this.#row(
            'Density',
            'Overall spacing of controls.',
            html`<jg-select data-setting="appearance.density" value="${settings.get('appearance.density')}" size="sm">
              <option value="compact">${t('settings-app.compact', 'Compact')}</option><option value="cozy">${t('settings-app.cozy', 'Cozy')}</option><option value="roomy">${t('settings-app.roomy', 'Roomy')}</option>
            </jg-select>`,
          ),
        }}
        ${{
          raw: this.#row(
            'Icon colour',
            'How much colour the app icons carry.',
            html`<jg-select data-setting="appearance.iconTint" value="${settings.get('appearance.iconTint')}" size="sm" style="width:160px">
              <option value="category">${t('settings-app.byCategory', 'By category')}</option>
              <option value="accent">${t('settings-app.accentOnly', 'Accent only')}</option>
              <option value="neutral">${t('settings-app.neutral', 'Neutral')}</option>
            </jg-select>`,
          ),
        }}
        ${{
          raw: this.#row(
            'Icon style',
            'Flat keeps the drawn icons plain. Skeuomorphic adds gloss, a bevel and depth.',
            html`<jg-select data-setting="appearance.icons" value="${settings.get('appearance.icons')}" size="sm" style="width:160px">
              <option value="flat">${t('settings-app.flat', 'Flat')}</option>
              <option value="skeuomorphic">${t('settings-app.skeuomorphic', 'Skeuomorphic')}</option>
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
        <div class="label">${t('settings-app.accent', 'Accent')}</div>
        <div class="swatches">
          ${ACCENTS.map(
            (color) => html`<button class="swatch" data-accent="${color}" style="background:${color}" aria-pressed="${String(color === ring)}"></button>`,
          )}
        </div>
      </div>
      <div class="panel stack">
        <div class="label">${t('settings-app.wallpaper', 'Wallpaper')}</div>
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
              <option value="small">${t('settings-app.small', 'Small')}</option><option value="medium">${t('settings-app.medium', 'Medium')}</option><option value="large">${t('settings-app.large', 'Large')}</option>
            </jg-select>`,
          ),
        }}
        ${{
          raw: this.#row(
            'Columns',
            'Fixed column count or automatic.',
            html`<jg-select data-setting="home.columns" value="${settings.get('home.columns')}" size="sm">
              <option value="auto">${t('settings-app.auto', 'Auto')}</option><option value="4">4</option><option value="5">5</option>
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
            'Search page',
            'A minimal search and widget page before the app grid.',
            html`<jg-switch data-setting="home.searchPage" ${settings.get('home.searchPage') ? 'checked' : ''}></jg-switch>`,
          ),
        }}
        ${{
          raw: this.#row(
            'Most used on the search page',
            'A shortcut row of the tools you open most.',
            html`<jg-switch data-setting="home.mostUsed" ${settings.get('home.mostUsed') ? 'checked' : ''}></jg-switch>`,
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
              <option value="bottom">${t('settings-app.bottom', 'Bottom')}</option><option value="left">${t('settings-app.left', 'Left')}</option>
              <option value="right">${t('settings-app.right', 'Right')}</option><option value="hidden">${t('settings-app.hidden', 'Hidden')}</option>
            </jg-select>`,
          ),
        }}
        ${{
          raw: this.#row(
            'Dock appears',
            'Keep the dock to the search page or show it everywhere.',
            html`<jg-select data-setting="dock.scope" value="${settings.get('dock.scope')}" size="sm" style="width:170px">
              <option value="search">${t('settings-app.searchPageOnly', 'Search page only')}</option>
              <option value="always">${t('settings-app.everywhere', 'Everywhere')}</option>
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
          <div><div class="name strong">${t('settings-app.layout', 'Layout')}</div><div class="hint">${t('settings-app.pagesDockAndWidgetArrangement', 'Pages, dock and widget arrangement.')}</div></div>
          <div class="row tight">
            <jg-button variant="outline" size="sm" id="reset-usage">${t('settings-app.clearUsageData', 'Clear usage data')}</jg-button>
            <jg-button variant="outline" size="sm" id="reset-layout">${t('settings-app.resetLayout', 'Reset layout')}</jg-button>
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
              <option value="window">${t('settings-app.windows', 'Windows')}</option><option value="fullscreen">${t('settings-app.fullScreen', 'Full screen')}</option>
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

  #ai() {
    const provider = settings.get('ai.provider');
    return html`
      ${{ raw: this.#head('Local AI', 'Run a model in this browser with WebLLM, or connect to a server on your own machine.') }}

      <div class="rows panel">
        ${{
          raw: this.#row(
            'Provider',
            'WebLLM downloads a model and runs it on the GPU. A local server keeps the weights outside the browser.',
            html`<jg-select data-setting="ai.provider" value="${provider}" size="sm" style="width:190px">
              <option value="off">${t('settings-app.off', 'Off')}</option>
              <option value="webllm">${t('settings-app.webllmInBrowser', 'WebLLM in browser')}</option>
              <option value="endpoint">${t('settings-app.localServerOpenaiApi', 'Local server (OpenAI API)')}</option>
            </jg-select>`,
          ),
        }}
      </div>

      ${provider === 'webllm'
        ? html`<div class="panel stack">
            <div class="label">${t('settings-app.model', 'Model')}</div>
            <jg-select data-setting="ai.model" value="${settings.get('ai.model')}">
              ${aiModels.map((model) => html`<option value="${model.id}">${model.label} (${model.size}) - ${model.note}</option>`)}
            </jg-select>
            <div class="hint">
              The model is downloaded once and cached by the browser. It needs WebGPU:
              ${navigator.gpu ? 'this browser supports it.' : 'this browser does not support it yet.'}
            </div>
            <div class="label">${t('settings-app.runtimeModule', 'Runtime module')}</div>
            <jg-input data-setting="ai.moduleUrl" value="${settings.get('ai.moduleUrl')}" mono></jg-input>
            <div class="hint">${t('settings-app.pointThisAtASelf', 'Point this at a self-hosted copy of WebLLM if you would rather not use a CDN.')}</div>
          </div>`
        : ''}

      ${provider === 'endpoint'
        ? html`<div class="panel stack">
            <div class="label">${t('settings-app.server', 'Server')}</div>
            <jg-input data-setting="ai.endpoint" value="${settings.get('ai.endpoint')}" mono></jg-input>
            <div class="hint">${t('settings-app.ollamaUsesHttpLocalhost11434', 'Ollama uses http://localhost:11434/v1 and LM Studio uses http://localhost:1234/v1.')}</div>
            <div class="label">${t('settings-app.modelName', 'Model name')}</div>
            <jg-input data-setting="ai.model" value="${settings.get('ai.model')}" mono></jg-input>
            <div class="label">${t('settings-app.apiKeyOptional', 'API key (optional)')}</div>
            <jg-input data-setting="ai.apiKey" type="password" value="${settings.get('ai.apiKey')}"></jg-input>
          </div>`
        : ''}

      ${provider === 'off'
        ? ''
        : html`<div class="rows panel">
            ${{
              raw: this.#row(
                'Temperature',
                'Higher values give more varied answers.',
                html`<jg-slider data-setting="ai.temperature" min="0" max="1.5" step="0.1" value="${settings.get('ai.temperature')}" style="width:180px"></jg-slider>`,
              ),
            }}
            ${{
              raw: this.#row(
                'Response limit',
                'Maximum tokens per answer.',
                html`<jg-input data-setting="ai.maxTokens" type="number" min="128" max="8192" value="${settings.get('ai.maxTokens')}" size="sm" style="width:120px"></jg-input>`,
              ),
            }}
          </div>`}

      <div class="panel stack">
        <div class="label">${t('settings-app.speechToText', 'Speech to text')}</div>
        <div class="hint">
          Voice Recorder transcribes with Whisper running locally. Text models such as WebLLM cannot read audio, so
          this is a separate download the first time you transcribe.
        </div>
        <jg-select data-setting="speech.model" value="${settings.get('speech.model')}">
          ${whisperModels.map((model) => html`<option value="${model.id}">${model.label} (${model.size})</option>`)}
        </jg-select>
        <div class="label">${t('settings-app.speechRuntime', 'Speech runtime')}</div>
        <jg-input data-setting="speech.moduleUrl" value="${settings.get('speech.moduleUrl')}" mono></jg-input>
      </div>

      <div class="panel stack">
        <div class="label">${t('settings-app.privacy', 'Privacy')}</div>
        <div class="hint">
          Prompts stay on this machine. WebLLM downloads model weights from the model host the first time and then
          works offline; a local server never leaves your network.
        </div>
      </div>
    `;
  }

  #media() {
    return html`
      ${{ raw: this.#head('Media engine', 'Video and audio conversion runs through an FFmpeg WebAssembly build.') }}
      <div class="panel stack">
        <div class="label">${t('settings-app.ffmpegModule', 'FFmpeg module')}</div>
        <jg-input data-setting="media.moduleUrl" value="${settings.get('media.moduleUrl')}" mono></jg-input>
        <div class="label">${t('settings-app.coreFiles', 'Core files')}</div>
        <jg-input data-setting="media.coreUrl" value="${settings.get('media.coreUrl')}" mono></jg-input>
        <div class="hint">
          The folder holding ffmpeg-core.js and ffmpeg-core.wasm. For a locked down deployment, copy those files into
          /assets/ffmpeg on your own server and set both fields to that path.
        </div>
      </div>
      <div class="panel stack">
        <div class="label">${t('settings-app.notes', 'Notes')}</div>
        <div class="hint">
          The single threaded core needs no special headers. Conversion speed is roughly a quarter of native FFmpeg,
          so keep clips short. Images are handled by the Image Converter without any download.
        </div>
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
                ? html`<jg-badge tone="accent">${t('settings-app.active', 'Active')}</jg-badge>`
                : html`<jg-button size="sm" variant="outline" data-switch="${workspace.id}">${t('settings-app.use', 'Use')}</jg-button>`}
              <jg-button size="sm" variant="ghost" data-rename="${workspace.id}">${t('settings-app.rename', 'Rename')}</jg-button>
              <jg-button size="sm" variant="ghost" data-export="${workspace.id}">${t('settings-app.export', 'Export')}</jg-button>
              <jg-button size="sm" variant="ghost" data-duplicate="${workspace.id}">${t('settings-app.duplicate', 'Duplicate')}</jg-button>
              <jg-button size="sm" variant="destructive" data-delete="${workspace.id}">${t('settings-app.delete', 'Delete')}</jg-button>
            </div>
          </div>`,
        )}
      </div>
      <div class="panel stack">
        <div class="label">${t('settings-app.newWorkspace', 'New workspace')}</div>
        <div class="row nowrap">
          <jg-input id="ws-name" placeholder="${t('settings-app.designTeam', 'Design team')}" class="grow"></jg-input>
          <jg-select id="ws-kind" value="personal" style="width:140px">
            <option value="personal">${t('settings-app.personal', 'Personal')}</option><option value="team">${t('settings-app.team', 'Team')}</option>
          </jg-select>
          <jg-button id="ws-create">${t('settings-app.create', 'Create')}</jg-button>
        </div>
        <div class="hint">${t('settings-app.workspacesKeepTheirOwnHome', 'Workspaces keep their own home layout, widgets and per-app settings. Export one to share it with a teammate.')}</div>
        <div class="row"><jg-button variant="outline" size="sm" id="ws-import">${t('settings-app.importWorkspaceFile', 'Import workspace file')}</jg-button></div>
      </div>
    `;
  }

  #apps() {
    const hidden = layout.state().hidden;
    const configurable = registry
      .all({ includeSystem: true })
      .filter((app) => appSettings.has(app.id));
    return html`
      ${{ raw: this.#head('Apps', 'Per-app preferences and what appears on the home screen.') }}
      ${hidden.length
        ? html`<div class="panel stack">
            <div class="label">${t('settings-app.hiddenFromHome', 'Hidden from home')}</div>
            <div class="row">
              ${hidden.map((id) => {
                const meta = registry.find(id);
                return meta ? html`<jg-button size="sm" variant="outline" data-restore="${id}">${meta.name} ＋</jg-button>` : '';
              })}
            </div>
          </div>`
        : ''}
      <jg-progress id="scan" size="sm" label="${t('settings-app.readingAppPreferences', 'Reading app preferences')}" indeterminate ${this.#scanning ? '' : 'hidden'}></jg-progress>
      ${configurable.map((app) => {
        const fields = appSettings.schema(app.id);
        return html`<div class="panel stack" style="--tint:${registry.tint(app)}">
          <div class="row nowrap">
            <span class="app-badge">${icon(app.icon, 15)}</span>
            <div class="grow"><div class="strong">${app.name}</div><div class="hint">${app.tagline}</div></div>
            <jg-button size="sm" variant="ghost" data-reset-app="${app.id}">${t('settings-app.reset', 'Reset')}</jg-button>
          </div>
          <div class="rows">
            ${fields.map((field) => {
              const value = appConfig(app.id).get(field.key, field.default);
              const control =
                field.type === 'switch'
                  ? html`<jg-switch data-app="${app.id}" data-key="${field.key}" ${value ? 'checked' : ''}></jg-switch>`
                  : field.type === 'number'
                    ? html`<jg-input type="number" size="sm" data-app="${app.id}" data-key="${field.key}" value="${value}" min="${field.min ?? ''}" max="${field.max ?? ''}" style="width:120px"></jg-input>`
                  : field.type === 'text' || !field.options
                    ? html`<jg-input size="sm" data-app="${app.id}" data-key="${field.key}" value="${value}" style="width:220px"></jg-input>`
                    : html`<jg-select size="sm" data-app="${app.id}" data-key="${field.key}" value="${value}">
                        ${field.options.map((option) => html`<option value="${option.value}">${option.label}</option>`)}
                      </jg-select>`;
              return raw(this.#row(field.label, `${app.id}.${field.key}`, control));
            })}
          </div>
        </div>`;
      })}
      <div class="panel stack">
        <div class="label">${t('settings-app.installed', 'Installed')}</div>
        ${registry.categories().map(
          (group) => html`<div class="stack tight">
            <div class="hint strong">${group.name}</div>
            ${registry.byCategory(group.id).map(
              (app) => html`<div class="app-row" style="--tint:${registry.tint(app)}">
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

  async #scanApps() {
    if (this.#scanned) return;
    this.#scanned = true;
    const known = appSettings.known();
    const ids = registry.all({ includeSystem: true }).map((app) => app.id);
    const first = ids.filter((id) => known.includes(id) && !appSettings.has(id));
    const rest = ids.filter((id) => !known.includes(id) && !appSettings.has(id));

    const load = async (batch) => {
      for (const id of batch) await registry.load(id).catch(() => null);
    };

    if (first.length) {
      await load(first);
      if (this.#section === 'apps') this.#renderSection();
    }
    if (!rest.length) return;

    this.#scanning = true;
    const bar = this.$('#scan');
    if (bar) bar.hidden = false;
    await load(rest);
    this.#scanning = false;
    appSettings.forget(known.filter((id) => !appSettings.has(id)));
    if (this.#section === 'apps') this.#renderSection();
  }

  #data() {
    const keys = storage.keys();
    const bytes = keys.reduce((total, key) => total + JSON.stringify(storage.get(key) ?? '').length, 0);
    return html`
      ${{ raw: this.#head('Data', 'Everything is stored locally in this browser. Nothing leaves your device.') }}
      <div class="panel stack">
        <div class="spread"><span class="label">${t('settings-app.localStorage', 'Local storage')}</span><span class="hint mono">${formatBytes(bytes)} · ${keys.length} keys</span></div>
        <div class="meter"><i style="width:${Math.min(100, (bytes / 5_000_000) * 100).toFixed(1)}%"></i></div>
        <div class="hint">${t('settings-app.browserQuotaIsTypicallyAround', 'Browser quota is typically around 5 MB per origin.')}</div>
      </div>
      <div class="rows panel">
        ${{
          raw: this.#row(
            'Anonymous usage analytics',
            'Google Analytics records which tool pages are opened. It never sees anything you type, paste or upload.',
            html`<jg-switch id="analytics" ${consent.granted ? 'checked' : ''}></jg-switch>`,
          ),
        }}
        ${{
          raw: this.#row(
            'Privacy policy',
            consent.decided
              ? `You chose to ${consent.granted ? 'allow' : 'decline'} analytics cookies.`
              : 'You have not answered the cookie banner yet.',
            html`<jg-button size="sm" variant="outline" id="open-privacy">${t('settings-app.readPolicy', 'Read policy')}</jg-button>`,
          ),
        }}
      </div>

      <div class="panel stack">
        <div class="label">${t('settings-app.backup', 'Backup')}</div>
        <div class="row">
          <jg-button variant="outline" size="sm" id="export-all">${t('settings-app.exportEverything', 'Export everything')}</jg-button>
          <jg-button variant="outline" size="sm" id="import-all">${t('settings-app.importBackup', 'Import backup')}</jg-button>
          <jg-button variant="outline" size="sm" id="export-ws">${t('settings-app.exportThisWorkspace', 'Export this workspace')}</jg-button>
        </div>
      </div>
      <div class="panel stack">
        <div class="label">${t('settings-app.dangerZone', 'Danger zone')}</div>
        <div class="row">
          <jg-button variant="destructive" size="sm" id="reset-settings">${t('settings-app.resetSettings', 'Reset settings')}</jg-button>
          <jg-button variant="destructive" size="sm" id="reset-all">${t('settings-app.eraseAllData', 'Erase all data')}</jg-button>
        </div>
      </div>
    `;
  }

  #about() {
    return html`
      ${{ raw: this.#head('About JS Globe', 'A home screen for small, fast developer tools.') }}
      <div class="panel stack">
        <div class="kv">
          <div>${t('settings-app.toolsInstalled', 'Tools installed')}</div><div>${registry.all().length}</div>
          <div>${t('settings-app.categories', 'Categories')}</div><div>${registry.categories().length}</div>
          <div>${t('settings-app.runtime', 'Runtime')}</div><div>${t('settings-app.customElementsNoFramework', 'Custom elements, no framework')}</div>
          <div>${t('settings-app.storage', 'Storage')}</div><div>${t('settings-app.localOnlyNothingIsUploaded', 'Local only - nothing is uploaded')}</div>
          <div>${t('settings-app.directLinks', 'Direct links')}</div><div class="mono">${t('settings-app.jsglobeComAppsLtApp', 'jsglobe.com/apps/&lt;app-id&gt;')}</div>
        </div>
        <div class="row">
          <jg-button size="sm" variant="outline" id="open-repo">${icon('github', 14)} GitHub</jg-button>
          <jg-button size="sm" variant="outline" id="about-privacy">${t('settings-app.privacyPolicy', 'Privacy policy')}</jg-button>
        </div>
      </div>
      <div class="panel stack">
        <div class="label">${t('settings-app.keyboard', 'Keyboard')}</div>
        <div class="kv">
          <div>${t('settings-app.kCtrlK', '⌘K / Ctrl+K')}</div><div>${t('settings-app.searchEveryTool', 'Search every tool')}</div>
          <div>${t('settings-app.ctrl', '⌘/ / Ctrl+/')}</div><div>${t('settings-app.openTheAppLibrary', 'Open the app library')}</div>
          <div>${t('settings-app.esc', 'Esc')}</div><div>${t('settings-app.backToTheHomeScreen', 'Back to the home screen')}</div>
        </div>
      </div>
    `;
  }

  #wireSection() {
    this.$$('[data-setting]').forEach((node) => {
      if (node.tagName === 'JG-SLIDER') {
        this.on(node, 'input', () => settings.set(node.dataset.setting, Number(node.value)));
      }
      this.on(node, 'change', (event) => {
        const key = node.dataset.setting;
        let value = node.tagName === 'JG-SWITCH' ? event.detail.checked : event.detail.value ?? node.value;
        if (node.tagName === 'JG-SLIDER') value = Number(node.value);
        if (node.getAttribute('type') === 'number') value = Number(value);
        if (node.dataset.truthy) value = value ? node.dataset.truthy : node.dataset.falsy;
        settings.set(key, value);
        if (['appearance.density', 'appearance.theme', 'ai.provider'].includes(key)) this.refresh();
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

    [this.$('#open-privacy'), this.$('#about-privacy')].forEach((node) => {
      if (node) this.on(node, 'click', () => router.go('/privacy'));
    });

    const repo = this.$('#open-repo');
    if (repo) this.on(repo, 'click', () => window.open(REPO_URL, '_blank', 'noopener'));

    const analyticsToggle = this.$('#analytics');
    if (analyticsToggle) {
      this.on(analyticsToggle, 'change', (event) => {
        consent.set(event.detail.checked);
        analytics.start();
        toast(event.detail.checked ? 'Analytics on' : 'Analytics off, reload to fully unload it');
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
