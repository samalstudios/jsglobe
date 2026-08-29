// Working with the caret inside an element people can type in. Every call
// takes the root it should stay within, so the same helpers serve a document,
// a note, a caption or anything else editable.

export const selectionIn = (root) => root?.getRootNode?.()?.getSelection?.() ?? window.getSelection();

export const rangeIn = (root) => {
  const selection = selectionIn(root);
  if (!selection?.rangeCount) return null;
  const range = selection.getRangeAt(0);
  return root.contains(range.commonAncestorContainer) ? range : null;
};

export const elementAt = (node) => (node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement ?? null);

export const closestIn = (root, node, selector) => {
  const from = elementAt(node);
  if (!from || !root.contains(from)) return null;
  return from.closest(selector);
};

// the block a caret sits in, out of a list the caller says are blocks
export const blockOf = (blocks, node) => {
  let from = elementAt(node);
  while (from && !blocks.includes(from)) from = from.parentElement;
  return from ?? null;
};

export const select = (root, range) => {
  const selection = selectionIn(root);
  selection?.removeAllRanges();
  selection?.addRange(range);
  return range;
};

// remember where the caret is as a block and a count of characters, so it can
// be put back after the blocks have been moved about
export const markCaret = (root, blocks) => {
  const selection = selectionIn(root);
  const anchor = selection?.anchorNode;
  if (!anchor) return null;
  const at = blocks.findIndex((block) => block === anchor || block.contains(anchor));
  if (at < 0) return null;

  const range = document.createRange();
  range.selectNodeContents(blocks[at]);
  try {
    range.setEnd(anchor, selection.anchorOffset);
  } catch {
    return { at, offset: 0 };
  }
  return { at, offset: range.toString().length };
};

export const placeCaret = (root, blocks, mark) => {
  if (!mark) return false;
  const block = blocks[mark.at];
  if (!block) return false;

  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  let seen = 0;
  let target = null;
  let offset = 0;
  while (walker.nextNode()) {
    const text = walker.currentNode;
    const length = text.textContent.length;
    if (seen + length >= mark.offset) {
      target = text;
      offset = mark.offset - seen;
      break;
    }
    seen += length;
  }

  const range = document.createRange();
  if (target) range.setStart(target, Math.min(offset, target.textContent.length));
  else range.selectNodeContents(block);
  range.collapse(true);
  select(root, range);
  return true;
};

// a caret asked to sit after an element with nothing in it slides back into the
// text before it, so give it a node of its own to land in
export const caretAfter = (root, node) => {
  let rest = node.nextSibling;
  if (!rest || rest.nodeType !== Node.TEXT_NODE) {
    rest = document.createTextNode(' ');
    node.after(rest);
  }
  const range = document.createRange();
  range.setStart(rest, 0);
  range.collapse(true);
  return select(root, range);
};

// nothing picked out means the word the caret is in, or the whole block when it
// is not sitting in a word
export const reachWord = (root, blocks) => {
  const selection = selectionIn(root);
  if (!selection?.rangeCount) return null;
  const range = selection.getRangeAt(0);
  const node = range.startContainer;

  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.nodeValue ?? '';
    let from = range.startOffset;
    let to = range.startOffset;
    while (from > 0 && /\S/.test(text[from - 1])) from -= 1;
    while (to < text.length && /\S/.test(text[to])) to += 1;
    if (to > from) {
      const word = document.createRange();
      word.setStart(node, from);
      word.setEnd(node, to);
      return select(root, word);
    }
  }

  const block = blockOf(blocks, node);
  if (!block || !block.textContent.trim()) return null;
  const whole = document.createRange();
  whole.selectNodeContents(block);
  return select(root, whole);
};

export const wrapSelection = (root, tag, attributes = {}, styles = {}) => {
  const selection = selectionIn(root);
  if (!selection?.rangeCount || selection.getRangeAt(0).collapsed) return null;

  const range = selection.getRangeAt(0);
  if (!root.contains(range.commonAncestorContainer)) return null;

  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  for (const [name, value] of Object.entries(styles)) node.style[name] = value;

  try {
    node.appendChild(range.extractContents());
    range.insertNode(node);
    const next = document.createRange();
    next.selectNodeContents(node);
    select(root, next);
    return node;
  } catch {
    return null;
  }
};

// put content in at the caret, then hand back the last thing put in so the
// caller can settle the document before moving the caret on
export const insertAt = (root, markup) => {
  const range = rangeIn(root);
  if (!range) return null;
  range.deleteContents();

  const holder = document.createElement('div');
  holder.innerHTML = markup;
  const fragment = document.createDocumentFragment();
  let last = null;
  while (holder.firstChild) {
    last = holder.firstChild;
    fragment.append(last);
  }
  range.insertNode(fragment);
  return last;
};

// a block level thing belongs between the paragraphs, never inside the one the
// caret happens to be in
export const insertBeside = (root, holder, markup, blocks) => {
  const selection = selectionIn(root);
  const from = elementAt(selection?.anchorNode);
  const inside = from && holder.contains(from) ? blockOf(blocks, from) : null;

  const shelf = document.createElement('div');
  shelf.innerHTML = markup;
  const made = [...shelf.children];
  if (!made.length) return [];

  if (inside) inside.after(...made);
  else holder.append(...made);
  return made;
};
