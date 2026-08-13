import { JGApp, define, html, css } from '../core/app.js';
import { debounce, copyText, toast } from '../core/util.js';

const sheet = css`
  .shell { display: grid; grid-template-columns: 168px 1fr; gap: 12px; flex: 1; min-height: 0; }
  @media (max-width: 720px) { .shell { grid-template-columns: 1fr; } }
  .main { display: flex; flex-direction: column; gap: 10px; min-width: 0; min-height: 0; }
  .grid {
    flex: 1;
    min-height: 200px;
    overflow: auto;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(52px, 1fr));
    gap: 4px;
    padding: 6px;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--muted) 40%, transparent);
    scrollbar-width: thin;
    align-content: start;
  }
  .cell {
    appearance: none;
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    background: transparent;
    font-size: 25px;
    line-height: 1;
    aspect-ratio: 1;
    cursor: pointer;
    transition: background 0.1s ease, transform 0.1s ease;
  }
  .cell:hover { background: var(--card); border-color: var(--border); transform: scale(1.08); }
  .detail {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 14px;
    align-items: center;
    padding: 12px 14px;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
  }
  .detail .big { font-size: 42px; line-height: 1; }
  .codes { display: grid; gap: 3px; font-family: var(--font-mono); font-size: 12px; color: var(--muted-foreground); }
  .codes b { color: var(--foreground); font-weight: 500; font-family: var(--font-sans); font-size: 13px; }
  .recent { display: flex; flex-wrap: wrap; gap: 4px; }
  .recent button { font-size: 20px; background: none; border: 0; cursor: pointer; padding: 2px; }
`;

