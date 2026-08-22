import { css } from '../core/dom.js';
import { icon } from './icons.js';

export const paletteSheet = css`
  .palette, .rail {
    scrollbar-width: thin;
    scrollbar-color: var(--border-strong) transparent;
  }
  .palette::-webkit-scrollbar, .rail::-webkit-scrollbar { width: 9px; }
  .palette::-webkit-scrollbar-thumb, .rail::-webkit-scrollbar-thumb {
    background: var(--border-strong);
    border-radius: 999px;
    border: 3px solid transparent;
    background-clip: content-box;
  }
  .palette::-webkit-scrollbar-track, .rail::-webkit-scrollbar-track { background: transparent; }

  button.group {
    position: sticky;
    top: 0;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    width: 100%;
    border: 0;
    background: var(--surface, var(--background));
    cursor: pointer;
    text-align: left;
  }
  button.group:hover { color: var(--foreground); }
  button.group .fold {
    display: grid;
    place-items: center;
    opacity: 0.55;
    transition: transform 0.15s ease;
  }
  button.group .fold svg { width: 11px; height: 11px; stroke-width: 2.4; }
  button.group[aria-expanded="false"] .fold { transform: rotate(-90deg); }
`;

const label = (node) => node.textContent.trim();

export function collapsibleGroups(root, options = {}) {
  if (!root) return;
  const { store, key = 'palette.folded' } = options;
  const folded = new Set(store?.get(key, []) ?? []);

  const save = () => store?.set(key, [...folded]);

  const members = (group) => {
    const out = [];
    let node = group.nextElementSibling;
    while (node && !node.classList.contains('group')) {
      out.push(node);
      node = node.nextElementSibling;
    }
    return out;
  };

  for (const group of [...root.querySelectorAll('.group')]) {
    if (group.dataset.foldable) continue;

    const name = label(group);
    const id = group.dataset.group ?? name.toLowerCase();
    const button = document.createElement('button');
    button.type = 'button';
    button.className = group.className;
    button.dataset.foldable = 'true';
    button.dataset.group = id;
    button.innerHTML = `<span>${name}</span><span class="fold">${icon('chevronDown', 11)}</span>`;
    group.replaceWith(button);

    const apply = () => {
      const open = !folded.has(id);
      button.setAttribute('aria-expanded', String(open));
      members(button).forEach((node) => {
        node.hidden = !open;
      });
    };

    button.addEventListener('click', () => {
      if (folded.has(id)) folded.delete(id);
      else folded.add(id);
      apply();
      save();
    });

    apply();
  }
}
