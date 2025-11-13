const rules = require('./webpack.renderer.rules'); // Use renderer-specific rules
const path = require('path');

module.exports = {
  target: 'web', // Explicitly set target to web (not electron-renderer)
  module: {
    rules,
  },
  resolve: {
    extensions: ['.js', '.jsx', '.json'],
    alias: {
      '@': path.resolve(__dirname, 'src/renderer'),
      '@components': path.resolve(__dirname, 'src/renderer/components'),
      '@views': path.resolve(__dirname, 'src/renderer/views'),
      '@store': path.resolve(__dirname, 'src/renderer/store'),
      '@utils': path.resolve(__dirname, 'src/renderer/utils'),
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
    fallback: {
      // Don't polyfill Node.js core modules in the renderer
      path: false,
      fs: false,
      crypto: false,
    },
  },
  node: {
    // Disable Node.js globals in the renderer
    __dirname: false,
    __filename: false,
    global: false,
  },
};