const GROUPS = [
  {
    id: 'smileys',
    label: 'Smileys',
    icon: 'emoji',
    items: '😀 😃 😄 😁 😆 😅 🤣 😂 🙂 🙃 😉 😊 😇 🥰 😍 🤩 😘 😗 😚 😙 🥲 😋 😛 😜 🤪 😝 🤑 🤗 🤭 🤫 🤔 🤐 🤨 😐 😑 😶 😏 😒 🙄 😬 🤥 😌 😔 😪 🤤 😴 😷 🤒 🤕 🤢 🤮 🤧 🥵 🥶 🥴 😵 🤯 🤠 🥳 🥸 😎 🤓 🧐 😕 😟 🙁 😮 😯 😲 😳 🥺 😦 😧 😨 😰 😥 😢 😭 😱 😖 😣 😞 😓 😩 😫 🥱 😤 😡 😠 🤬 😈 👿 💀 💩 🤡 👹 👺 👻 👽 🤖 😺 😸 😹 😻 😼 😽 🙀 😿 😾',
  },
  {
    id: 'people',
    label: 'People',
    icon: 'user',
    items: '👋 🤚 🖐 ✋ 🖖 👌 🤌 🤏 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 🖕 👇 ☝️ 👍 👎 ✊ 👊 🤛 🤜 👏 🙌 👐 🤲 🤝 🙏 ✍️ 💅 🤳 💪 🦾 🦵 🦶 👂 👃 🧠 🫀 🦷 👀 👁 👅 👄 👶 🧒 👦 👧 🧑 👨 👩 🧓 👴 👵 🙍 🙎 🙅 🙆 💁 🙋 🧏 🙇 🤦 🤷 👮 🕵️ 💂 👷 🤴 👸 👳 👲 🧕 🤵 👰 🤰 🤱 👼 🎅 🤶 🦸 🦹 🧙 🧚 🧛 🧜 🧝 🧞 🧟 💆 💇 🚶 🧍 🧎 🏃 💃 🕺 👯 🧖 🧗 🤺 🏇 ⛷ 🏂 🏌️ 🏄 🚣 🏊 ⛹️ 🏋️ 🚴 🚵 🤸 🤼 🤽 🤾 🤹 🧘 🛀 🛌',
  },
  {
    id: 'nature',
    label: 'Nature',
    icon: 'sparkles',
    items: '🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐽 🐸 🐵 🙈 🙉 🙊 🐒 🐔 🐧 🐦 🐤 🐣 🐥 🦆 🦅 🦉 🦇 🐺 🐗 🐴 🦄 🐝 🪲 🐛 🦋 🐌 🐞 🐜 🪰 🦗 🕷 🕸 🦂 🐢 🐍 🦎 🦖 🦕 🐙 🦑 🦐 🦞 🦀 🐡 🐠 🐟 🐬 🐳 🐋 🦈 🐊 🐅 🐆 🦓 🦍 🦧 🐘 🦛 🦏 🐪 🐫 🦒 🦘 🐃 🐂 🐄 🐎 🐖 🐏 🐑 🦙 🐐 🦌 🐕 🐩 🦮 🐈 🐓 🦃 🦤 🦚 🦜 🦢 🦩 🕊 🐇 🦝 🦨 🦡 🦫 🦦 🦥 🐁 🐀 🐿 🦔 🌵 🎄 🌲 🌳 🌴 🪵 🌱 🌿 ☘️ 🍀 🎍 🪴 🎋 🍃 🍂 🍁 🍄 🐚 🪨 🌾 💐 🌷 🌹 🥀 🌺 🌸 🌼 🌻 🌞 🌝 🌛 🌜 🌚 🌕 🌖 🌗 🌘 🌑 🌒 🌓 🌔 🌙 🌎 🌍 🌏 🪐 💫 ⭐️ 🌟 ✨ ⚡️ ☄️ 💥 🔥 🌪 🌈 ☀️ 🌤 ⛅️ 🌥 ☁️ 🌦 🌧 ⛈ 🌩 🌨 ❄️ ☃️ ⛄️ 🌬 💨 💧 💦 ☔️ ☂️ 🌊 🌫',
  },
  {
    id: 'food',
    label: 'Food',
    icon: 'scale',
    items: '🍏 🍎 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🫐 🍈 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🍆 🥑 🥦 🥬 🥒 🌶 🫑 🌽 🥕 🫒 🧄 🧅 🥔 🍠 🥐 🥯 🍞 🥖 🥨 🧀 🥚 🍳 🧈 🥞 🧇 🥓 🥩 🍗 🍖 🦴 🌭 🍔 🍟 🍕 🫓 🥪 🥙 🧆 🌮 🌯 🫔 🥗 🥘 🫕 🥫 🍝 🍜 🍲 🍛 🍣 🍱 🥟 🦪 🍤 🍙 🍚 🍘 🍥 🥠 🥮 🍢 🍡 🍧 🍨 🍦 🥧 🧁 🍰 🎂 🍮 🍭 🍬 🍫 🍿 🍩 🍪 🌰 🥜 🍯 🥛 🍼 🫖 ☕️ 🍵 🧃 🥤 🧋 🍶 🍺 🍻 🥂 🍷 🥃 🍸 🍹 🧉 🍾 🧊 🥄 🍴 🍽 🥣 🥡 🥢 🧂',
  },
  {
    id: 'travel',
    label: 'Travel',
    icon: 'globe',
    items: '🚗 🚕 🚙 🚌 🚎 🏎 🚓 🚑 🚒 🚐 🛻 🚚 🚛 🚜 🦯 🦽 🦼 🛴 🚲 🛵 🏍 🛺 🚨 🚔 🚍 🚘 🚖 🚡 🚠 🚟 🚃 🚋 🚞 🚝 🚄 🚅 🚈 🚂 🚆 🚇 🚊 🚉 ✈️ 🛫 🛬 🛩 💺 🛰 🚀 🛸 🚁 🛶 ⛵️ 🚤 🛥 🛳 ⛴ 🚢 ⚓️ 🪝 ⛽️ 🚧 🚦 🚥 🚏 🗺 🗿 🗽 🗼 🏰 🏯 🏟 🎡 🎢 🎠 ⛲️ ⛱ 🏖 🏝 🏜 🌋 ⛰ 🏔 🗻 🏕 ⛺️ 🛖 🏠 🏡 🏘 🏚 🏗 🏭 🏢 🏬 🏣 🏤 🏥 🏦 🏨 🏪 🏫 🏩 💒 🏛 ⛪️ 🕌 🕍 🛕 🕋 ⛩ 🛤 🛣 🗾 🎑 🏞 🌅 🌄 🌠 🎇 🎆 🌇 🌆 🏙 🌃 🌌 🌉 🌁',
  },
  {
    id: 'objects',
    label: 'Objects',
    icon: 'blocks',
    items: '⌚️ 📱 💻 ⌨️ 🖥 🖨 🖱 🖲 🕹 🗜 💽 💾 💿 📀 📼 📷 📸 📹 🎥 📽 🎞 📞 ☎️ 📟 📠 📺 📻 🎙 🎚 🎛 🧭 ⏱ ⏲ ⏰ 🕰 ⌛️ ⏳ 📡 🔋 🔌 💡 🔦 🕯 🪔 🧯 🛢 💸 💵 💴 💶 💷 🪙 💰 💳 💎 ⚖️ 🪜 🧰 🪛 🔧 🔨 ⚒ 🛠 ⛏ 🪚 🔩 ⚙️ 🪤 🧱 ⛓ 🧲 🔫 💣 🧨 🪓 🔪 🗡 ⚔️ 🛡 🚬 ⚰️ ⚱️ 🏺 🔮 📿 🧿 💈 ⚗️ 🔭 🔬 🕳 🩹 🩺 💊 💉 🩸 🧬 🦠 🧫 🧪 🌡 🧹 🪠 🧺 🧻 🚽 🚰 🚿 🛁 🧼 🪥 🪒 🧽 🪣 🧴 🛎 🔑 🗝 🚪 🪑 🛋 🛏 🛌 🧸 🖼 🪞 🪟 🛍 🛒 🎁 🎈 🎏 🎀 🪄 🪅 🎊 🎉 🪆 📩 📨 📧 💌 📥 📤 📦 🏷 📪 📫 📬 📭 📮 📯 📜 📃 📄 📑 📊 📈 📉 🗒 🗓 📆 📅 🗑 📇 🗃 🗳 🗄 📋 📁 📂 🗂 🗞 📰 📓 📔 📒 📕 📗 📘 📙 📚 📖 🔖 🧷 🔗 📎 🖇 📐 📏 🧮 📌 📍 ✂️ 🖊 🖋 ✒️ 🖌 🖍 📝 ✏️ 🔍 🔎 🔏 🔐 🔒 🔓',
  },
  {
    id: 'symbols',
    label: 'Symbols',
    icon: 'asterisk',
    items: '❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 💟 ☮️ ✝️ ☪️ 🕉 ☸️ ✡️ 🔯 🕎 ☯️ ☦️ 🛐 ⛎ ♈️ ♉️ ♊️ ♋️ ♌️ ♍️ ♎️ ♏️ ♐️ ♑️ ♒️ ♓️ 🆔 ⚛️ 🉑 ☢️ ☣️ 📴 📳 🈶 🈚️ 🈸 🈺 🈷️ ✴️ 🆚 💮 🉐 ㊙️ ㊗️ 🈴 🈵 🈹 🈲 🅰️ 🅱️ 🆎 🆑 🅾️ 🆘 ❌ ⭕️ 🛑 ⛔️ 📛 🚫 💯 💢 ♨️ 🚷 🚯 🚳 🚱 🔞 📵 🚭 ❗️ ❕ ❓ ❔ ‼️ ⁉️ 🔅 🔆 〽️ ⚠️ 🚸 🔱 ⚜️ 🔰 ♻️ ✅ 🈯️ 💹 ❇️ ✳️ ❎ 🌐 💠 Ⓜ️ 🌀 💤 🏧 🚾 ♿️ 🅿️ 🛗 🈳 🈂️ 🛂 🛃 🛄 🛅 🚹 🚺 🚼 ⚧ 🚻 🚮 🎦 📶 🈁 🔣 ℹ️ 🔤 🔡 🔠 🆖 🆗 🆙 🆒 🆕 🆓 0️⃣ 1️⃣ 2️⃣ 3️⃣ 4️⃣ 5️⃣ 6️⃣ 7️⃣ 8️⃣ 9️⃣ 🔟 🔢 #️⃣ *️⃣ ⏏️ ▶️ ⏸ ⏯ ⏹ ⏺ ⏭ ⏮ ⏩ ⏪ ⏫ ⏬ ◀️ 🔼 🔽 ➡️ ⬅️ ⬆️ ⬇️ ↗️ ↘️ ↙️ ↖️ ↕️ ↔️ ↪️ ↩️ ⤴️ ⤵️ 🔀 🔁 🔂 🔄 🔃 ➕ ➖ ➗ ✖️ ♾ 💲 💱 ™️ ©️ ®️ 〰️ ➰ ➿ 🔚 🔙 🔛 🔝 🔜 ✔️ ☑️ 🔘 🔴 🟠 🟡 🟢 🔵 🟣 ⚫️ ⚪️ 🟤 🔺 🔻 🔸 🔹 🔶 🔷 🔳 🔲 ▪️ ▫️ ◾️ ◽️ ◼️ ◻️ 🟥 🟧 🟨 🟩 🟦 🟪 ⬛️ ⬜️ 🟫 🔈 🔇 🔉 🔊 🔔 🔕 📣 📢 👁‍🗨 💬 💭 🗯 ♠️ ♣️ ♥️ ♦️ 🃏 🎴 🀄️ 🕐 🕑 🕒 🕓 🕔 🕕 🕖 🕗 🕘 🕙 🕚 🕛',
  },
  {
    id: 'flags',
    label: 'Flags',
    icon: 'badge',
    items: '🏳️ 🏴 🏁 🚩 🏳️‍🌈 🏳️‍⚧️ 🏴‍☠️ 🇦🇪 🇦🇹 🇦🇺 🇧🇪 🇧🇷 🇨🇦 🇨🇭 🇨🇳 🇨🇿 🇩🇪 🇩🇰 🇪🇸 🇪🇺 🇫🇮 🇫🇷 🇬🇧 🇬🇷 🇭🇰 🇮🇩 🇮🇪 🇮🇱 🇮🇳 🇮🇷 🇮🇸 🇮🇹 🇯🇵 🇰🇷 🇲🇽 🇲🇾 🇳🇱 🇳🇴 🇳🇿 🇵🇭 🇵🇱 🇵🇹 🇷🇴 🇷🇺 🇸🇦 🇸🇪 🇸🇬 🇹🇭 🇹🇷 🇺🇦 🇺🇸 🇻🇳 🇿🇦',
  },
];

