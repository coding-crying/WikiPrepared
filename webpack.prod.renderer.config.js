const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const rules = require('./webpack.renderer.rules');

module.exports = {
  mode: 'production',
  entry: {
    renderer: './src/renderer/index.jsx',
  },
  target: 'electron-renderer',
  output: {
    path: path.resolve(__dirname, 'build/renderer'),
    filename: '[name].js',
  },
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
      path: false,
      fs: false,
      crypto: false,
    },
  },
  node: {
    __dirname: false,
    __filename: false,
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './public/index.html',
      filename: 'index.html',
      chunks: ['renderer'],
    }),
  ],
};
