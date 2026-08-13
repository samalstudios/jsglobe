import { JGApp, define, html, css } from '../core/app.js';
import { copyText, uid } from '../core/util.js';

const sheet = css`
  .preview {
    flex: none;
    height: 220px;
    border-radius: var(--radius-lg);
    border: 1px solid var(--border);
    background-image: var(--gradient);
  }
  .track {
    position: relative;
    flex: none;
    height: 34px;
    margin: 14px 6px 10px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background-image: var(--strip);
    cursor: copy;
  }
  .stop {
    position: absolute;
    top: -6px;
    width: 18px;
    height: 46px;
    margin-left: -9px;
    border-radius: 6px;
    border: 2px solid var(--background);
    box-shadow: 0 0 0 1px var(--border-strong), var(--shadow-sm);
    cursor: grab;
  }
  .stop[data-active="true"] { box-shadow: 0 0 0 2px var(--ring), var(--shadow-md); z-index: 2; }
  .fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; }
  .stops { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px 4px 4px;
    border: 1px solid var(--border);
    border-radius: 999px;
    font-family: var(--font-mono);
    font-size: 11px;
  }
  .chip input[type="color"] { width: 22px; height: 22px; border: 0; border-radius: 999px; padding: 0; background: none; }
  .presets { display: grid; grid-template-columns: repeat(auto-fill, minmax(84px, 1fr)); gap: 8px; }
  .preset { height: 44px; border-radius: var(--radius-sm); border: 1px solid var(--border); cursor: pointer; padding: 0; }
`;

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
        <jg-field label="Type">
          <jg-select id="type" value="linear">
            <option value="linear">Linear</option>
            <option value="radial">Radial</option>
            <option value="conic">Conic</option>
            <option value="repeating-linear">Repeating linear</option>
          </jg-select>
        </jg-field>
        <jg-field label="Angle" id="anglefield"><jg-slider id="angle" min="0" max="360" value="135"></jg-slider></jg-field>
        <jg-field label="Shape" id="shapefield" hidden>
          <jg-select id="shape" value="circle"><option value="circle">Circle</option><option value="ellipse">Ellipse</option></jg-select>
        </jg-field>
        <jg-field label="Position" id="atfield" hidden>
          <jg-select id="at" value="center">
            <option value="center">Center</option><option value="top left">Top left</option>
            <option value="top right">Top right</option><option value="bottom left">Bottom left</option>
            <option value="bottom right">Bottom right</option>
          </jg-select>
        </jg-field>
        <jg-field label="Add stop"><jg-button size="sm" variant="outline" id="add">Add colour</jg-button></jg-field>
      </div>

      <jg-field label="CSS">
        <jg-output id="out"></jg-output>
      </jg-field>

      <div class="row">
        <jg-button size="sm" variant="outline" id="copy-css">Copy CSS</jg-button>
        <jg-button size="sm" variant="outline" id="copy-tw">Copy Tailwind</jg-button>
        <jg-button size="sm" variant="ghost" id="random">Randomise</jg-button>
        <jg-button size="sm" variant="ghost" id="reverse">Reverse</jg-button>
      </div>

      <jg-card title="Presets">
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
