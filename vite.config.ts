import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

// The game's version comes from package.json and is shown at the foot of the Articles of Engagement.
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(version) },
  // Two pages: the game, and the sound desk (admin.html).
  build: {
    rollupOptions: {
      input: { main: 'index.html', admin: 'admin.html', clients: 'clients.html' },
      // three.js and Firebase in chunks of their own: they change rarely, so returning players keep them cached
      // while the game's own code is updated, and the browser fetches the three in parallel.
      output: { manualChunks: (id) => (id.includes('node_modules/three/') ? 'three' : id.includes('node_modules/@firebase/') || id.includes('node_modules/firebase/') ? 'firebase' : undefined) },
    },
    chunkSizeWarningLimit: 700,
  },
});
