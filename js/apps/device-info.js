import { JGApp, define, html, css } from '../core/app.js';
import { t } from '../core/i18n.js';
import { formatBytes } from '../core/util.js';

const sheet = css`
  .live { font-family: var(--font-mono); }
`;

const yes = (value) => (value ? 'Yes' : 'No');

const parseAgent = (agent) => {
  const browser =
    /Firefox\/([\d.]+)/.exec(agent)?.slice(0, 2).join(' ') ??
    /Edg\/([\d.]+)/.exec(agent)?.slice(0, 2).join(' ').replace('Edg', 'Edge') ??
    /OPR\/([\d.]+)/.exec(agent)?.slice(0, 2).join(' ').replace('OPR', 'Opera') ??
    /Chrome\/([\d.]+)/.exec(agent)?.slice(0, 2).join(' ') ??
    /Version\/([\d.]+).*Safari/.exec(agent)?.slice(0, 2).join(' ').replace('Version', 'Safari') ??
    'Unknown';

  const system =
    /Windows NT ([\d.]+)/.test(agent) ? 'Windows'
    : /Mac OS X/.test(agent) ? 'macOS'
    : /Android/.test(agent) ? 'Android'
    : /(iPhone|iPad|iPod)/.test(agent) ? 'iOS'
    : /Linux/.test(agent) ? 'Linux'
    : 'Unknown';

  return { browser: browser.replace('/', ' '), system };
};

class DeviceInfo extends JGApp {
  static appId = 'device-info';
  static styles = [...JGApp.styles, sheet];

  #timer = null;

  disconnectedCallback() {
    super.disconnectedCallback();
    clearInterval(this.#timer);
  }

  renderApp() {
    const agent = navigator.userAgent;
    const parsed = parseAgent(agent);

    this.paint(html`<div class="app">
      <jg-card title="${t('device-info.browser', 'Browser')}">
        <div class="kv">
          <div>${t('device-info.browser', 'Browser')}</div><div>${parsed.browser}</div>
          <div>${t('device-info.operatingSystem', 'Operating system')}</div><div>${parsed.system}</div>
          <div>${t('device-info.platform', 'Platform')}</div><div>${navigator.platform ?? '-'}</div>
          <div>${t('device-info.languages', 'Languages')}</div><div>${navigator.languages?.join(', ') ?? navigator.language}</div>
          <div>${t('device-info.cookiesEnabled', 'Cookies enabled')}</div><div>${yes(navigator.cookieEnabled)}</div>
          <div>${t('device-info.doNotTrack', 'Do not track')}</div><div>${navigator.doNotTrack ?? 'not set'}</div>
          <div>${t('device-info.online', 'Online')}</div><div id="online">${yes(navigator.onLine)}</div>
        </div>
      </jg-card>

      <jg-card title="${t('device-info.screenAndWindow', 'Screen and window')}">
        <div class="kv live" id="screen"></div>
      </jg-card>

      <jg-card title="${t('device-info.hardware', 'Hardware')}">
        <div class="kv">
          <div>${t('device-info.cpuThreads', 'CPU threads')}</div><div>${navigator.hardwareConcurrency ?? 'unknown'}</div>
          <div>${t('device-info.deviceMemory', 'Device memory')}</div><div>${navigator.deviceMemory ? `${navigator.deviceMemory} GB (approx)` : 'unknown'}</div>
          <div>${t('device-info.maxTouchPoints', 'Max touch points')}</div><div>${navigator.maxTouchPoints ?? 0}</div>
          <div>${t('device-info.pointer', 'Pointer')}</div><div>${matchMedia('(pointer: coarse)').matches ? 'Coarse (touch)' : 'Fine (mouse)'}</div>
          <div>${t('device-info.storageEstimate', 'Storage estimate')}</div><div id="storage">${t('device-info.checking', 'checking...')}</div>
        </div>
      </jg-card>

      <jg-card title="${t('device-info.preferences', 'Preferences')}">
        <div class="kv">
          <div>${t('device-info.colourScheme', 'Colour scheme')}</div><div>${matchMedia('(prefers-color-scheme: dark)').matches ? 'Dark' : 'Light'}</div>
          <div>${t('device-info.reducedMotion', 'Reduced motion')}</div><div>${yes(matchMedia('(prefers-reduced-motion: reduce)').matches)}</div>
          <div>${t('device-info.contrast', 'Contrast')}</div><div>${matchMedia('(prefers-contrast: more)').matches ? 'More' : 'Standard'}</div>
          <div>${t('device-info.timezone', 'Timezone')}</div><div>${Intl.DateTimeFormat().resolvedOptions().timeZone}</div>
          <div>${t('device-info.locale', 'Locale')}</div><div>${Intl.DateTimeFormat().resolvedOptions().locale}</div>
        </div>
      </jg-card>

      <jg-card title="${t('device-info.capabilities', 'Capabilities')}">
        <div class="row">
          ${[
            ['Web Crypto', Boolean(window.crypto?.subtle)],
            ['Service Worker', 'serviceWorker' in navigator],
            ['WebGL', Boolean(document.createElement('canvas').getContext('webgl'))],
            ['WebRTC', 'RTCPeerConnection' in window],
            ['Clipboard', Boolean(navigator.clipboard)],
            ['Share', Boolean(navigator.share)],
            ['Notifications', 'Notification' in window],
            ['Geolocation', 'geolocation' in navigator],
            ['IndexedDB', 'indexedDB' in window],
            ['WebAssembly', 'WebAssembly' in window],
          ].map(([name, supported]) => html`<jg-badge tone="${supported ? 'success' : 'danger'}">${name}</jg-badge>`)}
        </div>
      </jg-card>

      <jg-card title="${t('device-info.userAgent', 'User agent')}">
        <jg-output id="agent"></jg-output>
      </jg-card>
    </div>`);

    this.$('#agent').value = agent;

    const paint = () => {
      const node = this.$('#screen');
      if (!node) return;
      node.innerHTML = html`
        <div>${t('device-info.window', 'Window')}</div><div>${window.innerWidth} × ${window.innerHeight}</div>
        <div>${t('device-info.screen', 'Screen')}</div><div>${screen.width} × ${screen.height}</div>
        <div>${t('device-info.available', 'Available')}</div><div>${screen.availWidth} × ${screen.availHeight}</div>
        <div>${t('device-info.devicePixelRatio', 'Device pixel ratio')}</div><div>${window.devicePixelRatio}</div>
        <div>${t('device-info.colourDepth', 'Colour depth')}</div><div>${screen.colorDepth}-bit</div>
        <div>${t('device-info.orientation', 'Orientation')}</div><div>${screen.orientation?.type ?? 'unknown'}</div>
      `;
      const online = this.$('#online');
      if (online) online.textContent = yes(navigator.onLine);
    };

    paint();
    this.on(window, 'resize', paint);
    this.#timer = setInterval(paint, 2000);
    this.track(() => clearInterval(this.#timer));

    navigator.storage?.estimate?.().then((estimate) => {
      const node = this.$('#storage');
      if (node) node.textContent = `${formatBytes(estimate.usage ?? 0)} used of ${formatBytes(estimate.quota ?? 0)}`;
    });
  }
}

define('jg-app-device-info', DeviceInfo);
