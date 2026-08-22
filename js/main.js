import { watchTheme } from './core/settings.js';
import { router } from './core/router.js';
import { analytics } from './core/analytics.js';
import { bus } from './core/bus.js';
import { loadLanguage, language } from './core/i18n.js';
import './ui/jg-shell.js';

watchTheme();

bus.on('route:change', (route) => {
  if (route.language !== language()) loadLanguage(route.language);
});

Promise.all([customElements.whenDefined('jg-shell'), loadLanguage(router.current.language)]).then(() => {
  router.start();
  analytics.start();
});
