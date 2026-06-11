import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  
  // Build optimizations
  build: {
    // Target modern browsers for smaller bundles
    target: 'es2020',
    
    // Enable minification
    minify: 'terser',
    
    // Terser options for better compression
    // NOTE: drop_console is intentionally OFF so debug logs are visible
    // during ngrok/mobile testing. Re-enable for the final production build.
    terserOptions: {
      compress: {
        drop_console: false,
        drop_debugger: true,
        pure_funcs: [],
      },
      mangle: true,
      format: {
        comments: false,
      },
    },
    
    // Code splitting configuration
    rollupOptions: {
      output: {
        // Manual chunk splitting for better caching
        manualChunks: {
          // React core
          'react-vendor': ['react', 'react-dom'],
          // Router
          'router': ['react-router-dom'],
          // 3D/Animation libraries (heavy, lazy load)
          'three-vendor': ['three', '@react-three/fiber', '@react-three/drei'],
          // Animation
          'gsap-vendor': ['gsap'],
          // Gesture handling
          'gesture': ['@use-gesture/react'],
        },
        // Optimize chunk file names
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
      },
    },
    
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 500,
    
    // Enable source maps for debugging (disabled in production)
    sourcemap: false,
    
    // CSS code splitting
    cssCodeSplit: true,
    
    // Asset inlining threshold (4kb)
    assetsInlineLimit: 4096,
  },
  
  // Development server
  server: {
    port: 5173,  // Use Vite's default port to avoid permission issues
    host: true,  // Listen on all addresses
    open: true,
    cors: true,
    strictPort: false,  // If port is taken, try the next available
    allowedHosts: 'all',
  },
  
  // Preview server (for testing production build)
  preview: {
    port: 4173,
    open: true,
  },
  
  // Optimize dependency pre-bundling
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'gsap',
      '@use-gesture/react',
    ],
    // Exclude heavy 3D libraries from pre-bundling
    exclude: ['three', '@react-three/fiber', '@react-three/drei'],
  },
  
  // Enable faster esbuild for dependencies
  esbuild: {
    logOverride: { 'this-is-undefined-in-esm': 'silent' },
  },
})
