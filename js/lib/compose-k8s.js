export const CONTROLLERS = {
  none: { label: 'No ingress' },
  nginx: {
    label: 'NGINX',
    className: 'nginx',
    annotations: { 'nginx.ingress.kubernetes.io/proxy-body-size': '16m' },
    tls: { 'cert-manager.io/cluster-issuer': 'letsencrypt-prod' },
  },
  traefik: {
    label: 'Traefik',
    className: 'traefik',
    annotations: { 'traefik.ingress.kubernetes.io/router.entrypoints': 'web,websecure' },
    tls: { 'traefik.ingress.kubernetes.io/router.tls': 'true' },
  },
  haproxy: {
    label: 'HAProxy',
    className: 'haproxy',
    annotations: { 'haproxy.org/load-balance': 'roundrobin' },
    tls: { 'haproxy.org/ssl-redirect': 'true' },
  },
  contour: { label: 'Contour', className: 'contour', annotations: {}, tls: {} },
  istio: { label: 'Istio', className: 'istio', annotations: {}, tls: {} },
  alb: {
    label: 'AWS Load Balancer',
    className: 'alb',
    annotations: { 'alb.ingress.kubernetes.io/scheme': 'internet-facing', 'alb.ingress.kubernetes.io/target-type': 'ip' },
    tls: { 'alb.ingress.kubernetes.io/listen-ports': '[{"HTTP":80},{"HTTPS":443}]' },
  },
};

export const slug = (text) =>
  String(text)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63) || 'app';

const seconds = (value) => {
  const match = String(value ?? '').match(/^([\d.]+)\s*(ms|s|m|h)?$/);
  if (!match) return null;
  const amount = Number(match[1]);
  const scale = { ms: 0.001, s: 1, m: 60, h: 3600 }[match[2] ?? 's'] ?? 1;
  return Math.max(1, Math.round(amount * scale));
};

const memory = (value) => {
  const match = String(value ?? '').match(/^([\d.]+)\s*([kmgt])?[bi]*$/i);
  if (!match) return String(value);
  const amount = Number(match[1]);
  const unit = (match[2] ?? '').toLowerCase();
  const suffix = { k: 'Ki', m: 'Mi', g: 'Gi', t: 'Ti' }[unit];
  return suffix ? `${Math.round(amount)}${suffix}` : `${Math.round(amount)}`;
};

const cpu = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return String(value);
  return Number.isInteger(amount) ? String(amount) : `${Math.round(amount * 1000)}m`;
};

export const readPorts = (list) =>
  (list ?? [])
    .map((entry) => {
      if (entry && typeof entry === 'object') {
        const target = Number(entry.target);
        if (!target) return null;
        return { published: Number(entry.published ?? target), target, protocol: (entry.protocol ?? 'tcp').toUpperCase(), hostIp: null };
      }
      const text = String(entry);
      const [spec, proto] = text.split('/');
      const parts = spec.split(':');
      const protocol = (proto ?? 'tcp').toUpperCase();
      if (parts.length === 1) {
        const only = Number(parts[0]);
        return only ? { published: only, target: only, protocol, hostIp: null } : null;
      }
      const target = Number(parts[parts.length - 1]);
      const published = Number(parts[parts.length - 2]);
      const hostIp = parts.length > 2 ? parts.slice(0, parts.length - 2).join(':') : null;
      if (!target || !published) return null;
      return { published, target, protocol, hostIp };
    })
    .filter(Boolean);

export const readEnv = (source) => {
  if (!source) return [];
  if (Array.isArray(source)) {
    return source
      .map((entry) => {
        const text = String(entry);
        const split = text.indexOf('=');
        if (split < 0) return { name: text, value: '' };
        return { name: text.slice(0, split), value: text.slice(split + 1) };
      })
      .filter((item) => item.name);
  }
  return Object.entries(source).map(([name, value]) => ({ name, value: value === null ? '' : String(value) }));
};

