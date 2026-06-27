import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json';

export default defineConfig({
    plugins: [crx({ manifest })],
    server: {
        port: 5173,
        strictPort: true,
        host: true,
        hmr: {
            port: 5173,
            clientPort: 5173,
            host: "localhost"
        },
        cors: true,
    },
    // This explicitly tells Vite how to handle the extension environment
    legacy: {
        skipWebSocketTokenCheck: true,
    },
    build: {
        rollupOptions: {
            input: {
                offscreen: 'offscreen.html'
            }
        }
    }
});