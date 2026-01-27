
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { dirname, resolve } from 'path';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [react(),tailwindcss()],
  build: {
    // lib: {
    //   entry: resolve(__dirname, 'src/widget.ts'),
    //   name: 'ChatWidget',
    //   fileName: 'chat-widget',
    //   formats: ['iife'], 
    // },
    // rollupOptions: {
    //   external: [], 
    //   output: {
    //     globals: {},
    //     // Ensure the widget is self-contained
    //     inlineDynamicImports: true,
    //   },
    // },
    // Optimize for production
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false, // Remove console.logs in production
        drop_debugger: true,
      },
    },
    // Generate source maps for debugging
    sourcemap: false,
    // Target modern browsers
    target: 'es2015',
    // Ensure compatibility
    cssCodeSplit: false,
  },
  // Define global constants
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  // Resolve configuration
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  // Development server configuration
  server: {
    port: 3000,
    host: true,
  },
  // Preview server configuration
  preview: {
    port: 3000,
    host: true,
  },
});
