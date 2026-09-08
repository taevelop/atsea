import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '127.0.0.1',
    watch: {
      // Blender exports can hold files open on Windows. Only watch app/runtime assets.
      ignored: ['**/.tools/**', '**/.cache/**', '**/assets/source/**', '**/test-results/**', '**/playwright-report/**', '**/docs/**', '**/atsea2d/**'],
    },
  },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'three-core', test: /node_modules[\\/]three[\\/]build[\\/]three\.core\.js$/, priority: 30 },
            { name: 'three-renderer', test: /node_modules[\\/]three[\\/]build[\\/]three\.module\.js$/, priority: 20 },
            { name: 'model-loader', test: /node_modules[\\/]three[\\/]examples[\\/]jsm/, priority: 10 },
          ],
        },
      },
    },
  },
});
