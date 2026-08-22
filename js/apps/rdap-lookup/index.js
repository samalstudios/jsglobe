import { JGApp, define, html, styleSheet } from '../../core/app.js';
import { appText } from '../../core/i18n.js';
import strings from './i18n.js';
import { copyText, toast } from '../../core/util.js';

const t = appText(strings);

const sheet = await styleSheet(import.meta.url);

const STATUS_NOTES = {
  'client transfer prohibited': 'Transfers to another registrar are locked by the registrar.',
  'client delete prohibited': 'The domain cannot be deleted while this lock is set.',
  'client update prohibited': 'Registrar data changes are locked.',
  'client hold': 'The registrar has removed the domain from the zone, so it will not resolve.',
  'server hold': 'The registry has removed the domain from the zone.',
  'pending delete': 'The domain is in the deletion cycle and may become available.',
  'redemption period': 'The domain expired and is in the redemption grace period.',
  ok: 'No locks or pending operations.',
  active: 'The registration is active.',
};

const EVENT_LABELS = {
  registration: 'Registered',
  expiration: 'Expires',
  'last changed': 'Last changed',
  'last update of RDAP database': 'RDAP data updated',
  transfer: 'Transferred',
  deletion: 'Deleted',
  reregistration: 'Re-registered',
  locked: 'Locked',
  unlocked: 'Unlocked',
};

const looksLikeIp = (value) => /^(\d{1,3}\.){3}\d{1,3}$/.test(value) || /^[0-9a-f:]+:[0-9a-f:]*$/i.test(value);

const cleanDomain = (value) =>
  value
    .trim()
    .replace(/^[a-z]+:\/\//i, '')
    .replace(/\/.*$/, '')
    .replace(/^www\./i, '')
    .toLowerCase();

const vcardValue = (entity, field) => {
  const vcard = entity?.vcardArray?.[1] ?? [];
  const entry = vcard.find((item) => item[0] === field);
  if (!entry) return null;
  const value = entry[3];
  return Array.isArray(value) ? value.filter(Boolean).join(', ') : value;
};

const formatDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const days = Math.round((date.getTime() - Date.now()) / 86400000);
  const relative = days === 0 ? 'today' : days > 0 ? `in ${days} days` : `${Math.abs(days)} days ago`;
  return `${date.toISOString().slice(0, 10)} (${relative})`;
};

class RdapLookup extends JGApp {
  static appId = 'rdap-lookup';
  static styles = [...JGApp.styles, sheet];

  #busy = false;

  renderApp() {
    this.paint(html`<div class="app">
      <div class="row">
        <jg-input id="query" style="flex:1;min-width:200px" mono placeholder="${t('rdap-lookup.exampleCom888', 'example.com, 8.8.8.8 or AS15169')}"></jg-input>
        <jg-button id="go">${t('rdap-lookup.lookUp', 'Look up')}</jg-button>
        <jg-button size="sm" variant="ghost" id="copy">${t('rdap-lookup.copyJson', 'Copy JSON')}</jg-button>
      </div>

      <div class="history" id="history"></div>

      <div class="row">
        <jg-badge id="status" tone="muted">${t('rdap-lookup.ready', 'Ready')}</jg-badge>
        <span class="hint" id="note"></span>
      </div>

      <div class="cards" id="cards"></div>

      <jg-card title="${t('rdap-lookup.rawResponse', 'Raw response')}" sub="${t('rdap-lookup.exactlyWhatTheRegistryReturned', 'Exactly what the registry returned')}">
        <jg-code id="raw" rows="12" gutter language="json" readonly></jg-code>
      </jg-card>

      <div class="hint">
        Queries go to rdap.org, which redirects to the registry that owns the name. RDAP is the structured
        replacement for WHOIS, so contact details are often redacted by the registry itself.
      </div>
    </div>`);

    this.on(this.$('#go'), 'click', () => this.#lookup(this.$('#query').value));
    this.on(this.$('#query'), 'keydown', (event) => {
      if (event.key === 'Enter') this.#lookup(this.$('#query').value);
    });
    this.on(this.$('#copy'), 'click', () => copyText(this.$('#raw').value));

    this.#paintHistory();
    const saved = this.store.read({ last: '' });
    this.$('#query').value = saved.last || 'example.com';
  }

  #paintHistory() {
    const history = this.store.read({ history: [] }).history ?? [];
    this.$('#history').innerHTML = history.map((entry) => html`<button class="past" data-past="${entry}">${entry}</button>`).join('');
    this.bind('[data-past]', 'click', (event) => this.#lookup(event.currentTarget.dataset.past));
  }

  #remember(query) {
    const data = this.store.read({ history: [] });
    data.history = [query, ...(data.history ?? []).filter((entry) => entry !== query)].slice(0, 8);
    data.last = query;
    this.store.write(data);
    this.#paintHistory();
  }

