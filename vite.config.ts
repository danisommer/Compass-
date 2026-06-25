import { defineConfig } from 'vite';

export default defineConfig({
  // Caminhos relativos: funciona tanto em domínio raiz quanto em subpasta
  // (ex.: GitHub Pages de projeto) sem precisar saber o nome do repositório.
  base: './',
  server: {
    port: 5501,
    open: true,
  },
  build: {
    outDir: 'dist',
    target: 'es2020',
  },
});
