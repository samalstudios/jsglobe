import { css } from '../core/dom.js';

export const base = css`
  :host {
    display: block;
    box-sizing: border-box;
    color: var(--foreground);
    font-family: var(--font-sans);
    font-size: 14px;
    line-height: 1.5;
  }
  *, *::before, *::after { box-sizing: border-box; }
  h1, h2, h3, h4, p, figure, ul, ol { margin: 0; }
  ul, ol { padding: 0; list-style: none; }
  a { color: var(--ring); text-decoration: none; }
  a:hover { text-decoration: underline; }
  ::selection { background: color-mix(in srgb, var(--ring) 40%, transparent); }
  :focus-visible { outline: none; box-shadow: var(--shadow-ring); border-radius: var(--radius-sm); }
  .scroll { overflow: auto; scrollbar-width: thin; scrollbar-color: var(--border-strong) transparent; }
  .scroll::-webkit-scrollbar { width: 10px; height: 10px; }
  .scroll::-webkit-scrollbar-thumb {
    background: var(--border-strong);
    border-radius: 999px;
    border: 3px solid transparent;
    background-clip: content-box;
  }
  .scroll::-webkit-scrollbar-track { background: transparent; }
`;

export const layout = css`
  .app {
    display: flex;
    flex-direction: column;
    gap: 14px;
    height: 100%;
    padding: 18px;
    overflow: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--border-strong) transparent;
  }
  .app::-webkit-scrollbar { width: 10px; }
  .app::-webkit-scrollbar-thumb {
    background: var(--border-strong);
    border-radius: 999px;
    border: 3px solid transparent;
    background-clip: content-box;
  }
  .row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .row.tight { gap: 6px; }
  .row.nowrap { flex-wrap: nowrap; }
  .spread { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .stack { display: flex; flex-direction: column; gap: 10px; }
  .stack.tight { gap: 6px; }
  .grow { flex: 1; min-width: 0; }
  .cols {
    display: grid;
    gap: 14px;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    align-items: start;
  }
  .cols.equal { grid-template-columns: 1fr 1fr; }
  @media (max-width: 720px) { .cols.equal { grid-template-columns: 1fr; } }
  .fill { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 10px; }
  .sep { height: 1px; background: var(--border); border: 0; margin: 2px 0; }
  .muted { color: var(--muted-foreground); }
  .mono { font-family: var(--font-mono); font-variant-ligatures: none; }
  .tiny { font-size: 12px; }
  .strong { font-weight: 600; }
  .title { font-size: 15px; font-weight: 600; letter-spacing: -0.01em; }
  .label {
    font-size: 12px;
    font-weight: 500;
    color: var(--muted-foreground);
    letter-spacing: 0.01em;
  }
  .hint { font-size: 12px; color: var(--muted-foreground); }
  .error { color: var(--destructive); font-size: 13px; }
  .center { display: grid; place-items: center; text-align: center; }
  .wrap-anywhere { overflow-wrap: anywhere; word-break: break-word; }
`;

export const panel = css`
  .panel {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 14px;
  }
  .panel.flush { padding: 0; overflow: hidden; }
  .panel.soft { background: color-mix(in srgb, var(--muted) 70%, transparent); }
  .panel-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 10px 12px;
    border-bottom: 1px solid var(--border);
  }
  .panel-body { padding: 12px; }
  .kv { display: grid; grid-template-columns: minmax(120px, 34%) 1fr; gap: 1px; }
  .kv > div {
    padding: 8px 10px;
    background: var(--card);
    font-size: 13px;
    overflow-wrap: anywhere;
  }
  .kv > div:nth-child(odd) { color: var(--muted-foreground); font-weight: 500; }
  .kv > div:nth-child(4n + 1), .kv > div:nth-child(4n + 2) {
    background: color-mix(in srgb, var(--muted) 55%, transparent);
  }
  .list { display: flex; flex-direction: column; gap: 6px; }
  .list-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 11px;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--card);
  }
  .list-item:hover { border-color: var(--border-strong); }
  .empty {
    display: grid;
    place-items: center;
    gap: 6px;
    padding: 32px 16px;
    border: 1px dashed var(--border);
    border-radius: var(--radius-lg);
    color: var(--muted-foreground);
    text-align: center;
  }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--border); }
  th { color: var(--muted-foreground); font-weight: 500; font-size: 12px; }
  tbody tr:hover { background: color-mix(in srgb, var(--muted) 60%, transparent); }
`;

export const code = css`
  .code {
    font-family: var(--font-mono);
    font-size: 12.5px;
    line-height: 1.65;
    background: color-mix(in srgb, var(--muted) 75%, transparent);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 12px;
    margin: 0;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    overflow: auto;
    color: var(--foreground);
  }
  .code.tall { min-height: 180px; }
  .result {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--muted) 70%, transparent);
    font-family: var(--font-mono);
    font-size: 13px;
    overflow-wrap: anywhere;
  }
  .result .grow { user-select: all; }
`;

export const appSheets = [base, layout, panel, code];
