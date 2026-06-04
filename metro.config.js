// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Keep Metro on Expo's default cache/configuration so Expo Router's Babel caller
// metadata is preserved and EXPO_ROUTER_APP_ROOT is inlined correctly.
config.maxWorkers = 2;

module.exports = config;
