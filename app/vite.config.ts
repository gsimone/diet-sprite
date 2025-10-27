import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
  },

  server: {
    watch: {
      // Watch the workspace package
      ignored: ['!**/node_modules/diet-sprite/**']
    }
  },

  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
    exclude: ['diet-sprite'],
  },

});