  async #lookup(input) {
    const raw = (input ?? '').trim();
    if (!raw || this.#busy) return;

    const status = this.$('#status');
    const asn = /^as\s?(\d+)$/i.exec(raw);
    const query = asn ? `autnum/${asn[1]}` : looksLikeIp(raw) ? `ip/${raw}` : `domain/${cleanDomain(raw)}`;
    const label = asn ? `AS${asn[1]}` : looksLikeIp(raw) ? raw : cleanDomain(raw);

    this.#busy = true;
    status.setAttribute('tone', 'muted');
    status.textContent = 'Looking up';
    this.$('#note').textContent = `rdap.org/${query}`;
    this.$('#query').value = label;

    try {
      const response = await fetch(`https://rdap.org/${query}`, { headers: { accept: 'application/rdap+json' } });
      const text = await response.text();

      if (response.status === 404) {
        status.setAttribute('tone', 'warning');
        status.textContent = 'Not registered';
        this.$('#note').textContent = `No RDAP record exists for ${label}.`;
        this.$('#cards').innerHTML = '';
        this.$('#raw').value = text.slice(0, 4000);
        return;
      }

      if (!response.ok) throw new Error(`The registry answered ${response.status}`);

      const data = JSON.parse(text);
      status.setAttribute('tone', 'success');
      status.textContent = 'Found';
      this.$('#note').textContent = data.port43 ? `WHOIS mirror: ${data.port43}` : '';
      this.$('#raw').value = JSON.stringify(data, null, 2);
      this.#paint(data, label);
      this.#remember(label);
    } catch (error) {
      status.setAttribute('tone', 'danger');
      status.textContent = 'Lookup failed';
      this.$('#note').textContent = error.message;
      toast(error.message, 'error');
    } finally {
      this.#busy = false;
    }
  }

  #paint(data, label) {
    const events = (data.events ?? []).map((event) => ({
      label: EVENT_LABELS[event.eventAction] ?? event.eventAction,
      when: formatDate(event.eventDate),
    }));

    const statuses = data.status ?? [];
    const nameservers = (data.nameservers ?? []).map((server) => server.ldhName).filter(Boolean);
    const entities = data.entities ?? [];
    const registrar = entities.find((entity) => (entity.roles ?? []).includes('registrar'));

    const contacts = entities
      .filter((entity) => (entity.roles ?? []).some((role) => ['registrant', 'administrative', 'technical', 'abuse'].includes(role)))
      .map((entity) => ({
        role: (entity.roles ?? []).join(', '),
        name: vcardValue(entity, 'fn'),
        org: vcardValue(entity, 'org'),
        email: vcardValue(entity, 'email'),
        country: (vcardValue(entity, 'adr') ?? '').split(',').pop()?.trim(),
      }))
      .filter((contact) => contact.name || contact.org || contact.email);

    const overview = [
      ['Object', data.objectClassName ?? 'unknown'],
      ['Name', data.ldhName ?? data.handle ?? label],
      data.unicodeName && data.unicodeName !== data.ldhName ? ['Unicode name', data.unicodeName] : null,
      data.startAddress ? ['Range', `${data.startAddress} - ${data.endAddress}`] : null,
      data.ipVersion ? ['IP version', data.ipVersion] : null,
      data.type ? ['Allocation', data.type] : null,
      data.country ? ['Country', data.country] : null,
      data.name && data.objectClassName !== 'domain' ? ['Network name', data.name] : null,
      registrar ? ['Registrar', vcardValue(registrar, 'fn') ?? registrar.handle] : null,
      data.handle ? ['Handle', data.handle] : null,
    ].filter(Boolean);

    this.$('#cards').innerHTML = html`
      <jg-card title="${t('rdap-lookup.overview', 'Overview')}">
        <div class="kv">
          ${overview.map(([name, value]) => html`<div>${name}</div><div class="mono">${value}</div>`)}
        </div>
      </jg-card>

      ${events.length
        ? html`<jg-card title="${t('rdap-lookup.timeline', 'Timeline')}">
            <div class="events">
              ${events.map((event) => html`<div class="event"><span>${event.label}</span><span class="when">${event.when}</span></div>`)}
            </div>
          </jg-card>`
        : ''}

      ${statuses.length
        ? html`<jg-card title="${t('rdap-lookup.status', 'Status')}" sub="${t('rdap-lookup.locksAndPendingOperationsReported', 'Locks and pending operations reported by the registry')}">
            <div class="chips">${statuses.map((entry) => html`<jg-badge>${entry}</jg-badge>`)}</div>
            <div class="events" style="margin-top:8px">
              ${statuses
                .filter((entry) => STATUS_NOTES[entry.toLowerCase()])
                .map((entry) => html`<div class="event"><span class="mono">${entry}</span><span>${STATUS_NOTES[entry.toLowerCase()]}</span></div>`)}
            </div>
          </jg-card>`
        : ''}

      ${nameservers.length
        ? html`<jg-card title="${t('rdap-lookup.nameservers', 'Nameservers')}">
            <div class="servers">${nameservers.map((server) => html`<div>${server.toLowerCase()}</div>`)}</div>
          </jg-card>`
        : ''}

      ${contacts.length
        ? html`<jg-card title="${t('rdap-lookup.contacts', 'Contacts')}" sub="${t('rdap-lookup.registriesRedactMostPersonalDetails', 'Registries redact most personal details')}">
            <div class="kv">
              ${contacts.flatMap((contact) => [
                html`<div>${contact.role}</div>`,
                html`<div>${[contact.name, contact.org, contact.email, contact.country].filter(Boolean).join(' - ')}</div>`,
              ])}
            </div>
          </jg-card>`
        : ''}
    `;
  }
}

define('jg-app-rdap-lookup', RdapLookup);
