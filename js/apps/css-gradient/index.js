import { JGApp, define, html, styleSheet } from '../../core/app.js';
import { appText } from '../../core/i18n.js';
import strings from './i18n.js';
import { copyText, uid } from '../../core/util.js';

const t = appText(strings);

const sheet = await styleSheet(import.meta.url);

const PRESETS = [
  ['#8a1c3b', '#f97316'],
  ['#0ea5e9', '#4a7a58'],
  ['#6a5a8c', '#ec4899'],
  ['#111827', '#4a5568'],
  ['#f59e0b', '#ef4444'],
  ['#14b8a6', '#0ea5e9'],
  ['#fde68a', '#f472b6'],
  ['#1e293b', '#8a1c3b'],
];

class CssGradient extends JGApp {
  static appId = 'css-gradient';
  static styles = [...JGApp.styles, sheet];

  #stops = [
    { id: uid().slice(0, 6), colour: '#8a1c3b', position: 0 },
    { id: uid().slice(0, 6), colour: '#f97316', position: 100 },
  ];
  #active = null;
  #type = 'linear';
  #angle = 135;
  #shape = 'circle';
  #at = 'center';

  renderApp() {
    this.paint(html`<div class="app">
      <div class="preview" id="preview"></div>
      <div class="track" id="track"></div>

      <div class="stops" id="stops"></div>

      <div class="fields">
        <jg-field label="${t('css-gradient.type', 'Type')}">
          <jg-select id="type" value="linear">
            <option value="linear">${t('css-gradient.linear', 'Linear')}</option>
            <option value="radial">${t('css-gradient.radial', 'Radial')}</option>
            <option value="conic">${t('css-gradient.conic', 'Conic')}</option>
            <option value="repeating-linear">${t('css-gradient.repeatingLinear', 'Repeating linear')}</option>
          </jg-select>
        </jg-field>
        <jg-field label="${t('css-gradient.angle', 'Angle')}" id="anglefield"><jg-slider id="angle" min="0" max="360" value="135"></jg-slider></jg-field>
        <jg-field label="${t('css-gradient.shape', 'Shape')}" id="shapefield" hidden>
          <jg-select id="shape" value="circle"><option value="circle">${t('css-gradient.circle', 'Circle')}</option><option value="ellipse">${t('css-gradient.ellipse', 'Ellipse')}</option></jg-select>
        </jg-field>
        <jg-field label="${t('css-gradient.position', 'Position')}" id="atfield" hidden>
          <jg-select id="at" value="center">
            <option value="center">${t('css-gradient.center', 'Center')}</option><option value="top left">${t('css-gradient.topLeft', 'Top left')}</option>
            <option value="top right">${t('css-gradient.topRight', 'Top right')}</option><option value="bottom left">${t('css-gradient.bottomLeft', 'Bottom left')}</option>
            <option value="bottom right">${t('css-gradient.bottomRight', 'Bottom right')}</option>
          </jg-select>
        </jg-field>
        <jg-field label="${t('css-gradient.addStop', 'Add stop')}"><jg-button size="sm" variant="outline" id="add">${t('css-gradient.addColour', 'Add colour')}</jg-button></jg-field>
      </div>

      <jg-field label="CSS">
        <jg-output id="out"></jg-output>
      </jg-field>

      <div class="row">
        <jg-button size="sm" variant="outline" id="copy-css">${t('css-gradient.copyCss', 'Copy CSS')}</jg-button>
        <jg-button size="sm" variant="outline" id="copy-tw">${t('css-gradient.copyTailwind', 'Copy Tailwind')}</jg-button>
        <jg-button size="sm" variant="ghost" id="random">${t('css-gradient.randomise', 'Randomise')}</jg-button>
        <jg-button size="sm" variant="ghost" id="reverse">${t('css-gradient.reverse', 'Reverse')}</jg-button>
      </div>

      <jg-card title="${t('css-gradient.presets', 'Presets')}">
        <div class="presets" id="presets">
          ${PRESETS.map(
            (pair, index) => html`<button class="preset" data-preset="${index}" style="background-image:linear-gradient(135deg, ${pair[0]}, ${pair[1]})"></button>`,
          )}
        </div>
      </jg-card>
    </div>`);

    this.on(this.$('#type'), 'change', (event) => {
      this.#type = event.detail.value;
      this.#paint();
    });
    this.on(this.$('#angle'), 'input', () => {
      this.#angle = Number(this.$('#angle').value);
      this.#paint();
    });
    this.on(this.$('#shape'), 'change', (event) => {
      this.#shape = event.detail.value;
      this.#paint();
    });
    this.on(this.$('#at'), 'change', (event) => {
      this.#at = event.detail.value;
      this.#paint();
    });

    this.on(this.$('#add'), 'click', () => {
      this.#stops = [...this.#stops, { id: uid().slice(0, 6), colour: '#ffffff', position: 50 }].sort((a, b) => a.position - b.position);
      this.#paint();
    });
    this.on(this.$('#copy-css'), 'click', () => copyText(`background-image: ${this.#value()};`));
    this.on(this.$('#copy-tw'), 'click', () => copyText(`bg-[${this.#value().replace(/\s+/g, '_')}]`));
    this.on(this.$('#random'), 'click', () => {
      this.#stops = this.#stops.map((stop) => ({
        ...stop,
        colour: `#${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')}`,
      }));
      this.#paint();
    });
    this.on(this.$('#reverse'), 'click', () => {
      this.#stops = this.#stops.map((stop) => ({ ...stop, position: 100 - stop.position })).sort((a, b) => a.position - b.position);
      this.#paint();
    });

    this.bind('[data-preset]', 'click', (event) => {
      const [from, to] = PRESETS[Number(event.currentTarget.dataset.preset)];
      this.#stops = [
        { id: uid().slice(0, 6), colour: from, position: 0 },
        { id: uid().slice(0, 6), colour: to, position: 100 },
      ];
      this.#paint();
    });

    this.on(this.$('#track'), 'click', (event) => {
      if (event.target !== this.$('#track')) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const position = Math.round(((event.clientX - rect.left) / rect.width) * 100);
      this.#stops = [...this.#stops, { id: uid().slice(0, 6), colour: '#ffffff', position }].sort((a, b) => a.position - b.position);
      this.#paint();
    });

    this.#paint();
  }

  #value() {
    const stops = [...this.#stops]
      .sort((a, b) => a.position - b.position)
      .map((stop) => `${stop.colour} ${stop.position}%`)
      .join(', ');

    if (this.#type === 'radial') return `radial-gradient(${this.#shape} at ${this.#at}, ${stops})`;
    if (this.#type === 'conic') return `conic-gradient(from ${this.#angle}deg at ${this.#at}, ${stops})`;
    if (this.#type === 'repeating-linear') return `repeating-linear-gradient(${this.#angle}deg, ${stops})`;
    return `linear-gradient(${this.#angle}deg, ${stops})`;
  }

  #paint() {
    const value = this.#value();
    const strip = `linear-gradient(90deg, ${[...this.#stops].sort((a, b) => a.position - b.position).map((stop) => `${stop.colour} ${stop.position}%`).join(', ')})`;

    this.$('#preview').style.setProperty('--gradient', value);
    this.$('#track').style.setProperty('--strip', strip);
    this.$('#out').value = `background-image: ${value};`;

    this.$('#anglefield').hidden = this.#type === 'radial';
    this.$('#shapefield').hidden = this.#type !== 'radial';
    this.$('#atfield').hidden = this.#type === 'linear' || this.#type === 'repeating-linear';

    const track = this.$('#track');
    track.querySelectorAll('.stop').forEach((node) => node.remove());
    this.#stops.forEach((stop) => {
      const handle = document.createElement('span');
      handle.className = 'stop';
      handle.dataset.id = stop.id;
      handle.dataset.active = String(this.#active === stop.id);
      handle.style.left = `${stop.position}%`;
      handle.style.background = stop.colour;
      track.append(handle);
      this.on(handle, 'pointerdown', (event) => this.#drag(event, stop.id));
    });

    this.$('#stops').innerHTML = this.#stops
      .map(
        (stop) => html`<span class="chip">
          <input type="color" value="${stop.colour}" data-colour="${stop.id}" />
          <span>${stop.position}%</span>
          ${this.#stops.length > 2 ? html`<jg-button size="icon-sm" variant="ghost" data-remove="${stop.id}">✕</jg-button>` : ''}
        </span>`,
      )
      .join('');

    this.bind('[data-colour]', 'input', (event) => {
      const stop = this.#stops.find((item) => item.id === event.currentTarget.dataset.colour);
      stop.colour = event.currentTarget.value;
      this.#paint();
    });
    this.bind('[data-remove]', 'click', (event) => {
      this.#stops = this.#stops.filter((item) => item.id !== event.currentTarget.dataset.remove);
      this.#paint();
    });
  }

  #drag(event, id) {
    event.preventDefault();
    this.#active = id;
    const track = this.$('#track');
    const rect = track.getBoundingClientRect();

    const move = (moveEvent) => {
      const position = Math.round(Math.min(100, Math.max(0, ((moveEvent.clientX - rect.left) / rect.width) * 100)));
      const stop = this.#stops.find((item) => item.id === id);
      if (stop) stop.position = position;
      this.#paint();
    };
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
    this.#paint();
  }
}

define('jg-app-css-gradient', CssGradient);
