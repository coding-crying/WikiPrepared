const CopyWebpackPlugin = require('copy-webpack-plugin');
const path = require('path');

module.exports = {
  /**
   * This is the main entry point for your application, it's the first file
   * that runs in the main process.
   */
  entry: './src/main/index.js',
  module: {
    rules: require('./webpack.rules'),
  },
  resolve: {
    extensions: ['.js', '.jsx', '.json'],
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        {
          from: path.resolve(__dirname, 'src/main/assets'),
          to: path.resolve(__dirname, '.webpack/main/assets'),
          noErrorOnMissing: true
        }
      ]
    })
  ],
  // Note: We keep __dirname as the default (webpack will handle it correctly)
  // Electron Forge's webpack plugin will inject the correct paths
};
