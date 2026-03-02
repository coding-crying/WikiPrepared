const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: 'production',
  entry: {
    index: './src/main/index.js',
    preload: './src/main/preload.js',
  },
  target: 'electron-main',
  output: {
    path: path.resolve(__dirname, 'build/main'),
    filename: '[name].js',
  },
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
          to: path.resolve(__dirname, 'build/main/assets'),
          noErrorOnMissing: true
        }
      ]
    })
  ],
  node: {
    __dirname: false,
    __filename: false,
  },
};
