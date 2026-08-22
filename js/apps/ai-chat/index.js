import { JGApp, define, html, styleSheet } from '../../core/app.js';
import { appText } from '../../core/i18n.js';
import strings from './i18n.js';
import { ai } from '../../core/ai.js';
import { copyText, download } from '../../core/util.js';
import '../../ui/jg-ai-bar.js';

const t = appText(strings);

const sheet = await styleSheet(import.meta.url);

const PRESETS = [
  ['Explain', 'Explain this clearly and concisely.'],
  ['Improve', 'Rewrite this to be clearer and shorter.'],
  ['Brainstorm', 'Give me five different ideas for this.'],
  ['Debug', 'Find the bug in this code and explain the fix.'],
];

class AiChat extends JGApp {
  static appId = 'ai-chat';
  static settings = [
    { key: 'system', label: t('ai-chat.systemPrompt', 'System prompt'), type: 'text', default: 'You are a concise, accurate assistant for developers.' },
  ];
  static styles = [...JGApp.styles, sheet];

  #controller = null;

  #thread() {
    return this.store.read([]);
  }

  #save(messages) {
    this.store.write(messages.slice(-40));
  }

  renderWidget() {
    const thread = this.#thread();
    const last = [...thread].reverse().find((message) => message.role === 'assistant');
    this.paint(html`<div class="app" style="padding:12px">
      <div class="label">${t('ai-chat.localAi', 'Local AI')}</div>
      <div class="hint" style="flex:1;overflow:hidden">${last ? last.content.slice(0, 160) : 'No conversation yet.'}</div>
      <jg-button size="sm" variant="outline" id="open">${t('ai-chat.openChat', 'Open chat')}</jg-button>
    </div>`);
    this.on(this.$('#open'), 'click', () => {
      window.location.assign('/ai-chat');
    });
  }

  renderApp() {
    this.paint(html`<div class="app">
      <jg-ai-bar></jg-ai-bar>

      <jg-field label="${t('ai-chat.systemPrompt', 'System prompt')}" hint="${t('ai-chat.setsTheBehaviourForThe', 'Sets the behaviour for the whole conversation')}">
        <jg-input id="system" value="${this.config.get('system', 'You are a concise, accurate assistant for developers.')}"></jg-input>
      </jg-field>

      <div class="row">
        ${PRESETS.map((preset) => html`<jg-button size="sm" variant="outline" data-preset="${preset[1]}">${preset[0]}</jg-button>`)}
        <span class="grow"></span>
        <jg-button size="sm" variant="ghost" id="export">${t('ai-chat.export', 'Export')}</jg-button>
        <jg-button size="sm" variant="ghost" id="clear">${t('ai-chat.clear', 'Clear')}</jg-button>
      </div>

      <div class="thread" id="thread"></div>

      <div class="composer">
        <jg-textarea id="input" rows="2" sans class="grow" placeholder="${t('ai-chat.askAnythingShiftEnterFor', 'Ask anything. Shift+Enter for a new line.')}"></jg-textarea>
        <jg-button id="send">${t('ai-chat.send', 'Send')}</jg-button>
        <jg-button id="stop" variant="outline" hidden>${t('ai-chat.stop', 'Stop')}</jg-button>
      </div>
    </div>`);

    this.on(this.$('#system'), 'change', (event) => this.config.set('system', event.detail.value));
    this.on(this.$('#send'), 'click', () => this.#send());
    this.on(this.$('#stop'), 'click', () => this.#controller?.abort());
    this.on(this.$('#clear'), 'click', () => {
      this.#save([]);
      this.#paintThread();
    });
    this.on(this.$('#export'), 'click', () =>
      download(
        'conversation.md',
        this.#thread().map((message) => `**${message.role}**\n\n${message.content}`).join('\n\n---\n\n'),
        'text/markdown',
      ),
    );
    this.bind('[data-preset]', 'click', (event) => {
      const input = this.$('#input');
      input.value = `${event.currentTarget.dataset.preset}\n\n${input.value}`;
      input.focus();
    });
    this.on(this.$('#input'), 'keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        this.#send();
      }
    });

    this.#paintThread();
  }

  #paintThread(streaming = '') {
    const thread = this.#thread();
    const node = this.$('#thread');
    if (!node) return;

    if (!thread.length && !streaming) {
      node.innerHTML = html`<jg-empty glyph="✦" title="${t('ai-chat.nothingYet', 'Nothing yet')}">${t('ai-chat.everythingYouTypeStaysOn', 'Everything you type stays on this device.')}</jg-empty>`;
      return;
    }

    node.innerHTML = [
      ...thread.map(
        (message) => html`<div class="msg" data-role="${message.role}">
          <span class="who">${message.role === 'user' ? 'YOU' : 'AI'}</span>
          <span class="bubble">${message.content}</span>
          <span class="actions"><jg-button size="icon-sm" variant="ghost" data-copy="${message.content}">⧉</jg-button></span>
        </div>`,
      ),
      streaming
        ? html`<div class="msg" data-role="assistant">
            <span class="who">${t('ai-chat.ai', 'AI')}</span>
            <span class="bubble caret">${streaming}</span>
          </div>`
        : '',
    ].join('');

    node.scrollTop = node.scrollHeight;
    this.$$('[data-copy]').forEach((button) =>
      button.addEventListener('click', () => copyText(button.dataset.copy)),
    );
  }

  async #send() {
    const input = this.$('#input');
    const content = input.value.trim();
    if (!content) return;

    const thread = [...this.#thread(), { role: 'user', content }];
    this.#save(thread);
    input.value = '';
    this.#paintThread();

    this.#controller = new AbortController();
    this.$('#stop').hidden = false;
    this.$('#send').setAttribute('disabled', '');

    const messages = [{ role: 'system', content: this.$('#system').value }, ...thread];

    try {
      const answer = await ai.chat(messages, {
        signal: this.#controller.signal,
        onDelta: (delta, text) => this.#paintThread(text),
      });
      this.#save([...thread, { role: 'assistant', content: answer }]);
    } catch (error) {
      this.#save([...thread, { role: 'assistant', content: `Could not complete that request. ${error.message}` }]);
    } finally {
      this.#controller = null;
      const stop = this.$('#stop');
      const send = this.$('#send');
      if (stop) stop.hidden = true;
      if (send) send.removeAttribute('disabled');
      this.#paintThread();
    }
  }
}

define('jg-app-ai-chat', AiChat);
