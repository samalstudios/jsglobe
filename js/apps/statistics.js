import { JGApp, define, html, css } from '../core/app.js';
import { debounce, copyText } from '../core/util.js';

const sheet = css`
  .split { display: grid; grid-template-columns: 320px 1fr; gap: 14px; flex: 1; min-height: 0; }
  @media (max-width: 880px) { .split { grid-template-columns: 1fr; } }
  .right { display: flex; flex-direction: column; gap: 12px; min-width: 0; overflow: auto; scrollbar-width: thin; }
  .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(116px, 1fr)); gap: 8px; }
  .stat {
    display: grid;
    gap: 2px;
    padding: 9px 11px;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--muted) 45%, transparent);
  }
  .stat .value { font: 600 16px/1.2 var(--font-mono); letter-spacing: -0.02em; }
  .stat .name { font-size: 11px; color: var(--muted-foreground); }
  svg { display: block; width: 100%; height: auto; overflow: visible; }
  .bar { fill: var(--ring); }
  .axis { stroke: var(--border-strong); stroke-width: 1; }
  .tick { fill: var(--muted-foreground); font-family: var(--font-mono); font-size: 9px; }
  .box { fill: color-mix(in srgb, var(--ring) 22%, transparent); stroke: var(--ring); stroke-width: 1.6; }
  .whisker { stroke: var(--muted-foreground); stroke-width: 1.4; }
  .outlier { fill: var(--destructive); }
`;

const SAMPLE = '12 15 11 19 22 18 17 24 13 16 21 14 20 18 17 23 12 19 16 30';

const parse = (text) =>
  text
    .split(/[\s,;]+/)
    .map((token) => Number(token.replace(/[^\d.eE+-]/g, '')))
    .filter((value) => Number.isFinite(value));

const quantile = (sorted, fraction) => {
  if (!sorted.length) return 0;
  const position = (sorted.length - 1) * fraction;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return lower === upper ? sorted[lower] : sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
};

const describe = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const count = sorted.length;
  const sum = sorted.reduce((total, value) => total + value, 0);
  const mean = sum / count;
  const variance = sorted.reduce((total, value) => total + (value - mean) ** 2, 0) / count;
  const sampleVariance = count > 1 ? sorted.reduce((total, value) => total + (value - mean) ** 2, 0) / (count - 1) : 0;

  const counts = new Map();
  sorted.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  const top = Math.max(...counts.values());
  const modes = [...counts.entries()].filter(([, times]) => times === top && top > 1).map(([value]) => value);

  const q1 = quantile(sorted, 0.25);
  const q3 = quantile(sorted, 0.75);
  const iqr = q3 - q1;

  return {
    sorted,
    count,
    sum,
    mean,
    median: quantile(sorted, 0.5),
    modes,
    min: sorted[0],
    max: sorted[count - 1],
    range: sorted[count - 1] - sorted[0],
    variance,
    deviation: Math.sqrt(variance),
    sampleDeviation: Math.sqrt(sampleVariance),
    q1,
    q3,
    iqr,
    lowerFence: q1 - 1.5 * iqr,
    upperFence: q3 + 1.5 * iqr,
    geometric: sorted.every((value) => value > 0) ? Math.exp(sorted.reduce((total, value) => total + Math.log(value), 0) / count) : null,
    skew:
      count > 2 && variance > 0
        ? (sorted.reduce((total, value) => total + (value - mean) ** 3, 0) / count) / variance ** 1.5
        : 0,
  };
};

const round = (value, digits = 4) =>
  value === null || !Number.isFinite(value) ? '-' : String(Number(value.toFixed(digits)));

class Statistics extends JGApp {
  static appId = 'statistics';
  static styles = [...JGApp.styles, sheet];

