// The one place to fill in who is responsible for the game. Every legal page reads it.
const LEGAL = {
  owner: 'Daniel Moya Teruel',
  country: { en: 'Spain', es: 'España' },
  contact: 'soymachine@gmail.com',
  updated: { en: '24 November 2026', es: '24 de noviembre de 2026' },
};

(() => {
  // The language: the page's ?lang=, else the game's own choice, else the browser's.
  const q = new URLSearchParams(location.search).get('lang');
  let lang = q === 'es' || q === 'en' ? q : null;
  try { lang ??= localStorage.getItem('tsc:lang'); } catch { /* none */ }
  if (lang !== 'en' && lang !== 'es') lang = (navigator.language || 'en').startsWith('es') ? 'es' : 'en';
  const show = (l) => {
    document.documentElement.lang = l;
    document.querySelectorAll('[lang-only]').forEach((e) => { e.hidden = e.getAttribute('lang-only') !== l; });
    document.querySelectorAll('.langs button').forEach((b) => b.classList.toggle('on', b.dataset.l === l));
  };
  document.querySelectorAll('[data-f]').forEach((e) => {
    const f = e.dataset.f;
    if (f === 'contact') { e.textContent = LEGAL.contact; if (e.tagName === 'A') e.href = `mailto:${LEGAL.contact}`; }
    else if (typeof LEGAL[f] === 'object') e.textContent = LEGAL[f][e.closest('[lang-only]')?.getAttribute('lang-only') || 'en'];
    else e.textContent = LEGAL[f];
  });
  document.querySelectorAll('.langs button').forEach((b) => (b.onclick = () => { show(b.dataset.l); try { localStorage.setItem('tsc:lang', b.dataset.l); } catch { /* ignore */ } }));
  show(lang);
})();
