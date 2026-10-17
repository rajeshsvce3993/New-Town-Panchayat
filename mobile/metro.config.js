const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

// This Expo app sits inside a Next.js repo. Without this, Metro walks the
// parent tree (web `app/`, kotlin_app, node_modules) and the first bundle
// appears stuck around 60%.
config.watchFolders = [projectRoot];
config.resolver.blockList = [
  /[\\/]kotlin_app[\\/].*/,
];

module.exports = config;