export const readVolumes = (list) =>
  (list ?? [])
    .map((entry) => {
      if (entry && typeof entry === 'object') {
        return { source: entry.source ?? null, target: entry.target, bind: entry.type === 'bind' };
      }
      const parts = String(entry).split(':');
      if (parts.length < 2) return { source: null, target: parts[0], bind: false };
      const source = parts[0];
      const target = parts[1];
      return { source, target, bind: source.startsWith('.') || source.startsWith('/') || source.startsWith('~') };
    })
    .filter((item) => item.target);

const probeFrom = (healthcheck) => {
  if (!healthcheck || healthcheck.disable) return null;
  const test = healthcheck.test;
  let command = null;
  if (Array.isArray(test)) {
    if (test[0] === 'CMD') command = test.slice(1);
    else if (test[0] === 'CMD-SHELL') command = ['sh', '-c', test.slice(1).join(' ')];
    else command = test;
  } else if (typeof test === 'string') {
    command = ['sh', '-c', test];
  }
  if (!command?.length) return null;
  const probe = { exec: { command } };
  const every = seconds(healthcheck.interval);
  const wait = seconds(healthcheck.start_period);
  const cap = seconds(healthcheck.timeout);
  if (every) probe.periodSeconds = every;
  if (wait) probe.initialDelaySeconds = wait;
  if (cap) probe.timeoutSeconds = cap;
  if (healthcheck.retries) probe.failureThreshold = Number(healthcheck.retries);
  return probe;
};

const asList = (value) => (Array.isArray(value) ? value.map(String) : value == null ? null : [String(value)]);

