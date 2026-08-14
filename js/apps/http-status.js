import { JGApp, define, html, css } from '../core/app.js';
import { debounce } from '../core/util.js';

const sheet = css`
  .group { margin-bottom: 16px; }
  .group h3 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted-foreground); margin: 0 0 8px; }
  .status {
    display: grid;
    grid-template-columns: 58px 1fr;
    gap: 12px;
    padding: 10px 12px;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--card);
    margin-bottom: 6px;
  }
  .code { font: 700 17px/1.2 var(--font-mono); }
  .status[data-class="1"] .code { color: #60a5fa; }
  .status[data-class="2"] .code { color: var(--success); }
  .status[data-class="3"] .code { color: var(--warning); }
  .status[data-class="4"] .code { color: #fb923c; }
  .status[data-class="5"] .code { color: var(--destructive); }
  .name { font-size: 13.5px; font-weight: 600; }
  .desc { font-size: 12.5px; color: var(--muted-foreground); }
`;

const STATUSES = [
  [100, 'Continue', 'The client should continue with its request.'],
  [101, 'Switching Protocols', 'The server is switching protocols as requested, for example to WebSocket.'],
  [103, 'Early Hints', 'Preload hints sent before the final response.'],
  [200, 'OK', 'The request succeeded.'],
  [201, 'Created', 'The request succeeded and a new resource was created.'],
  [202, 'Accepted', 'The request was accepted but processing is not complete.'],
  [204, 'No Content', 'Success, but there is no body to return.'],
  [206, 'Partial Content', 'The server is delivering part of the resource, used for range requests.'],
  [301, 'Moved Permanently', 'The resource has a new permanent URL.'],
  [302, 'Found', 'The resource is temporarily at a different URL.'],
  [303, 'See Other', 'Fetch the result of the request at another URL with GET.'],
  [304, 'Not Modified', 'The cached version is still valid.'],
  [307, 'Temporary Redirect', 'Like 302, but the method must not change.'],
  [308, 'Permanent Redirect', 'Like 301, but the method must not change.'],
  [400, 'Bad Request', 'The server could not understand the request.'],
  [401, 'Unauthorized', 'Authentication is required or has failed.'],
  [402, 'Payment Required', 'Reserved for future or payment-gated use.'],
  [403, 'Forbidden', 'The server understood but refuses to authorize it.'],
  [404, 'Not Found', 'The server cannot find the requested resource.'],
  [405, 'Method Not Allowed', 'The method is known but not supported for this resource.'],
  [408, 'Request Timeout', 'The server timed out waiting for the request.'],
  [409, 'Conflict', 'The request conflicts with the current state of the resource.'],
  [410, 'Gone', 'The resource has been permanently removed.'],
  [413, 'Payload Too Large', 'The request body is larger than the server accepts.'],
  [415, 'Unsupported Media Type', 'The payload format is not supported.'],
  [418, "I'm a teapot", 'The server refuses to brew coffee, as specified by RFC 2324.'],
  [422, 'Unprocessable Content', 'The request was well formed but semantically invalid.'],
  [429, 'Too Many Requests', 'The client sent too many requests in a given amount of time.'],
  [451, 'Unavailable For Legal Reasons', 'Access denied for legal reasons.'],
  [500, 'Internal Server Error', 'The server hit an unexpected condition.'],
  [501, 'Not Implemented', 'The server does not support the functionality required.'],
  [502, 'Bad Gateway', 'An upstream server returned an invalid response.'],
  [503, 'Service Unavailable', 'The server is overloaded or down for maintenance.'],
  [504, 'Gateway Timeout', 'An upstream server did not respond in time.'],
  [505, 'HTTP Version Not Supported', 'The HTTP version used is not supported.'],
];

const CLASSES = {
  1: 'Informational',
  2: 'Success',
  3: 'Redirection',
  4: 'Client error',
  5: 'Server error',
};

class HttpStatus extends JGApp {
  static appId = 'http-status';
  static styles = [...JGApp.styles, sheet];

  renderApp() {
    this.paint(html`<div class="app">
      <jg-input id="search" placeholder="Search by code or meaning - 404, timeout, redirect"></jg-input>
      <div class="row"><jg-tabs id="filter"></jg-tabs></div>
      <div id="list"></div>
    </div>`);

    this.$('#filter').items = [
      { value: 'all', label: 'All' },
      ...Object.entries(CLASSES).map(([key, label]) => ({ value: key, label: `${key}xx ${label}` })),
    ];

    this.on(this.$('#search'), 'input', debounce(() => this.#run(), 120));
    this.on(this.$('#filter'), 'change', () => this.#run());
    this.#run();
  }

  #run() {
    const query = this.$('#search').value.trim().toLowerCase();
    const filter = this.$('#filter').value;
    const matches = STATUSES.filter(([code, name, description]) => {
      if (filter !== 'all' && String(code)[0] !== filter) return false;
      if (!query) return true;
      return `${code} ${name} ${description}`.toLowerCase().includes(query);
    });

    const groups = [...new Set(matches.map(([code]) => String(code)[0]))];
    this.$('#list').innerHTML = matches.length
      ? groups
          .map(
            (group) => html`<div class="group">
              <h3>${group}xx - ${CLASSES[group]}</h3>
              ${matches
                .filter(([code]) => String(code)[0] === group)
                .map(
                  ([code, name, description]) => html`<div class="status" data-class="${group}">
                    <span class="code">${code}</span>
                    <span><span class="name">${name}</span><span class="desc"> - ${description}</span></span>
                  </div>`,
                )}
            </div>`,
          )
          .join('')
      : html`<jg-empty glyph="⌕" title="No matches">Try a code like 404 or a word like "timeout".</jg-empty>`;
  }
}

define('jg-app-http-status', HttpStatus);
