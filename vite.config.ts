import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

// The game's version comes from package.json and is shown at the foot of the Articles of Engagement.
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(version) },
  // Two pages: the game, and the sound desk (admin.html).
  build: { rollupOptions: { input: { main: 'index.html', admin: 'admin.html' } } },
});