export const convert = (compose, options = {}) => {
  const namespace = slug(options.namespace || 'default');
  const controller = CONTROLLERS[options.controller] ? options.controller : 'none';
  const domain = (options.domain || 'example.com').trim();
  const storage = options.storage || '1Gi';
  const tls = Boolean(options.tls);
  const pullPolicy = options.pullPolicy || 'IfNotPresent';

  const warnings = [];
  const documents = [];
  const services = compose?.services ?? {};
  const names = Object.keys(services);

  if (!names.length) return { documents, warnings: ['No services found. A compose file needs a services block.'] };

  if (namespace !== 'default') {
    documents.push({ apiVersion: 'v1', kind: 'Namespace', metadata: { name: namespace } });
  }

  const claims = new Set();

  names.forEach((raw) => {
    const service = services[raw] ?? {};
    const name = slug(raw);
    const labels = { app: name, 'app.kubernetes.io/name': name };
    const ports = readPorts(service.ports);
    const exposed = readPorts(service.expose ?? []);
    const env = readEnv(service.environment);
    const mounts = readVolumes(service.volumes);

    if (!service.image) {
      warnings.push(
        service.build
          ? `${raw} is built from source, so it has no image. Build and push it, then set the image on its Deployment.`
          : `${raw} has no image and no build, so its Deployment has a placeholder image.`,
      );
    }
    if (service.depends_on) warnings.push(`${raw} uses depends_on. Kubernetes has no start ordering, so make the app retry instead.`);
    if (service.env_file) warnings.push(`${raw} reads env_file. Put those values in a ConfigMap or Secret and reference it.`);
    if (service.network_mode) warnings.push(`${raw} sets network_mode ${service.network_mode}, which has no direct equivalent.`);
    if (service.privileged) warnings.push(`${raw} runs privileged. That needs a securityContext and a permissive pod security policy.`);
    if (service.restart && !['always', 'unless-stopped', 'any'].includes(String(service.restart))) {
      warnings.push(`${raw} sets restart ${service.restart}. A Deployment always restarts its pods.`);
    }
    ports.filter((port) => port.hostIp).forEach((port) => {
      warnings.push(`${raw} binds ${port.hostIp} on the host. Kubernetes services do not bind a host address.`);
    });

    const container = {
      name,
      image: service.image || `${name}:latest`,
      imagePullPolicy: pullPolicy,
    };

    const entry = asList(service.entrypoint);
    const command = asList(service.command);
    if (entry) container.command = entry;
    if (command) container[entry ? 'args' : 'command'] = command;

    const allPorts = [...ports, ...exposed];
    if (allPorts.length) {
      container.ports = allPorts.map((port) => ({
        name: `p-${port.target}`.slice(0, 15),
        containerPort: port.target,
        protocol: port.protocol,
      }));
    }
    if (env.length) container.env = env;

    const limits = service.deploy?.resources?.limits;
    const requests = service.deploy?.resources?.reservations;
    const resources = {};
    if (limits) {
      resources.limits = {};
      if (limits.cpus != null) resources.limits.cpu = cpu(limits.cpus);
      if (limits.memory != null) resources.limits.memory = memory(limits.memory);
    }
    if (requests) {
      resources.requests = {};
      if (requests.cpus != null) resources.requests.cpu = cpu(requests.cpus);
      if (requests.memory != null) resources.requests.memory = memory(requests.memory);
    }
    if (Object.keys(resources).length) container.resources = resources;

    const probe = probeFrom(service.healthcheck);
    if (probe) {
      container.livenessProbe = probe;
      container.readinessProbe = probe;
    }

    const volumes = [];
    mounts.forEach((mount, index) => {
      if (mount.bind || !mount.source) {
        warnings.push(`${raw} mounts ${mount.source ?? mount.target} from the host. Replace it with a ConfigMap or a volume claim.`);
        return;
      }
      const claim = slug(mount.source);
      claims.add(claim);
      container.volumeMounts = container.volumeMounts ?? [];
      container.volumeMounts.push({ name: claim, mountPath: mount.target });
      volumes.push({ name: claim, persistentVolumeClaim: { claimName: claim } });
      void index;
    });

    documents.push({
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: { name, namespace, labels },
      spec: {
        replicas: Number(service.deploy?.replicas ?? options.replicas ?? 1),
        selector: { matchLabels: { app: name } },
        template: {
          metadata: { labels },
          spec: volumes.length ? { containers: [container], volumes } : { containers: [container] },
        },
      },
    });

    if (allPorts.length) {
      documents.push({
        apiVersion: 'v1',
        kind: 'Service',
        metadata: { name, namespace, labels },
        spec: {
          type: 'ClusterIP',
          selector: { app: name },
          ports: allPorts.map((port) => ({
            name: `p-${port.target}`.slice(0, 15),
            port: port.published,
            targetPort: port.target,
            protocol: port.protocol,
          })),
        },
      });
    }
  });

  [...claims].sort().forEach((claim) => {
    documents.push({
      apiVersion: 'v1',
      kind: 'PersistentVolumeClaim',
      metadata: { name: claim, namespace },
      spec: { accessModes: ['ReadWriteOnce'], resources: { requests: { storage } } },
    });
  });

  if (controller !== 'none') {
    const meta = CONTROLLERS[controller];
    names.forEach((raw) => {
      const service = services[raw] ?? {};
      const ports = readPorts(service.ports);
      if (!ports.length) return;
      const name = slug(raw);
      const host = `${name}.${domain}`;
      const annotations = { ...meta.annotations, ...(tls ? meta.tls : {}) };
      const ingress = {
        apiVersion: 'networking.k8s.io/v1',
        kind: 'Ingress',
        metadata: { name, namespace, ...(Object.keys(annotations).length ? { annotations } : {}) },
        spec: {
          ingressClassName: meta.className,
          rules: [
            {
              host,
              http: {
                paths: [
                  {
                    path: '/',
                    pathType: 'Prefix',
                    backend: { service: { name, port: { number: ports[0].published } } },
                  },
                ],
              },
            },
          ],
        },
      };
      if (tls) ingress.spec.tls = [{ hosts: [host], secretName: `${name}-tls` }];
      documents.push(ingress);
    });
  }

  return { documents, warnings };
};
