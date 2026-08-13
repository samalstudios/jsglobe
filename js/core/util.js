let toaster = null;

export function toast(message, tone = 'default') {
  if (!toaster) {
    toaster = document.createElement('div');
    toaster.className = 'jg-toaster';
    document.body.append(toaster);
  }
  const node = document.createElement('div');
  node.className = 'jg-toast';
  node.dataset.tone = tone;
  node.textContent = message;
  toaster.append(node);
  setTimeout(() => {
    node.classList.add('is-leaving');
    setTimeout(() => node.remove(), 220);
  }, 1800);
}

export async function copyText(text) {
  const value = String(text ?? '');
  if (!value) return false;
  try {
    await navigator.clipboard.writeText(value);
    toast('Copied to clipboard', 'success');
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = value;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.append(area);
    area.select();
    const ok = document.execCommand?.('copy');
    area.remove();
    toast(ok ? 'Copied to clipboard' : 'Copy failed', ok ? 'success' : 'error');
    return Boolean(ok);
  }
}

export function download(filename, content, type = 'text/plain;charset=utf-8') {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function pickFile(accept = '*/*', asText = true) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      resolve({ file, name: file.name, size: file.size, data: asText ? await file.text() : await file.arrayBuffer() });
    };
    input.click();
  });
}

export function debounce(fn, wait = 160) {
  let timer;
  const wrapped = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
  wrapped.cancel = () => clearTimeout(timer);
  return wrapped;
}

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `id-${Math.random().toString(36).slice(2, 11)}`);

export const encodeBytes = (text) => new TextEncoder().encode(text);

export const decodeBytes = (bytes) => new TextDecoder().decode(bytes);

export const toHex = (buffer) => [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');

export const fromHex = (hex) => {
  const clean = hex.replace(/[^0-9a-f]/gi, '');
  const out = new Uint8Array(Math.floor(clean.length / 2));
  for (let i = 0; i < out.length; i += 1) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
};

export const toBase64 = (bytes) => {
  let binary = '';
  const view = new Uint8Array(bytes);
  const chunk = 0x8000;
  for (let i = 0; i < view.length; i += chunk) binary += String.fromCharCode(...view.subarray(i, i + chunk));
  return btoa(binary);
};

export const fromBase64 = (text) => {
  const binary = atob(text.replace(/\s+/g, ''));
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
};

export const base64Url = (base64) => base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export const fromBase64Url = (text) => {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/');
  return fromBase64(padded + '='.repeat((4 - (padded.length % 4)) % 4));
};

export function formatBytes(size) {
  if (!size) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(units.length - 1, Math.floor(Math.log(size) / Math.log(1024)));
  const value = size / 1024 ** index;
  return `${value >= 100 || index === 0 ? Math.round(value) : value.toFixed(1)} ${units[index]}`;
}

export const randomInt = (max) => crypto.getRandomValues(new Uint32Array(1))[0] % max;

export const randomBytes = (length) => crypto.getRandomValues(new Uint8Array(length));

export const pick = (list) => list[randomInt(list.length)];

export function shuffle(list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export const chunk = (list, size) => {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
};

export const titleCase = (text) => text.replace(/\w\S*/g, (word) => word[0].toUpperCase() + word.slice(1).toLowerCase());

export function words(text) {
  return text
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[\s_\-./\\]+/)
    .filter(Boolean);
}

export const isMobile = () => window.matchMedia('(max-width: 860px)').matches;
