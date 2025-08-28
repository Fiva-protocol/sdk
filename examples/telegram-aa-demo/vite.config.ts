import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    server: {
        port: 3002,
        host: true,
        allowedHosts: ["4034a19d5183.ngrok-free.app"]
    },
    define: {
        global: 'globalThis',
        'process.env': {}
    },
    resolve: {
        alias: {
            buffer: 'buffer',
            process: 'process'
        }
    },
    optimizeDeps: {
        include: ['buffer', 'process']
    }
});