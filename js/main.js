import { watchTheme } from './core/settings.js';
import { router } from './core/router.js';
import { analytics } from './core/analytics.js';
import './ui/jg-shell.js';

watchTheme();
customElements.whenDefined('jg-shell').then(() => {
  router.start();
  analytics.start();
});