  renderApp() {
    this.paint(html`<div class="app">
      <div class="split">
        <div class="stack tight">
          <jg-field label="Numbers" grow>
            <jg-textarea id="input" rows="14" grow placeholder="Paste numbers separated by spaces, commas or new lines"></jg-textarea>
          </jg-field>
          <div class="row">
            <jg-button size="sm" variant="outline" id="sample">Sample</jg-button>
            <jg-button size="sm" variant="ghost" id="sort">Sort</jg-button>
            <jg-button size="sm" variant="ghost" id="copy">Copy summary</jg-button>
          </div>
          <div class="row">
            <span class="hint">Bins</span>
            <jg-slider id="bins" min="4" max="30" value="10" style="max-width:180px"></jg-slider>
          </div>
        </div>

        <div class="right">
          <div class="summary" id="summary"></div>

          <jg-card title="Distribution" sub="Histogram of the values">
            <svg id="histogram" viewBox="0 0 600 220" preserveAspectRatio="none"></svg>
          </jg-card>

          <jg-card title="Spread" sub="Box plot with quartiles, whiskers and outliers">
            <svg id="box" viewBox="0 0 600 130"></svg>
          </jg-card>

          <jg-card title="All values">
            <div class="kv" id="detail"></div>
          </jg-card>
        </div>
      </div>
    </div>`);

    const run = debounce(() => this.#run(), 160);
    this.on(this.$('#input'), 'input', run);
    this.on(this.$('#bins'), 'input', run);
    this.on(this.$('#sample'), 'click', () => {
      this.$('#input').value = SAMPLE;
      this.#run();
    });
    this.on(this.$('#sort'), 'click', () => {
      const values = parse(this.$('#input').value).sort((a, b) => a - b);
      this.$('#input').value = values.join(' ');
      this.#run();
    });
    this.on(this.$('#copy'), 'click', () => copyText(this.#summaryText()));

    const saved = this.store.read({ text: '' });
    this.$('#input').value = saved.text || SAMPLE;
    this.#run();
  }

  #stats() {
    const values = parse(this.$('#input').value);
    return values.length ? describe(values) : null;
  }

  #summaryText() {
    const stats = this.#stats();
    if (!stats) return '';
    return [
      `count ${stats.count}`,
      `sum ${round(stats.sum)}`,
      `mean ${round(stats.mean)}`,
      `median ${round(stats.median)}`,
      `min ${round(stats.min)}`,
      `max ${round(stats.max)}`,
      `range ${round(stats.range)}`,
      `population sd ${round(stats.deviation)}`,
      `sample sd ${round(stats.sampleDeviation)}`,
      `variance ${round(stats.variance)}`,
      `q1 ${round(stats.q1)}`,
      `q3 ${round(stats.q3)}`,
      `iqr ${round(stats.iqr)}`,
    ].join('\n');
  }

  #run() {
    const stats = this.#stats();
    this.store.write({ text: this.$('#input').value });

    if (!stats) {
      this.$('#summary').innerHTML = html`<span class="hint">Paste some numbers to see the summary.</span>`;
      this.$('#histogram').innerHTML = '';
      this.$('#box').innerHTML = '';
      this.$('#detail').innerHTML = '';
      return;
    }

    const cards = [
      ['Count', stats.count],
      ['Mean', round(stats.mean)],
      ['Median', round(stats.median)],
      ['Std dev', round(stats.sampleDeviation)],
      ['Min', round(stats.min)],
      ['Max', round(stats.max)],
    ];

    this.$('#summary').innerHTML = cards
      .map(([name, value]) => html`<div class="stat"><span class="value">${value}</span><span class="name">${name}</span></div>`)
      .join('');

    this.$('#detail').innerHTML = html`
      <div>Sum</div><div class="mono">${round(stats.sum)}</div>
      <div>Range</div><div class="mono">${round(stats.range)}</div>
      <div>Mode</div><div class="mono">${stats.modes.length ? stats.modes.join(', ') : 'no repeated value'}</div>
      <div>Variance</div><div class="mono">${round(stats.variance)}</div>
      <div>Population sd</div><div class="mono">${round(stats.deviation)}</div>
      <div>Sample sd</div><div class="mono">${round(stats.sampleDeviation)}</div>
      <div>Q1 / Q3</div><div class="mono">${round(stats.q1)} / ${round(stats.q3)}</div>
      <div>Interquartile range</div><div class="mono">${round(stats.iqr)}</div>
      <div>Geometric mean</div><div class="mono">${stats.geometric === null ? 'needs positive values' : round(stats.geometric)}</div>
      <div>Skewness</div><div class="mono">${round(stats.skew)}</div>
      <div>Outliers</div><div class="mono">${
        stats.sorted.filter((value) => value < stats.lowerFence || value > stats.upperFence).join(', ') || 'none'
      }</div>
    `;

    this.#histogram(stats);
    this.#box(stats);
  }

