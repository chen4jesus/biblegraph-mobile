module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['module:metro-react-native-babel-preset', '@babel/preset-typescript'],
    plugins: [
      '@babel/plugin-transform-flow-strip-types',
      ['@babel/plugin-transform-private-methods', { loose: true }],
      ['@babel/plugin-proposal-class-properties', { loose: true }]
    ]
  };
}; 