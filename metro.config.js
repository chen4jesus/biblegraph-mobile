const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add module resolver for the missing package
config.resolver = {
  ...config.resolver,
  extraNodeModules: {
    'react-native-d3-force-graph': __dirname + '/src/components/ForceGraph', // Point to our custom implementation
    '../theme': __dirname + '/src/theme', // Point to theme implementation
  },
};

// Add any custom configurations here
module.exports = config;