import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import https from 'node:https'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    host: 'localhost',
    proxy: {
      '/api': {
        target: 'https://pawguard-backend-dev.onrender.com',
        changeOrigin: true,
        secure: false,
        agent: new https.Agent({ family: 4, keepAlive: true }),
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            const setCookie = proxyRes.headers['set-cookie'];
            if (setCookie && Array.isArray(setCookie)) {
              proxyRes.headers['set-cookie'] = setCookie.map((cookie) => {
                if (cookie.includes('pg_access_token') || cookie.includes('pg_refresh_token')) {
                  let updated = cookie;
                  if (/SameSite=none/i.test(updated)) {
                    updated = updated.replace(/SameSite=none/i, 'SameSite=Lax');
                  } else if (!/SameSite=/i.test(updated)) {
                    updated += '; SameSite=Lax';
                  }
                  if (!/;?\s*Secure/i.test(updated)) {
                    updated += '; Secure';
                  }
                  return updated;
                }
                return cookie;
              });
            }
          });
        },
      },
    },
  },
})
