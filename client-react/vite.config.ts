import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());
  
  return {
    plugins: [react()],
    server: {
      port: mode === 'development' ? 3001 : 3000,
      host: true, // Listen on all addresses
      allowedHosts: [
        'finwise.rerecreation.us',
        'devfinwise.rerecreation.us',
        '.rerecreation.us' // Allows all subdomains
      ],
      proxy: {
        '/api': {
          target: mode === 'development' ? 'http://localhost:9001' : 'http://localhost:9000',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, '')
        }
      }
    },
    preview: {
      port: 3000,
      host: true,
      proxy: {
        '/api': {
          target: 'http://localhost:9000',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, '')
        }
      }
    }
  };
}); 