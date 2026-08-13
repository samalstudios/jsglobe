import { JGApp, define, html, css } from '../core/app.js';
import { toYaml, fromYaml } from '../core/yaml.js';
import { debounce, copyText, download } from '../core/util.js';

const sheet = css`
  .split { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; flex: 1; min-height: 0; }
  @media (max-width: 860px) { .split { grid-template-columns: 1fr; } }
  .pane { display: flex; flex-direction: column; gap: 6px; min-width: 0; min-height: 0; }
`;

const SAMPLE_RUN = `docker run -d --name web --restart unless-stopped \\
  -p 8080:80 -p 8443:443 \\
  -e NODE_ENV=production -e TZ=Europe/Berlin \\
  -v /srv/site:/usr/share/nginx/html:ro \\
  --network edge --memory 512m \\
  nginx:1.27-alpine nginx -g 'daemon off;'`;

const FLAG_ALIASES = {
  '-d': '--detach',
  '-e': '--env',
  '-p': '--publish',
  '-v': '--volume',
  '-w': '--workdir',
  '-u': '--user',
  '-i': '--interactive',
  '-t': '--tty',
  '-h': '--hostname',
  '-l': '--label',
  '-m': '--memory',
};

const VALUE_FLAGS = new Set([
  '--name', '--env', '--publish', '--volume', '--workdir', '--user', '--hostname', '--label',
  '--restart', '--network', '--memory', '--cpus', '--entrypoint', '--env-file', '--add-host',
  '--device', '--tmpfs', '--shm-size', '--health-cmd', '--health-interval', '--pull', '--platform',
  '--log-driver', '--stop-signal', '--cap-add', '--cap-drop', '--dns', '--expose', '--link',
]);

const tokenize = (input) => {
  const text = input.replace(/\\\r?\n/g, ' ').trim();
  const tokens = [];
  let current = '';
  let quote = null;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quote) {
      if (character === quote) quote = null;
      else current += character;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (/\s/.test(character)) {
      if (current) tokens.push(current);
      current = '';
      continue;
    }
    current += character;
  }
  if (current) tokens.push(current);
  return tokens;
};

const toCompose = (command) => {
  const tokens = tokenize(command);
  const start = tokens.findIndex((token) => token === 'run');
  if (tokens[0] !== 'docker' || start < 0) throw new Error('Expected a command starting with "docker run"');

  const service = {};
  const ports = [];
  const env = [];
  const volumes = [];
  const labels = [];
  const capAdd = [];
  const capDrop = [];
  const networks = [];
  const devices = [];
  const extraHosts = [];

  let index = start + 1;
  let image = null;
  const rest = [];

  while (index < tokens.length) {
    let token = tokens[index];

    if (!token.startsWith('-')) {
      image = token;
      rest.push(...tokens.slice(index + 1));
      break;
    }

    let value = null;
    if (token.includes('=') && token.startsWith('--')) {
      [token, value] = [token.slice(0, token.indexOf('=')), token.slice(token.indexOf('=') + 1)];
    }

    if (/^-[a-zA-Z]{2,}$/.test(token)) {
      tokens.splice(index, 1, ...[...token.slice(1)].map((letter) => `-${letter}`));
      token = tokens[index];
    }

    const flag = FLAG_ALIASES[token] ?? token;
    if (value === null && VALUE_FLAGS.has(flag)) {
      index += 1;
      value = tokens[index] ?? '';
    }

    if (flag === '--name') service.container_name = value;
    else if (flag === '--publish') ports.push(value);
    else if (flag === '--expose') ports.push(value);
    else if (flag === '--env') env.push(value);
    else if (flag === '--env-file') service.env_file = [...(service.env_file ?? []), value];
    else if (flag === '--volume' || flag === '--tmpfs') volumes.push(value);
    else if (flag === '--label') labels.push(value);
    else if (flag === '--network') networks.push(value);
    else if (flag === '--device') devices.push(value);
    else if (flag === '--add-host') extraHosts.push(value);
    else if (flag === '--cap-add') capAdd.push(value);
    else if (flag === '--cap-drop') capDrop.push(value);
    else if (flag === '--restart') service.restart = value;
    else if (flag === '--workdir') service.working_dir = value;
    else if (flag === '--user') service.user = value;
    else if (flag === '--hostname') service.hostname = value;
    else if (flag === '--entrypoint') service.entrypoint = value;
    else if (flag === '--memory') service.mem_limit = value;
    else if (flag === '--cpus') service.cpus = Number(value);
    else if (flag === '--shm-size') service.shm_size = value;
    else if (flag === '--platform') service.platform = value;
    else if (flag === '--stop-signal') service.stop_signal = value;
    else if (flag === '--privileged') service.privileged = true;
    else if (flag === '--interactive') service.stdin_open = true;
    else if (flag === '--tty') service.tty = true;
    else if (flag === '--init') service.init = true;
    else if (flag === '--read-only') service.read_only = true;
    else if (flag === '--rm' || flag === '--detach') service.restart = service.restart ?? (flag === '--rm' ? 'no' : service.restart);

    index += 1;
  }

  if (!image) throw new Error('No image found in the command');

  const name = service.container_name ?? image.split('/').pop().split(':')[0];
  const body = { image, ...service };
  if (ports.length) body.ports = ports;
  if (env.length) body.environment = env;
  if (volumes.length) body.volumes = volumes;
  if (labels.length) body.labels = labels;
  if (networks.length) body.networks = networks;
  if (devices.length) body.devices = devices;
  if (extraHosts.length) body.extra_hosts = extraHosts;
  if (capAdd.length) body.cap_add = capAdd;
  if (capDrop.length) body.cap_drop = capDrop;
  if (rest.length) body.command = rest;

  const compose = { services: { [name]: body } };
  if (networks.length) compose.networks = Object.fromEntries(networks.map((network) => [network, { external: true }]));

  return toYaml(compose);
};

