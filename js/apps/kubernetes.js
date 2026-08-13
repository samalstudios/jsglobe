import { JGApp, define, html, css } from '../core/app.js';
import { toYaml } from '../core/yaml.js';
import { debounce, copyText, download } from '../core/util.js';

const sheet = css`
  .shell { display: grid; grid-template-columns: 320px 1fr; gap: 14px; flex: 1; min-height: 0; }
  @media (max-width: 880px) { .shell { grid-template-columns: 1fr; } }
  .form { display: flex; flex-direction: column; gap: 10px; overflow: auto; scrollbar-width: thin; padding-right: 4px; }
  .pair { display: grid; grid-template-columns: 1fr 1fr auto; gap: 6px; align-items: center; }
  .list { display: grid; gap: 6px; }
  .out { display: flex; flex-direction: column; gap: 8px; min-height: 0; }
`;

const uid = () => Math.random().toString(36).slice(2, 8);

const SERVICE_TYPES = ['ClusterIP', 'NodePort', 'LoadBalancer'];

class Kubernetes extends JGApp {
  static appId = 'kubernetes';
  static styles = [...JGApp.styles, sheet];

  #env = [];
  #kinds = new Set(['deployment', 'service']);

  renderApp() {
    const saved = this.store.read({ form: null, env: null, kinds: null });
    this.#env = saved.env ?? [{ id: uid(), key: 'NODE_ENV', value: 'production' }];
    if (saved.kinds?.length) this.#kinds = new Set(saved.kinds);

    this.paint(html`<div class="app">
      <jg-toolbar id="kinds"></jg-toolbar>

      <div class="shell">
        <div class="form">
          <jg-field label="Name"><jg-input id="name" value="web" mono></jg-input></jg-field>
          <jg-field label="Namespace"><jg-input id="namespace" value="default" mono></jg-input></jg-field>
          <jg-field label="Image"><jg-input id="image" value="nginx:1.27-alpine" mono></jg-input></jg-field>
          <div class="row">
            <jg-field label="Replicas" style="flex:1"><jg-input id="replicas" type="number" min="1" max="50" value="2"></jg-input></jg-field>
            <jg-field label="Container port" style="flex:1"><jg-input id="port" type="number" min="1" max="65535" value="80"></jg-input></jg-field>
          </div>
          <div class="row">
            <jg-field label="Service port" style="flex:1"><jg-input id="servicePort" type="number" min="1" max="65535" value="80"></jg-input></jg-field>
            <jg-field label="Service type" style="flex:1">
              <jg-select id="serviceType" value="ClusterIP">
                ${SERVICE_TYPES.map((type) => html`<option value="${type}">${type}</option>`)}
              </jg-select>
            </jg-field>
          </div>

          <jg-field label="Host for the ingress"><jg-input id="host" value="example.com" mono></jg-input></jg-field>
          <jg-field label="Ingress class"><jg-input id="ingressClass" value="nginx" mono></jg-input></jg-field>

          <div class="row">
            <jg-field label="CPU request" style="flex:1"><jg-input id="cpuRequest" value="100m" mono></jg-input></jg-field>
            <jg-field label="CPU limit" style="flex:1"><jg-input id="cpuLimit" value="500m" mono></jg-input></jg-field>
          </div>
          <div class="row">
            <jg-field label="Memory request" style="flex:1"><jg-input id="memRequest" value="128Mi" mono></jg-input></jg-field>
            <jg-field label="Memory limit" style="flex:1"><jg-input id="memLimit" value="512Mi" mono></jg-input></jg-field>
          </div>

          <div class="row">
            <jg-switch id="probes" checked></jg-switch><span class="hint">Add readiness and liveness probes</span>
          </div>
          <div class="row">
            <jg-switch id="tls" checked></jg-switch><span class="hint">Request TLS on the ingress</span>
          </div>

          <jg-card title="Environment" sub="Written into a ConfigMap and referenced by the pod">
            <div class="list" id="env"></div>
            <jg-button size="sm" variant="outline" id="add-env">Add variable</jg-button>
          </jg-card>
        </div>

        <div class="out">
          <jg-code id="out" grow gutter language="yaml" readonly></jg-code>
          <div class="row">
            <jg-button size="sm" variant="outline" id="copy">Copy manifests</jg-button>
            <jg-button size="sm" variant="ghost" id="download">Download</jg-button>
            <span class="grow"></span>
            <span class="hint" id="count"></span>
          </div>
        </div>
      </div>
    </div>`);

    const kinds = this.$('#kinds');
    kinds.items = [
      { id: 'deployment', label: 'Deployment', icon: 'helm', toggle: true, active: this.#kinds.has('deployment') },
      { id: 'service', label: 'Service', icon: 'network', toggle: true, active: this.#kinds.has('service') },
      { id: 'ingress', label: 'Ingress', icon: 'globe', toggle: true, active: this.#kinds.has('ingress') },
      { id: 'configmap', label: 'ConfigMap', icon: 'list', toggle: true, active: this.#kinds.has('configmap') },
      { id: 'hpa', label: 'Autoscaler', icon: 'trending', toggle: true, active: this.#kinds.has('hpa') },
      { id: 'pdb', label: 'PodDisruptionBudget', icon: 'shieldCheck', toggle: true, active: this.#kinds.has('pdb') },
    ];

    this.on(kinds, 'select', (event) => {
      const id = event.detail.id;
      if (this.#kinds.has(id)) this.#kinds.delete(id);
      else this.#kinds.add(id);
      this.#run();
    });

    const run = debounce(() => this.#run(), 180);
    this.$$('jg-input, jg-select').forEach((node) => {
      this.on(node, 'input', run);
      this.on(node, 'change', run);
    });
    ['#probes', '#tls'].forEach((selector) => this.on(this.$(selector), 'change', run));

    this.on(this.$('#add-env'), 'click', () => {
      this.#env = [...this.#env, { id: uid(), key: '', value: '' }];
      this.#paintEnv();
      this.#run();
    });

    this.on(this.$('#copy'), 'click', () => copyText(this.$('#out').value));
    this.on(this.$('#download'), 'click', () => download(`${this.$('#name').value || 'app'}.yaml`, this.$('#out').value, 'text/yaml'));

    if (saved.form) Object.entries(saved.form).forEach(([key, value]) => {
      const node = this.$(`#${key}`);
      if (node) node.value = value;
    });

    this.#paintEnv();
    this.#run();
  }

  #paintEnv() {
    this.$('#env').innerHTML = this.#env
      .map(
        (entry) => html`<div class="pair">
          <jg-input size="sm" mono value="${entry.key}" data-key="${entry.id}" placeholder="KEY"></jg-input>
          <jg-input size="sm" mono value="${entry.value}" data-value="${entry.id}" placeholder="value"></jg-input>
          <jg-button size="icon-sm" variant="ghost" data-drop="${entry.id}">✕</jg-button>
        </div>`,
      )
      .join('');

    const update = (id, field, value) => {
      const entry = this.#env.find((item) => item.id === id);
      if (entry) entry[field] = value;
      this.#run();
    };

    this.bind('[data-key]', 'input', (event) => update(event.currentTarget.dataset.key, 'key', event.currentTarget.value));
    this.bind('[data-value]', 'input', (event) => update(event.currentTarget.dataset.value, 'value', event.currentTarget.value));
    this.bind('[data-drop]', 'click', (event) => {
      this.#env = this.#env.filter((item) => item.id !== event.currentTarget.dataset.drop);
      this.#paintEnv();
      this.#run();
    });
  }

  #values() {
    const read = (id, fallback = '') => this.$(`#${id}`)?.value?.trim() || fallback;
    return {
      name: read('name', 'app'),
      namespace: read('namespace', 'default'),
      image: read('image', 'nginx'),
      replicas: Math.max(1, Number(read('replicas', '1'))),
      port: Number(read('port', '80')),
      servicePort: Number(read('servicePort', '80')),
      serviceType: read('serviceType', 'ClusterIP'),
      host: read('host', 'example.com'),
      ingressClass: read('ingressClass', 'nginx'),
      cpuRequest: read('cpuRequest', '100m'),
      cpuLimit: read('cpuLimit', '500m'),
      memRequest: read('memRequest', '128Mi'),
      memLimit: read('memLimit', '512Mi'),
      probes: this.$('#probes').checked,
      tls: this.$('#tls').checked,
      env: this.#env.filter((entry) => entry.key.trim()),
    };
  }

  #deployment(values, labels) {
    const container = {
      name: values.name,
      image: values.image,
      imagePullPolicy: 'IfNotPresent',
      ports: [{ name: 'http', containerPort: values.port }],
      resources: {
        requests: { cpu: values.cpuRequest, memory: values.memRequest },
        limits: { cpu: values.cpuLimit, memory: values.memLimit },
      },
    };

    if (values.env.length) container.envFrom = [{ configMapRef: { name: `${values.name}-config` } }];

    if (values.probes) {
      container.readinessProbe = { httpGet: { path: '/', port: 'http' }, initialDelaySeconds: 5, periodSeconds: 10 };
      container.livenessProbe = { httpGet: { path: '/', port: 'http' }, initialDelaySeconds: 15, periodSeconds: 20 };
    }

    return {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: { name: values.name, namespace: values.namespace, labels },
      spec: {
        replicas: values.replicas,
        selector: { matchLabels: labels },
        strategy: { type: 'RollingUpdate', rollingUpdate: { maxSurge: 1, maxUnavailable: 0 } },
        template: {
          metadata: { labels },
          spec: {
            securityContext: { runAsNonRoot: true, runAsUser: 1000 },
            containers: [container],
          },
        },
      },
    };
  }

  #run() {
    const values = this.#values();
    const labels = { app: values.name };
    const documents = [];

    if (this.#kinds.has('configmap') || values.env.length) {
      documents.push({
        apiVersion: 'v1',
        kind: 'ConfigMap',
        metadata: { name: `${values.name}-config`, namespace: values.namespace, labels },
        data: Object.fromEntries(values.env.map((entry) => [entry.key, entry.value])),
      });
    }

    if (this.#kinds.has('deployment')) documents.push(this.#deployment(values, labels));

    if (this.#kinds.has('service')) {
      documents.push({
        apiVersion: 'v1',
        kind: 'Service',
        metadata: { name: values.name, namespace: values.namespace, labels },
        spec: {
          type: values.serviceType,
          selector: labels,
          ports: [{ name: 'http', port: values.servicePort, targetPort: 'http', protocol: 'TCP' }],
        },
      });
    }

    if (this.#kinds.has('ingress')) {
      const ingress = {
        apiVersion: 'networking.k8s.io/v1',
        kind: 'Ingress',
        metadata: { name: values.name, namespace: values.namespace, labels },
        spec: {
          ingressClassName: values.ingressClass,
          rules: [
            {
              host: values.host,
              http: {
                paths: [
                  {
                    path: '/',
                    pathType: 'Prefix',
                    backend: { service: { name: values.name, port: { number: values.servicePort } } },
                  },
                ],
              },
            },
          ],
        },
      };
      if (values.tls) ingress.spec.tls = [{ hosts: [values.host], secretName: `${values.name}-tls` }];
      documents.push(ingress);
    }

    if (this.#kinds.has('hpa')) {
      documents.push({
        apiVersion: 'autoscaling/v2',
        kind: 'HorizontalPodAutoscaler',
        metadata: { name: values.name, namespace: values.namespace, labels },
        spec: {
          scaleTargetRef: { apiVersion: 'apps/v1', kind: 'Deployment', name: values.name },
          minReplicas: values.replicas,
          maxReplicas: Math.max(values.replicas * 3, values.replicas + 1),
          metrics: [
            { type: 'Resource', resource: { name: 'cpu', target: { type: 'Utilization', averageUtilization: 70 } } },
          ],
        },
      });
    }

    if (this.#kinds.has('pdb')) {
      documents.push({
        apiVersion: 'policy/v1',
        kind: 'PodDisruptionBudget',
        metadata: { name: values.name, namespace: values.namespace, labels },
        spec: { minAvailable: 1, selector: { matchLabels: labels } },
      });
    }

    this.$('#out').value = documents.map((document) => toYaml(document)).join('\n---\n');
    this.$('#count').textContent = `${documents.length} manifest${documents.length === 1 ? '' : 's'}`;

    this.store.write({
      env: this.#env,
      kinds: [...this.#kinds],
      form: Object.fromEntries(
        ['name', 'namespace', 'image', 'replicas', 'port', 'servicePort', 'serviceType', 'host', 'ingressClass',
          'cpuRequest', 'cpuLimit', 'memRequest', 'memLimit'].map((key) => [key, this.$(`#${key}`)?.value ?? '']),
      ),
    });
  }
}

define('jg-app-kubernetes', Kubernetes);