  #histogram(stats) {
    const bins = Number(this.$('#bins').value);
    const width = 600;
    const height = 220;
    const padding = { left: 34, right: 8, top: 10, bottom: 22 };
    const span = stats.range || 1;
    const size = span / bins;

    const buckets = Array.from({ length: bins }, () => 0);
    stats.sorted.forEach((value) => {
      const index = Math.min(bins - 1, Math.floor((value - stats.min) / size));
      buckets[index] += 1;
    });

    const peak = Math.max(...buckets, 1);
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;
    const barWidth = plotWidth / bins;

    this.$('#histogram').innerHTML = html`
      <line class="axis" x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}" />
      <line class="axis" x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${height - padding.bottom}" />
      ${buckets.map((count, index) => {
        const barHeight = (count / peak) * plotHeight;
        return html`<rect
          class="bar"
          x="${padding.left + index * barWidth + 1}"
          y="${height - padding.bottom - barHeight}"
          width="${Math.max(1, barWidth - 2)}"
          height="${barHeight}"
          rx="2"
        ><title>${count} values from ${round(stats.min + index * size, 2)} to ${round(stats.min + (index + 1) * size, 2)}</title></rect>`;
      })}
      <text class="tick" x="${padding.left}" y="${height - 6}">${round(stats.min, 2)}</text>
      <text class="tick" x="${width - padding.right}" y="${height - 6}" text-anchor="end">${round(stats.max, 2)}</text>
      <text class="tick" x="4" y="${padding.top + 8}">${peak}</text>
    `;
  }

  #box(stats) {
    const width = 600;
    const height = 130;
    const left = 30;
    const right = width - 30;
    const middle = 62;

    const low = Math.min(stats.min, stats.lowerFence);
    const high = Math.max(stats.max, stats.upperFence);
    const span = high - low || 1;
    const toX = (value) => left + ((value - low) / span) * (right - left);

    const whiskerLow = Math.min(...stats.sorted.filter((value) => value >= stats.lowerFence));
    const whiskerHigh = Math.max(...stats.sorted.filter((value) => value <= stats.upperFence));
    const outliers = stats.sorted.filter((value) => value < stats.lowerFence || value > stats.upperFence);

    this.$('#box').innerHTML = html`
      <line class="whisker" x1="${toX(whiskerLow)}" y1="${middle}" x2="${toX(stats.q1)}" y2="${middle}" />
      <line class="whisker" x1="${toX(stats.q3)}" y1="${middle}" x2="${toX(whiskerHigh)}" y2="${middle}" />
      <line class="whisker" x1="${toX(whiskerLow)}" y1="${middle - 14}" x2="${toX(whiskerLow)}" y2="${middle + 14}" />
      <line class="whisker" x1="${toX(whiskerHigh)}" y1="${middle - 14}" x2="${toX(whiskerHigh)}" y2="${middle + 14}" />
      <rect class="box" x="${toX(stats.q1)}" y="${middle - 24}" width="${Math.max(1, toX(stats.q3) - toX(stats.q1))}" height="48" rx="4" />
      <line class="whisker" x1="${toX(stats.median)}" y1="${middle - 24}" x2="${toX(stats.median)}" y2="${middle + 24}" stroke-width="2.4" />
      ${outliers.map((value) => html`<circle class="outlier" cx="${toX(value)}" cy="${middle}" r="3.5"><title>${value}</title></circle>`)}
      <text class="tick" x="${toX(stats.q1)}" y="${middle + 42}" text-anchor="middle">Q1 ${round(stats.q1, 2)}</text>
      <text class="tick" x="${toX(stats.median)}" y="${middle - 32}" text-anchor="middle">median ${round(stats.median, 2)}</text>
      <text class="tick" x="${toX(stats.q3)}" y="${middle + 42}" text-anchor="middle">Q3 ${round(stats.q3, 2)}</text>
    `;
  }
}

define('jg-app-statistics', Statistics);