const quote = (value) => (/[\s'"$;&|<>()]/.test(String(value)) ? `'${String(value).replace(/'/g, `'\\''`)}'` : String(value));

const toRun = (yaml) => {
  const parsed = fromYaml(yaml);
  const services = parsed?.services ?? {};
  const names = Object.keys(services);
  if (!names.length) throw new Error('No services found in the compose file');

  return names
    .map((name) => {
      const service = services[name];
      const parts = ['docker run -d'];
      parts.push(`--name ${quote(service.container_name ?? name)}`);
      if (service.restart) parts.push(`--restart ${quote(service.restart)}`);
      if (service.hostname) parts.push(`--hostname ${quote(service.hostname)}`);
      if (service.user) parts.push(`--user ${quote(service.user)}`);
      if (service.working_dir) parts.push(`--workdir ${quote(service.working_dir)}`);
      if (service.mem_limit) parts.push(`--memory ${quote(service.mem_limit)}`);
      if (service.cpus) parts.push(`--cpus ${service.cpus}`);
      if (service.privileged) parts.push('--privileged');
      if (service.read_only) parts.push('--read-only');
      if (service.init) parts.push('--init');
      if (service.stdin_open) parts.push('-i');
      if (service.tty) parts.push('-t');

      [].concat(service.ports ?? []).forEach((port) => parts.push(`-p ${quote(port)}`));
      const environment = service.environment;
      if (Array.isArray(environment)) environment.forEach((entry) => parts.push(`-e ${quote(entry)}`));
      else if (environment && typeof environment === 'object') {
        Object.entries(environment).forEach(([key, value]) => parts.push(`-e ${quote(`${key}=${value}`)}`));
      }
      [].concat(service.env_file ?? []).forEach((file) => parts.push(`--env-file ${quote(file)}`));
      [].concat(service.volumes ?? []).forEach((volume) => parts.push(`-v ${quote(volume)}`));
      [].concat(service.labels ?? []).forEach((label) => parts.push(`-l ${quote(label)}`));
      [].concat(service.networks ?? []).forEach((network) => parts.push(`--network ${quote(network)}`));
      [].concat(service.cap_add ?? []).forEach((cap) => parts.push(`--cap-add ${quote(cap)}`));
      [].concat(service.cap_drop ?? []).forEach((cap) => parts.push(`--cap-drop ${quote(cap)}`));
      [].concat(service.extra_hosts ?? []).forEach((host) => parts.push(`--add-host ${quote(host)}`));
      if (service.entrypoint) parts.push(`--entrypoint ${quote(service.entrypoint)}`);

      parts.push(quote(service.image ?? name));
      if (Array.isArray(service.command)) parts.push(service.command.map(quote).join(' '));
      else if (service.command) parts.push(String(service.command));

      return parts.join(' \\\n  ');
    })
    .join('\n\n');
};

class DockerCompose extends JGApp {
  static appId = 'docker-compose';
  static styles = [...JGApp.styles, sheet];

  #direction = 'to-compose';

  renderApp() {
    this.paint(html`<div class="app">
      <jg-toolbar id="bar"></jg-toolbar>

      <div class="split">
        <div class="pane">
          <span class="label" id="in-label">docker run command</span>
          <jg-code id="input" grow gutter language="shell" placeholder="docker run -p 80:80 nginx"></jg-code>
        </div>
        <div class="pane">
          <span class="label" id="out-label">compose.yaml</span>
          <jg-code id="output" grow gutter language="yaml" readonly></jg-code>
        </div>
      </div>

      <div class="row">
        <jg-badge id="status" tone="muted">Waiting</jg-badge>
        <span class="grow"></span>
        <span class="hint">Compose v2 syntax, no version key</span>
      </div>
    </div>`);

    this.$('#bar').items = [
      { id: 'to-compose', label: 'Run to Compose', icon: 'docker', select: true },
      { id: 'to-run', label: 'Compose to Run', icon: 'transform', select: true },
      { separator: true },
      { id: 'sample', label: 'Sample', icon: 'spec' },
      { spacer: true },
      { id: 'copy', label: 'Copy result', icon: 'fileText' },
      { id: 'download', label: 'Download', icon: 'server' },
    ];
    this.$('#bar').value = this.#direction;

    this.on(this.$('#bar'), 'select', (event) => {
      const id = event.detail.id;
      if (id === 'to-compose' || id === 'to-run') return this.#swap(id);
      if (id === 'sample') {
        this.$('#input').value = this.#direction === 'to-compose' ? SAMPLE_RUN : toCompose(SAMPLE_RUN);
        return this.#run();
      }
      if (id === 'copy') return copyText(this.$('#output').value);
      if (id === 'download') {
        return download(
          this.#direction === 'to-compose' ? 'compose.yaml' : 'run.sh',
          this.$('#output').value,
          'text/plain',
        );
      }
      return undefined;
    });

    this.on(this.$('#input'), 'input', debounce(() => this.#run(), 250));

    this.$('#input').value = SAMPLE_RUN;
    this.#run();
  }

  #swap(direction) {
    if (direction === this.#direction) return;
    this.#direction = direction;
    const toCompose = direction === 'to-compose';
    this.$('#in-label').textContent = toCompose ? 'docker run command' : 'compose.yaml';
    this.$('#out-label').textContent = toCompose ? 'compose.yaml' : 'docker run command';
    this.$('#input').language = toCompose ? 'shell' : 'yaml';
    this.$('#output').language = toCompose ? 'yaml' : 'shell';
    this.$('#input').value = this.$('#output').value;
    this.#run();
  }

  #run() {
    const source = this.$('#input').value.trim();
    const status = this.$('#status');

    if (!source) {
      this.$('#output').value = '';
      status.setAttribute('tone', 'muted');
      status.textContent = 'Waiting';
      return;
    }

    try {
      this.$('#output').value = this.#direction === 'to-compose' ? toCompose(source) : toRun(source);
      status.setAttribute('tone', 'success');
      status.textContent = 'Converted';
    } catch (error) {
      status.setAttribute('tone', 'danger');
      status.textContent = error.message;
    }
  }
}

define('jg-app-docker-compose', DockerCompose);
