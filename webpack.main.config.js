const webpack = require('webpack');

module.exports = {
  entry: './src/main/index.js',
  module: {
    rules: require('./webpack.rules'),
  },
  resolve: {
    extensions: ['.js', '.jsx', '.json'],
  },
  plugins: [
    // Manually add DefinePlugin since Electron Forge isn't injecting it
    new webpack.DefinePlugin({
      'MAIN_WINDOW_WEBPACK_ENTRY': JSON.stringify(process.env.MAIN_WINDOW_WEBPACK_ENTRY || 'http://localhost:9000/main_window'),
      'MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY': JSON.stringify(process.env.MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY || 'http://localhost:9000/main_window/preload.js'),
    }),
  ],
};
