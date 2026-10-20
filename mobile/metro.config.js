const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const repoRoot = path.resolve(projectRoot, '..');
const config = getDefaultConfig(projectRoot);

config.watchFolders = [projectRoot];
config.resolver.disableHierarchicalLookup = true;
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')];
config.resolver.blockList = [
  /[\\/]kotlin_app[\\/].*/,
  /[\\/]src[\\/]components[\\/]_recovered\.tsx$/,
  /[\\/]src[\\/]components[\\/]_replayed.*\.tsx$/,
  // Parent Next.js web app — avoid Metro scanning multi-thousand-module trees on Windows.
  new RegExp(`${repoRoot.replace(/\\/g, '[\\\\/]')}[\\\\/]\\.next[\\\\/].*`),
  new RegExp(`${repoRoot.replace(/\\/g, '[\\\\/]')}[\\\\/]\\.next$`),
];
config.cacheVersion = 'tp-mobile-v3';

const expoUiStub = path.resolve(projectRoot, 'stubs/expo-ui-native.js');
const previousResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@expo/ui/jetpack-compose' || moduleName === '@expo/ui/swift-ui') {
    return { type: 'sourceFile', filePath: expoUiStub };
  }
  if (previousResolve) return previousResolve(context, moduleName, platform);
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
