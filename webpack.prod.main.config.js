const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

const mainConfig = {
  mode: 'production',
  entry: {
    index: './src/main/index.js',
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

const preloadConfig = {
  mode: 'production',
  entry: {
    preload: './src/main/preload.js',
  },
  target: 'electron-preload',
  output: {
    path: path.resolve(__dirname, 'build/main'),
    filename: '[name].js',
  },
  module: {
    // Keep preload lean; avoid asset relocator runtime that relies on Node globals.
    rules: [
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env', '@babel/preset-react'],
          },
        },
      },
    ],
  },
  resolve: {
    extensions: ['.js', '.jsx', '.json'],
  },
  externals: {
    electron: 'commonjs2 electron',
  },
  node: {
    __dirname: true,
    __filename: true,
  },
};

module.exports = [mainConfig, preloadConfig];
