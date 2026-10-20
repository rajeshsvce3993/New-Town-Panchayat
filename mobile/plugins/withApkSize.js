const { withAppBuildGradle } = require('expo/config-plugins');

/**
 * Drops unused Android language packs from Play/Google libraries (keeps English + Tamil).
 */
function withApkSize(config) {
  return withAppBuildGradle(config, (mod) => {
    if (mod.modResults.language !== 'groovy') return mod;
    let src = mod.modResults.contents;
    if (!src.includes('resConfigs')) {
      src = src.replace(/defaultConfig\s*\{/, 'defaultConfig {\n        resConfigs "en", "ta"');
    }
    mod.modResults.contents = src;
    return mod;
  });
}

module.exports = withApkSize;
