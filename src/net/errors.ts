// Errors players run into are sent home: uncaught exceptions, rejected promises and a lost WebGL context.
// Each goes to the Realtime Database under errors/<day> (write-only), with the version, the browser and the
// language, and nothing about the player. At most five a page, and each message once.
import { reportError } from './firebase';
import { getLang } from '../ui/i18n';

const sent = new Set<string>();
let count = 0;

export function report(kind: string, msg: string, stack = '') {
  if (import.meta.env.DEV || count >= 5) return;
  const key = `${kind}:${msg}`;
  if (sent.has(key)) return;
  sent.add(key); count++;
  void reportError({ kind, msg: msg.slice(0, 300), stack: stack.slice(0, 1500), v: __APP_VERSION__, ua: navigator.userAgent.slice(0, 200), lang: getLang() }).catch(() => { /* nowhere to send it */ });
}

export function installErrorReporting(canvas?: HTMLCanvasElement) {
  addEventListener('error', (e) => {
    // A picture or script that failed to load fires here too, without an error object.
    if (!(e instanceof ErrorEvent)) return;
    report('error', e.message || String(e.error), (e.error as Error | undefined)?.stack ?? `${e.filename}:${e.lineno}:${e.colno}`);
  });
  addEventListener('unhandledrejection', (e) => {
    const r = e.reason as Error | string | undefined;
    report('rejection', typeof r === 'string' ? r : r?.message ?? 'unknown', typeof r === 'object' ? r?.stack ?? '' : '');
  });
  canvas?.addEventListener('webglcontextlost', () => report('webgl', 'WebGL context lost'));
}
