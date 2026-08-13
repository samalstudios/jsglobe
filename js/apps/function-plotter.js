import { JGApp, define, html, css } from '../core/app.js';
import { evaluate } from '../core/expression.js';
import { debounce, download } from '../core/util.js';

const sheet = css`
  .board {
    position: relative;
    flex: 1;
    min-height: 260px;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    overflow: hidden;
    background: color-mix(in srgb, var(--muted) 35%, transparent);
    touch-action: none;
    cursor: crosshair;
  }
  canvas { display: block; width: 100%; height: 100%; }
  .readout {
    position: absolute;
    top: 8px;
    right: 10px;
    padding: 5px 9px;
    border-radius: var(--radius-sm);
    background: var(--glass-strong);
    border: 1px solid var(--glass-border);
    font-family: var(--font-mono);
    font-size: 11.5px;
    pointer-events: none;
  }
  .curves { display: grid; gap: 6px; }
  .surface { display: grid; gap: 8px; }
  .surface[hidden] { display: none; }
  .curve { display: grid; grid-template-columns: auto 1fr auto auto; gap: 7px; align-items: center; }
  .swatch { width: 14px; height: 14px; border-radius: 4px; border: 1px solid var(--border); }
  .roots { display: flex; flex-wrap: wrap; gap: 6px; }
`;

const COLOURS = ['#8a1c3b', '#3f6b91', '#4a7a58', '#96703f', '#6a5a8c', '#3f7a75'];
const uid = () => Math.random().toString(36).slice(2, 8);

class FunctionPlotter extends JGApp {
  static appId = 'function-plotter';
  static styles = [...JGApp.styles, sheet];

  #curves = [];
  #view = { x: -10, y: -6, width: 20, height: 12 };
  #pointer = null;
  #drag = null;
  #mode = '2d';
  #camera = { yaw: -0.7, pitch: 0.9, zoom: 1 };
  #surface = { expression: 'sin(x) * cos(y)', span: 6, resolution: 28 };

  renderApp() {
    const saved = this.store.read({ curves: null, view: null });
    this.#curves = (saved.curves ?? [{ expression: 'sin(x)', visible: true }, { expression: 'x^2 / 4 - 2', visible: true }]).map(
      (curve, index) => ({ id: uid(), colour: COLOURS[index % COLOURS.length], ...curve }),
    );
    if (saved.view) this.#view = saved.view;

    this.#mode = saved.mode ?? '2d';
    if (saved.surface) this.#surface = { ...this.#surface, ...saved.surface };

    this.paint(html`<div class="app">
      <div class="row">
        <jg-segment id="mode"></jg-segment>
        <jg-button size="sm" variant="outline" id="add">Add function</jg-button>
        <jg-button size="sm" variant="ghost" id="reset">Reset view</jg-button>
        <jg-button size="sm" variant="ghost" id="fit">Fit y axis</jg-button>
        <span class="grow"></span>
        <span class="row tight" id="derivative-field"><jg-switch id="derivative"></jg-switch><span class="hint">Show derivative</span></span>
        <jg-button size="sm" variant="ghost" id="save">Save PNG</jg-button>
      </div>

      <div class="curves" id="curves"></div>

      <div class="surface" id="surface" hidden>
        <jg-field label="z = f(x, y)"><jg-input id="expression" mono value="${this.#surface.expression}"></jg-input></jg-field>
        <div class="row">
          <span class="hint">Range</span>
          <jg-slider id="span" min="2" max="20" value="${this.#surface.span}" style="max-width:150px"></jg-slider>
          <span class="hint">Detail</span>
          <jg-slider id="resolution" min="10" max="60" value="${this.#surface.resolution}" style="max-width:150px"></jg-slider>
          <span class="grow"></span>
          <span class="hint">Drag to rotate, scroll to zoom</span>
        </div>
      </div>

      <div class="board" id="board">
        <canvas id="canvas"></canvas>
        <div class="readout" id="readout"></div>
      </div>

      <jg-card title="Roots and extrema" sub="Found by scanning the visible range" id="roots-card">
        <div class="roots" id="roots"></div>
      </jg-card>
    </div>`);

    const modes = this.$('#mode');
    modes.items = [
      { value: '2d', label: '2D curve' },
      { value: '3d', label: '3D surface' },
    ];
    modes.value = this.#mode;
    this.on(modes, 'change', (event) => {
      this.#mode = event.detail.value;
      this.#applyMode();
      this.#draw();
    });

