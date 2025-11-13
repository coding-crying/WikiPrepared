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
  // Note: We keep __dirname as the default (webpack will handle it correctly)
  // Electron Forge's webpack plugin will inject the correct paths
};
