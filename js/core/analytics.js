import { bus } from './bus.js';
import { consent } from './consent.js';

const MEASUREMENT_ID = 'G-J7L8GPFG3Z';

let loaded = false;
let watching = false;

const denied = {
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  analytics_storage: 'denied',
};

export const analytics = {
  get id() {
    return MEASUREMENT_ID;
  },

  get active() {
    return loaded;
  },

  get allowed() {
    return consent.granted && !analytics.respectsDoNotTrack();
  },

  respectsDoNotTrack() {
    return navigator.doNotTrack === '1' || window.doNotTrack === '1' || navigator.msDoNotTrack === '1';
  },

  gtag() {
    window.dataLayer = window.dataLayer ?? [];
    window.dataLayer.push(arguments);
  },

  start() {
    if (!watching) {
      watching = true;
      bus.on('consent:change', () => (analytics.allowed ? analytics.start() : analytics.stop()));
    }

    if (loaded || !analytics.allowed) return;
    if (!/^https?:$/.test(window.location.protocol)) return;
    loaded = true;

    window[`ga-disable-${MEASUREMENT_ID}`] = false;
    analytics.gtag('consent', 'default', denied);
    analytics.gtag('consent', 'update', { ...denied, analytics_storage: 'granted' });

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
    document.head.append(script);

    analytics.gtag('js', new Date());
    analytics.gtag('config', MEASUREMENT_ID, { send_page_view: false });

    bus.on('route:change', () => analytics.page());
    bus.on('app:open', ({ appId, name, category }) =>
      analytics.event('app_open', { app_id: appId, app_name: name, app_category: category }),
    );
    analytics.page();
  },

  stop() {
    window[`ga-disable-${MEASUREMENT_ID}`] = true;
    if (!loaded) return;
    analytics.gtag('consent', 'update', denied);
  },

  page() {
    if (!loaded || !analytics.allowed) return;
    analytics.gtag('event', 'page_view', {
      page_title: document.title,
      page_location: window.location.href,
      page_path: window.location.pathname,
    });
  },

  event(name, params = {}) {
    if (!loaded || !analytics.allowed) return;
    analytics.gtag('event', name, params);
  },
};
