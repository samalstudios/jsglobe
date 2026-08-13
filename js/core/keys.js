import { bus } from './bus.js';

const EDITABLE = /^(INPUT|TEXTAREA|SELECT)$/;

let owner = null;
let overlays = 0;

const editing = (event) => {
  const target = event.composedPath()[0];
  return target instanceof HTMLElement && (EDITABLE.test(target.tagName) || target.isContentEditable);
};

bus.on('windows:change', ({ focused }) => {
  owner = focused;
});

export const keys = {
  editing,

  get owner() {
    return owner;
  },

  get overlaid() {
    return overlays > 0;
  },

  overlay() {
    overlays += 1;
    let done = false;
    return () => {
      if (done) return;
      done = true;
      overlays = Math.max(0, overlays - 1);
    };
  },

  ambient(event) {
    return !overlays && !owner && !editing(event);
  },

  owned(appId, event, { text = false } = {}) {
    return !overlays && owner === appId && (text || !editing(event));
  },
};
