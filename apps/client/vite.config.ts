import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

function getOrigin(value?: string) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const backendOrigin = getOrigin(env.VITE_WS_URL);

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        strategies: 'generateSW',
        manifestFilename: 'manifest.webmanifest',
        injectRegister: 'auto',
        workbox: {
          skipWaiting: true,
          clientsClaim: true,
          navigateFallback: '/index.html',
          globPatterns: ['**/*.{js,css,html,svg,mp3,wav}'],
          navigateFallbackDenylist: [/^\/socket\.io(?:\/|$)/],
          runtimeCaching: [
            {
              urlPattern: ({ url }) =>
                url.pathname.startsWith('/socket.io') || (backendOrigin !== null && url.origin === backendOrigin),
              handler: 'NetworkOnly',
              method: 'GET',
            },
            {
              urlPattern: ({ url }) =>
                url.pathname.startsWith('/socket.io') || (backendOrigin !== null && url.origin === backendOrigin),
              handler: 'NetworkOnly',
              method: 'POST',
            },
          ],
        },
        manifest: {
          name: 'Hooker',
          short_name: 'Hooker',
          display: 'standalone',
          start_url: '/',
          background_color: '#050b0a',
          theme_color: '#0f1f1a',
          orientation: 'any',
          icons: [
            { src: '/icons/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: '/icons/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
      }),
    ],
    server: {
      port: 5173,
    },
  };
});
