const PALETTE = ['#3b6fd4', '#c02a2a', '#1d7a45', '#c2691b', '#6c3fa8', '#0d7b8a', '#a01f6f', '#5b6671'];

const niceStep = (span, want) => {
  const raw = span / Math.max(1, want);
  const power = 10 ** Math.floor(Math.log10(raw || 1));
  const base = raw / power;
  const step = base <= 1 ? 1 : base <= 2 ? 2 : base <= 5 ? 5 : 10;
  return step * power;
};

export function drawChart(canvas, spec = {}) {
  const kind = spec.kind ?? 'bar';
  const points = (spec.points ?? []).filter((point) => Number.isFinite(Number(point.value)));
  const context = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  const ink = spec.ink ?? '#111111';
  const faint = spec.faint ?? '#c9d0d8';

  context.setTransform(1, 0, 0, 1, 0, 0);
  context.fillStyle = spec.background ?? '#ffffff';
  context.fillRect(0, 0, width, height);
  if (!points.length) return;

  const font = spec.font ?? 'Helvetica Neue, Arial, sans-serif';
  const label = Math.max(9, Math.round(height / 26));
  context.textBaseline = 'middle';

  if (spec.title) {
    context.fillStyle = ink;
    context.font = `600 ${label * 1.3}px ${font}`;
    context.textAlign = 'left';
    context.fillText(spec.title, 12, label * 1.4);
  }
  const top = spec.title ? label * 2.8 : 16;

  if (kind === 'pie') {
    const total = points.reduce((sum, point) => sum + Math.max(0, Number(point.value)), 0);
    if (!total) return;
    const radius = Math.min(width * 0.3, (height - top - 20) / 2);
    const cx = width * 0.34;
    const cy = top + radius + 6;
    let angle = -Math.PI / 2;
    points.forEach((point, index) => {
      const slice = (Math.max(0, Number(point.value)) / total) * Math.PI * 2;
      context.beginPath();
      context.moveTo(cx, cy);
      context.arc(cx, cy, radius, angle, angle + slice);
      context.closePath();
      context.fillStyle = PALETTE[index % PALETTE.length];
      context.fill();
      angle += slice;
    });
    context.textAlign = 'left';
    points.forEach((point, index) => {
      const y = top + 10 + index * (label * 1.7);
      if (y > height - 8) return;
      context.fillStyle = PALETTE[index % PALETTE.length];
      context.fillRect(width * 0.66, y - label * 0.4, label, label);
      context.fillStyle = ink;
      context.font = `${label}px ${font}`;
      const share = Math.round((Math.max(0, Number(point.value)) / total) * 100);
      context.fillText(`${point.label ?? ''} ${share}%`, width * 0.66 + label * 1.5, y + label * 0.1);
    });
    return;
  }

  const values = points.map((point) => Number(point.value));
  const high = Math.max(0, ...values);
  const low = Math.min(0, ...values);
  const padLeft = 52;
  const padBottom = label * 2.6;
  const plotWidth = width - padLeft - 18;
  const plotHeight = height - top - padBottom;
  const step = niceStep(high - low || 1, 4);
  const ceiling = Math.ceil(high / step) * step || step;
  const floor = Math.floor(low / step) * step;
  const toY = (value) => top + plotHeight - ((value - floor) / (ceiling - floor || 1)) * plotHeight;

  context.strokeStyle = faint;
  context.lineWidth = 1;
  context.font = `${label}px ${font}`;
  context.textAlign = 'right';
  for (let value = floor; value <= ceiling + 1e-9; value += step) {
    const y = Math.round(toY(value)) + 0.5;
    context.beginPath();
    context.moveTo(padLeft, y);
    context.lineTo(padLeft + plotWidth, y);
    context.stroke();
    context.fillStyle = '#8a929a';
    context.fillText(String(Math.round(value * 100) / 100), padLeft - 8, y);
  }

  const slot = plotWidth / points.length;
  context.textAlign = 'center';

  if (kind === 'line' || kind === 'area') {
    context.beginPath();
    points.forEach((point, index) => {
      const x = padLeft + slot * (index + 0.5);
      const y = toY(Number(point.value));
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    if (kind === 'area') {
      context.lineTo(padLeft + slot * (points.length - 0.5), toY(floor));
      context.lineTo(padLeft + slot * 0.5, toY(floor));
      context.closePath();
      context.fillStyle = `${PALETTE[0]}33`;
      context.fill();
      context.beginPath();
      points.forEach((point, index) => {
        const x = padLeft + slot * (index + 0.5);
        const y = toY(Number(point.value));
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      });
    }
    context.strokeStyle = PALETTE[0];
    context.lineWidth = 2.2;
    context.stroke();
    points.forEach((point, index) => {
      const x = padLeft + slot * (index + 0.5);
      context.beginPath();
      context.arc(x, toY(Number(point.value)), 3.4, 0, Math.PI * 2);
      context.fillStyle = PALETTE[0];
      context.fill();
    });
  } else {
    const barWidth = Math.max(4, slot * 0.62);
    points.forEach((point, index) => {
      const x = padLeft + slot * (index + 0.5) - barWidth / 2;
      const value = Number(point.value);
      const y = toY(Math.max(value, floor));
      const base = toY(0 >= floor ? 0 : floor);
      context.fillStyle = PALETTE[index % PALETTE.length];
      context.fillRect(x, Math.min(y, base), barWidth, Math.abs(base - y));
    });
  }

  context.fillStyle = '#5b6671';
  context.font = `${label}px ${font}`;
  points.forEach((point, index) => {
    const x = padLeft + slot * (index + 0.5);
    context.fillText(String(point.label ?? ''), x, height - padBottom / 2 + label * 0.2);
  });
}

export const parseSeries = (text) =>
  String(text)
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/[,\t;]+/);
      const value = Number(parts[parts.length - 1]);
      return { label: parts.slice(0, -1).join(' ').trim() || parts[0], value };
    })
    .filter((point) => Number.isFinite(point.value));