const NAMES = {
  '😀': 'grinning face', '😂': 'face with tears of joy', '🙂': 'slightly smiling face',
  '😍': 'smiling face with heart eyes', '🤔': 'thinking face', '😭': 'loudly crying face',
  '👍': 'thumbs up', '👎': 'thumbs down', '🙏': 'folded hands', '🔥': 'fire', '🎉': 'party popper',
  '❤️': 'red heart', '✅': 'check mark button', '❌': 'cross mark', '🚀': 'rocket', '🐛': 'bug',
  '💡': 'light bulb', '📦': 'package', '⚡️': 'high voltage', '🧠': 'brain',
};

const codePoints = (emoji) => [...emoji].map((character) => character.codePointAt(0).toString(16).toUpperCase().padStart(4, '0'));

class EmojiPicker extends JGApp {
  static appId = 'emoji-picker';
  static styles = [...JGApp.styles, sheet];

  #group = 'smileys';
  #query = '';
  #selected = '😀';

  renderApp() {
    this.paint(html`<div class="app">
      <div class="row">
        <jg-input id="search" size="sm" placeholder="Search by name or paste an emoji" style="flex:1;min-width:180px"></jg-input>
        <jg-button size="sm" variant="ghost" id="clear-recent">Clear recent</jg-button>
      </div>

      <div class="recent" id="recent"></div>

      <div class="shell">
        <jg-toolbar id="groups" variant="sidebar"></jg-toolbar>
        <div class="main">
          <div class="grid" id="grid"></div>
          <div class="detail">
            <span class="big" id="big">${this.#selected}</span>
            <div class="codes" id="codes"></div>
          </div>
          <div class="row">
            <jg-button size="sm" variant="outline" id="copy-emoji">Copy emoji</jg-button>
            <jg-button size="sm" variant="ghost" id="copy-code">Copy code point</jg-button>
            <jg-button size="sm" variant="ghost" id="copy-html">Copy HTML entity</jg-button>
          </div>
        </div>
      </div>
    </div>`);

    const groups = this.$('#groups');
    groups.items = GROUPS.map((group) => ({ id: group.id, label: group.label, icon: group.icon, select: true }));
    groups.value = this.#group;
    this.on(groups, 'select', (event) => {
      this.#group = event.detail.id;
      this.#paintGrid();
    });

    this.on(this.$('#search'), 'input', debounce((event) => {
      this.#query = event.target.value.trim().toLowerCase();
      this.#paintGrid();
    }, 140));

    this.on(this.$('#copy-emoji'), 'click', () => copyText(this.#selected));
    this.on(this.$('#copy-code'), 'click', () => copyText(codePoints(this.#selected).map((point) => `U+${point}`).join(' ')));
    this.on(this.$('#copy-html'), 'click', () =>
      copyText([...this.#selected].map((character) => `&#x${character.codePointAt(0).toString(16)};`).join('')),
    );
    this.on(this.$('#clear-recent'), 'click', () => {
      this.store.write({ recent: [] });
      this.#paintRecent();
    });

    this.#paintGrid();
    this.#paintRecent();
    this.#select(this.#selected);
  }

  #items() {
    const all = GROUPS.flatMap((group) => group.items.split(' ').filter(Boolean).map((emoji) => ({ emoji, group: group.id })));
    if (!this.#query) return all.filter((item) => item.group === this.#group).map((item) => item.emoji);
    return all
      .filter((item) => {
        const name = NAMES[item.emoji] ?? '';
        return item.emoji.includes(this.#query) || name.includes(this.#query) || codePoints(item.emoji).join(' ').toLowerCase().includes(this.#query);
      })
      .map((item) => item.emoji);
  }

  #paintGrid() {
    const items = this.#items();
    this.$('#grid').innerHTML = items.length
      ? items.map((emoji) => html`<button class="cell" data-emoji="${emoji}" title="${NAMES[emoji] ?? ''}">${emoji}</button>`).join('')
      : html`<div class="hint" style="grid-column:1/-1;padding:12px">No emoji matches "${this.#query}".</div>`;

    this.bind('[data-emoji]', 'click', (event) => {
      const emoji = event.currentTarget.dataset.emoji;
      this.#select(emoji);
      this.#remember(emoji);
      copyText(emoji);
      toast(`${emoji} copied`);
    });
  }

  #paintRecent() {
    const recent = this.store.read({ recent: [] }).recent ?? [];
    const node = this.$('#recent');
    node.innerHTML = recent.length
      ? recent.map((emoji) => html`<button data-recent="${emoji}">${emoji}</button>`).join('')
      : html`<span class="hint">Picked emoji land here.</span>`;

    this.bind('[data-recent]', 'click', (event) => {
      const emoji = event.currentTarget.dataset.recent;
      this.#select(emoji);
      copyText(emoji);
      toast(`${emoji} copied`);
    });
  }

  #remember(emoji) {
    const data = this.store.read({ recent: [] });
    data.recent = [emoji, ...(data.recent ?? []).filter((item) => item !== emoji)].slice(0, 24);
    this.store.write(data);
    this.#paintRecent();
  }

  #select(emoji) {
    this.#selected = emoji;
    this.$('#big').textContent = emoji;
    const points = codePoints(emoji);
    this.$('#codes').innerHTML = html`
      <b>${NAMES[emoji] ?? 'emoji'}</b>
      <span>${points.map((point) => `U+${point}`).join(' ')}</span>
      <span>${[...emoji].map((character) => `&#x${character.codePointAt(0).toString(16)};`).join('')}</span>
      <span>${encodeURIComponent(emoji)}</span>
    `;
  }
}

define('jg-app-emoji-picker', EmojiPicker);