    this.on(this.$('#expression'), 'input', debounce(() => {
      this.#surface.expression = this.$('#expression').value;
      this.#draw();
    }, 200));
    this.on(this.$('#span'), 'input', () => {
      this.#surface.span = Number(this.$('#span').value);
      this.#draw();
    });
    this.on(this.$('#resolution'), 'input', () => {
      this.#surface.resolution = Number(this.$('#resolution').value);
      this.#draw();
    });

    this.on(this.$('#add'), 'click', () => {
      this.#curves = [...this.#curves, { id: uid(), expression: 'x', visible: true, colour: COLOURS[this.#curves.length % COLOURS.length] }];
      this.#paintCurves();
      this.#draw();
    });
    this.on(this.$('#reset'), 'click', () => {
      this.#view = { x: -10, y: -6, width: 20, height: 12 };
      this.#draw();
    });
    this.on(this.$('#fit'), 'click', () => this.#fit());
    this.on(this.$('#derivative'), 'change', () => this.#draw());
    this.on(this.$('#save'), 'click', () => {
      this.$('#canvas').toBlob((blob) => download('plot.png', blob, 'image/png'), 'image/png');
    });

    const board = this.$('#board');
    this.on(board, 'pointermove', (event) => this.#move(event));
    this.on(board, 'pointerleave', () => {
      this.#pointer = null;
      this.$('#readout').textContent = '';
      this.#draw();
    });
    this.on(board, 'pointerdown', (event) => {
      board.setPointerCapture(event.pointerId);
      this.#drag = { x: event.clientX, y: event.clientY, view: { ...this.#view }, yaw: this.#camera.yaw, pitch: this.#camera.pitch };
    });
    this.on(board, 'pointerup', () => {
      this.#drag = null;
    });
    this.on(board, 'wheel', (event) => {
      event.preventDefault();
      if (this.#mode === '3d') {
        this.#camera.zoom = Math.min(3, Math.max(0.35, this.#camera.zoom * (event.deltaY > 0 ? 0.92 : 1.08)));
        this.#draw();
        return;
      }
      this.#zoom(event.deltaY > 0 ? 1.12 : 1 / 1.12, event);
    }, { passive: false });

    this.listen(window, 'resize', debounce(() => this.#draw(), 120));

    this.#paintCurves();
    this.#applyMode();
    queueMicrotask(() => this.#draw());
  }

  #applyMode() {
    const surface = this.#mode === '3d';
    this.$('#surface').hidden = !surface;
    this.$('#curves').hidden = surface;
    this.$('#roots-card').hidden = surface;
    ['#add', '#fit', '#derivative-field'].forEach((selector) => {
      this.$(selector).hidden = surface;
    });
    this.$('#readout').textContent = '';
  }

  #paintCurves() {
    this.$('#curves').innerHTML = this.#curves
      .map(
        (curve) => html`<div class="curve">
          <span class="swatch" style="background:${curve.colour}"></span>
          <jg-input size="sm" mono value="${curve.expression}" data-expression="${curve.id}" placeholder="sin(x)"></jg-input>
          <jg-switch ${curve.visible ? 'checked' : ''} data-visible="${curve.id}"></jg-switch>
          <jg-button size="icon-sm" variant="ghost" data-drop="${curve.id}">✕</jg-button>
        </div>`,
      )
      .join('');

    const run = debounce(() => this.#draw(), 180);
    this.bind('[data-expression]', 'input', (event) => {
      const curve = this.#find(event.currentTarget.dataset.expression);
      if (curve) curve.expression = event.currentTarget.value;
      run();
    });
    this.bind('[data-visible]', 'change', (event) => {
      const curve = this.#find(event.currentTarget.dataset.visible);
      if (curve) curve.visible = event.detail.checked;
      this.#draw();
    });
    this.bind('[data-drop]', 'click', (event) => {
      this.#curves = this.#curves.filter((curve) => curve.id !== event.currentTarget.dataset.drop);
      this.#paintCurves();
      this.#draw();
    });
  }

  #find(id) {
    return this.#curves.find((curve) => curve.id === id) ?? null;
  }

  #sample(expression, x) {
    try {
      const value = evaluate(expression, { x });
      return Number.isFinite(value) ? value : null;
    } catch {
      return null;
    }
  }

  #move(event) {
    const board = this.$('#board');
    const rect = board.getBoundingClientRect();

    if (this.#mode === '3d') {
      if (!this.#drag) return;
      this.#camera.yaw = this.#drag.yaw + (event.clientX - this.#drag.x) / 160;
      this.#camera.pitch = Math.min(1.5, Math.max(-0.2, this.#drag.pitch - (event.clientY - this.#drag.y) / 200));
      this.#draw();
      return;
    }

    if (this.#drag) {
      const dx = ((event.clientX - this.#drag.x) / rect.width) * this.#drag.view.width;
      const dy = ((event.clientY - this.#drag.y) / rect.height) * this.#drag.view.height;
      this.#view = { ...this.#drag.view, x: this.#drag.view.x - dx, y: this.#drag.view.y + dy };
      this.#draw();
      return;
    }

    this.#pointer = {
      x: this.#view.x + ((event.clientX - rect.left) / rect.width) * this.#view.width,
      y: this.#view.y + (1 - (event.clientY - rect.top) / rect.height) * this.#view.height,
    };
    this.#draw();
  }

  #zoom(factor, event) {
    const rect = this.$('#board').getBoundingClientRect();
    const focusX = this.#view.x + ((event.clientX - rect.left) / rect.width) * this.#view.width;
    const focusY = this.#view.y + (1 - (event.clientY - rect.top) / rect.height) * this.#view.height;

    const width = Math.min(1e6, Math.max(1e-4, this.#view.width * factor));
    const height = Math.min(1e6, Math.max(1e-4, this.#view.height * factor));

    this.#view = {
      width,
      height,
      x: focusX - ((focusX - this.#view.x) / this.#view.width) * width,
      y: focusY - ((focusY - this.#view.y) / this.#view.height) * height,
    };
    this.#draw();
  }

  #fit() {
    const values = [];
    for (let step = 0; step <= 400; step += 1) {
      const x = this.#view.x + (step / 400) * this.#view.width;
      this.#curves.filter((curve) => curve.visible).forEach((curve) => {
        const value = this.#sample(curve.expression, x);
        if (value !== null && Math.abs(value) < 1e6) values.push(value);
      });
    }
    if (!values.length) return;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = Math.max((max - min) * 0.12, 0.5);
    this.#view = { ...this.#view, y: min - pad, height: max - min + pad * 2 };
    this.#draw();
  }

  #niceStep(range) {
    const raw = range / 10;
    const power = 10 ** Math.floor(Math.log10(raw));
    const factor = raw / power;
    const step = factor >= 5 ? 5 : factor >= 2 ? 2 : 1;
    return step * power;
  }

  #draw() {
    const canvas = this.$('#canvas');
    const board = this.$('#board');
    if (!canvas || !board.clientWidth) return;

    const ratio = window.devicePixelRatio || 1;
    const width = board.clientWidth;
    const height = board.clientHeight;
    canvas.width = width * ratio;
    canvas.height = height * ratio;

    const context = canvas.getContext('2d');
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);

    if (this.#mode === '3d') {
      this.#drawSurface(context, width, height);
      this.store.write({
        curves: this.#curves.map(({ expression, visible }) => ({ expression, visible })),
        view: this.#view,
        mode: this.#mode,
        surface: this.#surface,
      });
      return;
    }

    const styles = getComputedStyle(this);
    const gridColour = styles.getPropertyValue('--border').trim() || '#8883';
    const axisColour = styles.getPropertyValue('--muted-foreground').trim() || '#888';
    const textColour = styles.getPropertyValue('--muted-foreground').trim() || '#888';

    const toX = (x) => ((x - this.#view.x) / this.#view.width) * width;
    const toY = (y) => height - ((y - this.#view.y) / this.#view.height) * height;

    const stepX = this.#niceStep(this.#view.width);
    const stepY = this.#niceStep(this.#view.height);

    context.lineWidth = 1;
    context.strokeStyle = gridColour;
    context.fillStyle = textColour;
    context.font = '10px ui-monospace, monospace';

    for (let x = Math.ceil(this.#view.x / stepX) * stepX; x < this.#view.x + this.#view.width; x += stepX) {
      const px = Math.round(toX(x)) + 0.5;
      context.beginPath();
      context.moveTo(px, 0);
      context.lineTo(px, height);
      context.stroke();
      context.fillText(Number(x.toPrecision(6)).toString(), px + 3, height - 4);
    }

    for (let y = Math.ceil(this.#view.y / stepY) * stepY; y < this.#view.y + this.#view.height; y += stepY) {
      const py = Math.round(toY(y)) + 0.5;
      context.beginPath();
      context.moveTo(0, py);
      context.lineTo(width, py);
      context.stroke();
      context.fillText(Number(y.toPrecision(6)).toString(), 4, py - 3);
    }

    context.strokeStyle = axisColour;
    context.lineWidth = 1.4;
    context.beginPath();
    context.moveTo(0, Math.round(toY(0)) + 0.5);
    context.lineTo(width, Math.round(toY(0)) + 0.5);
    context.moveTo(Math.round(toX(0)) + 0.5, 0);
    context.lineTo(Math.round(toX(0)) + 0.5, height);
    context.stroke();

    const derivative = this.$('#derivative').checked;
    const roots = [];

    this.#curves
      .filter((curve) => curve.visible && curve.expression.trim())
      .forEach((curve) => {
        const points = [];
        for (let pixel = 0; pixel <= width; pixel += 1) {
          const x = this.#view.x + (pixel / width) * this.#view.width;
          points.push([x, this.#sample(curve.expression, x)]);
        }

        context.strokeStyle = curve.colour;
        context.lineWidth = 2;
        context.beginPath();
        let drawing = false;
        points.forEach(([x, y]) => {
          if (y === null || Math.abs(y) > 1e7) {
            drawing = false;
            return;
          }
          const px = toX(x);
          const py = toY(y);
          if (!drawing) {
            context.moveTo(px, py);
            drawing = true;
          } else {
            context.lineTo(px, py);
          }
        });
        context.stroke();

        if (derivative) {
          context.strokeStyle = curve.colour;
          context.globalAlpha = 0.45;
          context.setLineDash([5, 4]);
          context.beginPath();
          let started = false;
          for (let index = 1; index < points.length - 1; index += 1) {
            const [x] = points[index];
            const step = this.#view.width / width;
            const left = this.#sample(curve.expression, x - step);
            const right = this.#sample(curve.expression, x + step);
            if (left === null || right === null) {
              started = false;
              continue;
            }
            const slope = (right - left) / (2 * step);
            if (!Number.isFinite(slope) || Math.abs(slope) > 1e7) {
              started = false;
              continue;
            }
            const px = toX(x);
            const py = toY(slope);
            if (!started) {
              context.moveTo(px, py);
              started = true;
            } else {
              context.lineTo(px, py);
            }
          }
          context.stroke();
          context.setLineDash([]);
          context.globalAlpha = 1;
        }

        for (let index = 1; index < points.length; index += 1) {
          const [x0, y0] = points[index - 1];
          const [x1, y1] = points[index];
          if (y0 === null || y1 === null) continue;
          if (y0 === 0 || (y0 < 0) !== (y1 < 0)) {
            if (Math.abs(y1 - y0) > this.#view.height) continue;
            const x = y1 === y0 ? x0 : x0 - y0 * ((x1 - x0) / (y1 - y0));
            const seen = roots.some((root) => root.expression === curve.expression && Math.abs(root.x - x) < this.#view.width / 200);
            if (seen) continue;
            roots.push({ expression: curve.expression, colour: curve.colour, x });
            context.fillStyle = curve.colour;
            context.beginPath();
            context.arc(toX(x), toY(0), 3.5, 0, Math.PI * 2);
            context.fill();
          }
        }
      });

    if (this.#pointer) {
      context.strokeStyle = gridColour;
      context.setLineDash([3, 3]);
      context.beginPath();
      context.moveTo(toX(this.#pointer.x), 0);
      context.lineTo(toX(this.#pointer.x), height);
      context.stroke();
      context.setLineDash([]);

      const readings = this.#curves
        .filter((curve) => curve.visible && curve.expression.trim())
        .map((curve) => {
          const value = this.#sample(curve.expression, this.#pointer.x);
          if (value === null) return null;
          context.fillStyle = curve.colour;
          context.beginPath();
          context.arc(toX(this.#pointer.x), toY(value), 4, 0, Math.PI * 2);
          context.fill();
          return `${curve.expression} = ${Number(value.toPrecision(6))}`;
        })
        .filter(Boolean);

      this.$('#readout').innerHTML = html`<div>x = ${Number(this.#pointer.x.toPrecision(6))}</div>
        ${readings.map((reading) => html`<div>${reading}</div>`)}`;
    }

    this.$('#roots').innerHTML = roots.length
      ? roots
          .slice(0, 14)
          .map((root) => html`<jg-badge mono>${root.expression} = 0 at x = ${Number(root.x.toPrecision(6))}</jg-badge>`)
          .join('')
      : html`<span class="hint">No sign changes in the visible range.</span>`;

    this.store.write({
      curves: this.#curves.map(({ expression, visible }) => ({ expression, visible })),
      view: this.#view,
      mode: this.#mode,
      surface: this.#surface,
    });
  }

  #surfaceValue(x, y) {
    try {
      const value = evaluate(this.#surface.expression, { x, y });
      return Number.isFinite(value) ? value : null;
    } catch {
      return null;
    }
  }

  #drawSurface(context, width, height) {
    const steps = Math.round(this.#surface.resolution);
    const span = this.#surface.span;
    const step = (span * 2) / steps;

    const points = [];
    let low = Infinity;
    let high = -Infinity;

    for (let row = 0; row <= steps; row += 1) {
      points[row] = [];
      for (let column = 0; column <= steps; column += 1) {
        const x = -span + column * step;
        const y = -span + row * step;
        const z = this.#surfaceValue(x, y);
        points[row][column] = { x, y, z };
        if (z !== null) {
          low = Math.min(low, z);
          high = Math.max(high, z);
        }
      }
    }

    if (!Number.isFinite(low)) {
      context.fillStyle = getComputedStyle(this).getPropertyValue('--muted-foreground').trim() || '#888';
      context.font = '13px ui-sans-serif, system-ui, sans-serif';
      context.textAlign = 'center';
      context.fillText('That expression does not produce a surface. Use x and y.', width / 2, height / 2);
      context.textAlign = 'left';
      return;
    }

    const range = high - low || 1;
    const scale = (Math.min(width, height) / (span * 2.6)) * this.#camera.zoom;
    const heightScale = (span * 0.55) / range;
    const cosYaw = Math.cos(this.#camera.yaw);
    const sinYaw = Math.sin(this.#camera.yaw);
    const cosPitch = Math.cos(this.#camera.pitch);
    const sinPitch = Math.sin(this.#camera.pitch);

    const project = ({ x, y, z }) => {
      const level = z === null ? 0 : (z - low - range / 2) * heightScale;
      const rx = x * cosYaw - y * sinYaw;
      const ry = x * sinYaw + y * cosYaw;
      return {
        screenX: width / 2 + rx * scale,
        screenY: height / 2 + (ry * sinPitch - level * cosPitch) * scale,
        depth: ry * cosPitch + level * sinPitch,
      };
    };

    const quads = [];
    for (let row = 0; row < steps; row += 1) {
      for (let column = 0; column < steps; column += 1) {
        const corners = [points[row][column], points[row][column + 1], points[row + 1][column + 1], points[row + 1][column]];
        if (corners.some((corner) => corner.z === null)) continue;
        const projected = corners.map(project);
        const average = corners.reduce((total, corner) => total + corner.z, 0) / 4;
        quads.push({
          projected,
          level: (average - low) / range,
          depth: projected.reduce((total, point) => total + point.depth, 0) / 4,
        });
      }
    }

    quads.sort((a, b) => a.depth - b.depth);

    const accent = getComputedStyle(this).getPropertyValue('--ring').trim() || '#8a1c3b';
    const border = getComputedStyle(this).getPropertyValue('--border').trim() || '#8883';

    const axes = [
      [{ x: -span, y: 0, z: null }, { x: span, y: 0, z: null }],
      [{ x: 0, y: -span, z: null }, { x: 0, y: span, z: null }],
    ];

    context.strokeStyle = border;
    context.lineWidth = 1;
    axes.forEach(([from, to]) => {
      const start = project(from);
      const end = project(to);
      context.beginPath();
      context.moveTo(start.screenX, start.screenY);
      context.lineTo(end.screenX, end.screenY);
      context.stroke();
    });

    quads.forEach((quad) => {
      const [first, ...rest] = quad.projected;
      context.beginPath();
      context.moveTo(first.screenX, first.screenY);
      rest.forEach((point) => context.lineTo(point.screenX, point.screenY));
      context.closePath();

      const light = 22 + quad.level * 58;
      context.fillStyle = `color-mix(in srgb, ${accent} ${light.toFixed(0)}%, #ffffff)`;
      context.strokeStyle = `color-mix(in srgb, ${accent} ${(light + 18).toFixed(0)}%, transparent)`;
      context.lineWidth = 0.6;
      context.fill();
      context.stroke();
    });

    context.fillStyle = getComputedStyle(this).getPropertyValue('--muted-foreground').trim() || '#888';
    context.font = '11px ui-monospace, monospace';
    context.fillText(`z from ${Number(low.toPrecision(4))} to ${Number(high.toPrecision(4))}`, 10, height - 10);
    context.fillText(`x, y in [-${span}, ${span}]`, 10, height - 26);
  }
}

define('jg-app-function-plotter', FunctionPlotter);
