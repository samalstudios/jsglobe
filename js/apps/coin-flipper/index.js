import { JGApp, define, html, styleSheet } from '../../core/app.js';
import { appWords } from '../../core/i18n.js';
import { icon } from '../../ui/icons.js';
import { copyText, toast } from '../../core/util.js';

const t = await appWords('coin-flipper', (lang) => import(`./i18n/${lang}.js`));

const sheet = await styleSheet(import.meta.url);

const flip = () => {
  const spread = new Uint8Array(1);
  crypto.getRandomValues(spread);
  return spread[0] % 2 === 0 ? 'heads' : 'tails';
};

class CoinFlipper extends JGApp {
  static appId = 'coin-flipper';
  static settings = [
    { key: 'batch', label: t('coin-flipper.flipsPerGo', 'Flips in a run'), type: 'number', default: 100, min: 10, max: 5000 },
  ];
  static styles = [...JGApp.styles, sheet];

  #counts = { heads: 0, tails: 0 };
  #runs = [];
  #streak = { side: null, length: 0, best: 0 };
  #busy = false;

  renderApp() {
    this.paint(html`<div class="app">
      <div class="stage">
        <div class="coin" id="coin" data-side="heads">
          <span class="face heads">${t('coin-flipper.heads', 'Heads')}</span>
          <span class="face tails">${t('coin-flipper.tails', 'Tails')}</span>
        </div>
        <div class="called" id="called" role="status" aria-live="polite"></div>
      </div>

      <div class="row">
        <jg-button id="flip" size="lg">${t('coin-flipper.flip', 'Flip')}</jg-button>
        <jg-button id="run" variant="outline">${t('coin-flipper.flipManyAtOnce', 'Flip many at once')}</jg-button>
        <span class="grow"></span>
        <button class="tool" id="copy" title="${t('coin-flipper.copyTheRun', 'Copy the run')}">${icon('copy', 15)}</button>
        <button class="tool" id="clear" title="${t('coin-flipper.startOver', 'Start over')}">${icon('eraser', 15)}</button>
      </div>

      <div class="counts">
        <div class="count" data-side="heads">
          <span class="name">${t('coin-flipper.heads', 'Heads')}</span>
          <span class="number" id="heads">0</span>
          <span class="share" id="headsShare">—</span>
        </div>
        <div class="scale"><span class="fill" id="fill" style="width:50%"></span></div>
        <div class="count" data-side="tails">
          <span class="name">${t('coin-flipper.tails', 'Tails')}</span>
          <span class="number" id="tails">0</span>
          <span class="share" id="tailsShare">—</span>
        </div>
      </div>

      <div class="foot">
        <div class="panel">
          <span class="label">${t('coin-flipper.howTheShareSettles', 'How the share settles')}</span>
          <canvas id="chart" class="chart"></canvas>
          <p class="hint">${t('coin-flipper.evensOutBlurb', 'Each flip is its own even chance. The line wanders at first and settles towards half as the flips add up.')}</p>
        </div>
        <div class="panel">
          <span class="label">${t('coin-flipper.theRun', 'The run')}</span>
          <div class="beads" id="beads"></div>
          <p class="hint" id="streaks"></p>
        </div>
      </div>
    </div>`);

    this.on(this.$('#flip'), 'click', () => this.#once());
    this.on(this.$('#run'), 'click', () => this.#many());
    this.on(this.$('#clear'), 'click', () => this.#clear());
    this.on(this.$('#copy'), 'click', () => {
      copyText(this.#runs.join(''));
      toast(t('coin-flipper.copiedTheRun', 'Copied the run'));
    });

    this.listen(window, 'keydown', (event) => {
      if (event.key !== ' ' || this.offsetParent === null) return;
      if (event.target.closest?.('input, textarea')) return;
      event.preventDefault();
      this.#once();
    });

    this.#draw();
  }

  async #once() {
    if (this.#busy) return;
    this.#busy = true;
    const coin = this.$('#coin');
    const side = flip();

    coin.dataset.spinning = 'true';
    coin.dataset.side = side;
    await new Promise((wait) => setTimeout(wait, 620));
    delete coin.dataset.spinning;

    this.$('#called').textContent = side === 'heads' ? t('coin-flipper.heads', 'Heads') : t('coin-flipper.tails', 'Tails');
    this.#record(side);
    this.#draw();
    this.#busy = false;
  }

  #many() {
    const batch = Math.max(10, Math.min(5000, Number(this.config.get('batch', 100)) || 100));
    for (let at = 0; at < batch; at += 1) this.#record(flip());
    this.$('#coin').dataset.side = this.#runs[this.#runs.length - 1] === 'h' ? 'heads' : 'tails';
    this.$('#called').textContent = t('coin-flipper.flippedCount', 'Flipped {count} times', { count: batch });
    this.#draw();
  }

  #record(side) {
    this.#counts[side] += 1;
    this.#runs.push(side === 'heads' ? 'h' : 't');
    if (this.#streak.side === side) this.#streak.length += 1;
    else this.#streak = { ...this.#streak, side, length: 1 };
    this.#streak.best = Math.max(this.#streak.best, this.#streak.length);
  }

  #clear() {
    this.#counts = { heads: 0, tails: 0 };
    this.#runs = [];
    this.#streak = { side: null, length: 0, best: 0 };
    this.$('#called').textContent = '';
    this.#draw();
  }

  #draw() {
    const total = this.#counts.heads + this.#counts.tails;
    const share = (value) => (total ? `${((value / total) * 100).toFixed(1)}%` : '—');

    this.$('#heads').textContent = String(this.#counts.heads);
    this.$('#tails').textContent = String(this.#counts.tails);
    this.$('#headsShare').textContent = share(this.#counts.heads);
    this.$('#tailsShare').textContent = share(this.#counts.tails);
    this.$('#fill').style.width = total ? `${(this.#counts.heads / total) * 100}%` : '50%';

    this.$('#streaks').textContent = total
      ? t('coin-flipper.longestRun', 'Longest run of the same side: {count}', { count: this.#streak.best })
      : t('coin-flipper.flipToBegin', 'Flip to begin, or press the space bar');

    const beads = this.$('#beads');
    const tail = this.#runs.slice(-120);
    beads.innerHTML = tail.map((side) => `<i data-side="${side}"></i>`).join('');

    this.#chart();
  }

  #chart() {
    const canvas = this.$('#chart');
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const box = canvas.getBoundingClientRect();
    if (!box.width) return;
    canvas.width = Math.round(box.width * ratio);
    canvas.height = Math.round(box.height * ratio);

    const look = getComputedStyle(this);
    const context = canvas.getContext('2d');
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, box.width, box.height);

    const middle = box.height / 2;
    context.strokeStyle = look.getPropertyValue('--border-strong') || '#c9ced6';
    context.setLineDash([3, 4]);
    context.beginPath();
    context.moveTo(0, middle);
    context.lineTo(box.width, middle);
    context.stroke();
    context.setLineDash([]);

    if (this.#runs.length < 2) return;

    const step = Math.max(1, Math.floor(this.#runs.length / Math.max(1, Math.round(box.width))));
    let heads = 0;
    const points = [];
    this.#runs.forEach((side, at) => {
      if (side === 'h') heads += 1;
      if (at % step && at !== this.#runs.length - 1) return;
      points.push({ at: at + 1, share: heads / (at + 1) });
    });

    context.strokeStyle = look.getPropertyValue('--ring') || '#3b82f6';
    context.lineWidth = 1.6;
    context.lineJoin = 'round';
    context.beginPath();
    points.forEach((point, index) => {
      const x = (point.at / this.#runs.length) * box.width;
      const y = box.height - point.share * box.height;
      if (index) context.lineTo(x, y);
      else context.moveTo(x, y);
    });
    context.stroke();
  }

  renderWidget() {
    this.paint(html`<div class="app" style="padding:12px">
      <div class="stack tight">
        <div class="label">${t('coin-flipper.coinFlipper', 'Coin Flipper')}</div>
        <div class="hint">${t('coin-flipper.widgetBlurb', 'Flip a coin and watch the odds even out.')}</div>
      </div>
    </div>`);
  }
}

define('jg-app-coin-flipper', CoinFlipper);
