import { JGApp, define, html, styleSheet } from '../../core/app.js';
import { appWords } from '../../core/i18n.js';

const t = await appWords('gamepad-tester', (lang) => import(`./i18n/${lang}.js`));

const sheet = await styleSheet(import.meta.url);

class GamepadTester extends JGApp {
  static appId = 'gamepad-tester';
  static settings = [
    { key: 'deadzone', label: t('gamepad-tester.stickDeadZone', 'Stick dead zone'), type: 'number', default: 8, min: 0, max: 40 },
  ];
  static styles = [...JGApp.styles, sheet];

  #frame = null;
  #index = null;
  #known = new Map();

  renderWidget() {
    this.paint(html`<div class="app" style="padding:12px">
      <div class="stack tight">
        <div class="label">${t('gamepad-tester.gamepad', 'Gamepad')}</div>
        <div class="hint" id="count">${t('gamepad-tester.pressAButtonOnA', 'Press a button on a controller')}</div>
      </div>
    </div>`);
    const tick = () => {
      const pads = [...(navigator.getGamepads?.() ?? [])].filter(Boolean);
      const label = this.$('#count');
      if (label) label.textContent = pads.length ? `${pads.length} connected` : 'Press a button on a controller';
      this.#frame = requestAnimationFrame(tick);
    };
    this.#frame = requestAnimationFrame(tick);
    this.track(() => cancelAnimationFrame(this.#frame));
  }

  renderApp() {
    this.paint(html`<div class="app">
      <div class="row">
        <jg-select id="pick" size="sm" style="width:260px"></jg-select>
        <span class="grow"></span>
        <jg-button size="sm" variant="outline" id="rumble">${t('gamepad-tester.testRumble', 'Test rumble')}</jg-button>
      </div>
      <div class="empty" id="empty">
        <div class="title">${t('gamepad-tester.noControllerYet', 'No controller yet')}</div>
        <div class="hint">${t('gamepad-tester.plugInAGamepadAnd', 'Plug in a gamepad and press any button. Browsers only reveal a pad after it sends input.')}</div>
      </div>
      <div class="pad" id="pad" hidden>
        <div class="ident">
          <span class="name" id="name"></span>
          <span class="meta" id="meta"></span>
        </div>
        <div class="sticks" id="sticks"></div>
        <div class="stack tight">
          <div class="label">${t('gamepad-tester.buttons', 'Buttons')}</div>
          <div class="buttons" id="buttons"></div>
        </div>
        <div class="stack tight">
          <div class="label">${t('gamepad-tester.axes', 'Axes')}</div>
          <div class="axes" id="axes"></div>
        </div>
      </div>
    </div>`);

    this.on(this.$('#pick'), 'change', (event) => {
      this.#index = Number(event.detail.value);
    });
    this.on(this.$('#rumble'), 'click', () => this.#rumble());

    this.listen(window, 'gamepadconnected', () => this.#sync());
    this.listen(window, 'gamepaddisconnected', () => this.#sync());

    const tick = () => {
      this.#paint();
      this.#frame = requestAnimationFrame(tick);
    };
    this.#frame = requestAnimationFrame(tick);
    this.track(() => cancelAnimationFrame(this.#frame));
  }

  #pads() {
    return [...(navigator.getGamepads?.() ?? [])].filter(Boolean);
  }

  #sync() {
    const pads = this.#pads();
    const pick = this.$('#pick');
    if (!pick) return;
    const signature = pads.map((pad) => `${pad.index}:${pad.id}`).join('|');
    if (this.#known.get('signature') === signature) return;
    this.#known.set('signature', signature);

    pick.innerHTML = pads.length
      ? pads.map((pad) => `<option value="${pad.index}">${pad.index}: ${pad.id.slice(0, 48)}</option>`).join('')
      : '<option value="">No controller detected</option>';
    if (this.#index === null || !pads.some((pad) => pad.index === this.#index)) {
      this.#index = pads[0]?.index ?? null;
    }
    if (this.#index !== null) pick.value = String(this.#index);
  }

  #rumble() {
    const pad = this.#pads().find((entry) => entry.index === this.#index);
    const actuator = pad?.vibrationActuator;
    actuator?.playEffect?.('dual-rumble', { duration: 400, strongMagnitude: 0.7, weakMagnitude: 0.4 });
  }

  #paint() {
    this.#sync();
    const pads = this.#pads();
    const pad = pads.find((entry) => entry.index === this.#index);
    this.$('#empty').hidden = Boolean(pad);
    this.$('#pad').hidden = !pad;
    if (!pad) return;

    const dead = Math.max(0, Number(this.config.get('deadzone', 8))) / 100;
    const live = (value) => (Math.abs(value) < dead ? 0 : value);

    this.$('#name').textContent = pad.id;
    this.$('#meta').textContent = `index ${pad.index} · ${pad.mapping || 'unmapped'} · ${pad.buttons.length} buttons · ${pad.axes.length} axes`;

    const sticks = this.$('#sticks');
    const pairs = Math.floor(pad.axes.length / 2);
    if (sticks.children.length !== pairs) {
      sticks.innerHTML = Array.from(
        { length: pairs },
        (item, index) =>
          `<div><div class="stick" data-stick="${index}"><span class="dot"></span></div><div class="stick-label" data-label="${index}"></div></div>`,
      ).join('');
    }
    for (let index = 0; index < pairs; index += 1) {
      const x = live(pad.axes[index * 2] ?? 0);
      const y = live(pad.axes[index * 2 + 1] ?? 0);
      const dot = sticks.querySelector(`[data-stick="${index}"] .dot`);
      if (dot) dot.style.transform = `translate(${(x * 56 + 66).toFixed(1)}px, ${(y * 56 + 66).toFixed(1)}px)`;
      const label = sticks.querySelector(`[data-label="${index}"]`);
      if (label) label.textContent = `${x.toFixed(2)}, ${y.toFixed(2)}`;
      const ring = sticks.querySelector(`[data-stick="${index}"]`);
      if (ring) ring.dataset.pressed = String(Math.hypot(x, y) > 0.92);
    }

    const buttons = this.$('#buttons');
    if (buttons.children.length !== pad.buttons.length) {
      buttons.innerHTML = pad.buttons
        .map((button, index) => `<div class="btn" data-button="${index}"><b>${index}</b><span data-value>0.00</span><span class="bar"><i></i></span></div>`)
        .join('');
    }
    pad.buttons.forEach((button, index) => {
      const node = buttons.querySelector(`[data-button="${index}"]`);
      if (!node) return;
      node.dataset.on = String(button.pressed);
      node.querySelector('[data-value]').textContent = button.value.toFixed(2);
      node.querySelector('.bar i').style.width = `${Math.round(button.value * 100)}%`;
    });

    const axes = this.$('#axes');
    if (axes.children.length !== pad.axes.length) {
      axes.innerHTML = pad.axes
        .map((axis, index) => `<div class="axis"><span>axis ${index}</span><span class="track"><i data-axis="${index}"></i></span><span data-axis-value="${index}">0.00</span></div>`)
        .join('');
    }
    pad.axes.forEach((axis, index) => {
      const value = live(axis);
      const bar = axes.querySelector(`[data-axis="${index}"]`);
      if (bar) bar.style.left = `calc(${((value + 1) / 2) * 100}% - 1.5px)`;
      const label = axes.querySelector(`[data-axis-value="${index}"]`);
      if (label) label.textContent = value.toFixed(3);
    });
  }
}

define('jg-app-gamepad-tester', GamepadTester);
