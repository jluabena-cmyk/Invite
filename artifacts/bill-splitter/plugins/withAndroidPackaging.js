const { withAppBuildGradle } = require("@expo/config-plugins");

const EXCLUDE_PATH = "META-INF/versions/9/OSGI-INF/MANIFEST.MF";

const PACKAGING_BLOCK = `
    packaging {
        resources {
            excludes += ['${EXCLUDE_PATH}']
        }
    }`;

function withAndroidPackaging(config) {
  return withAppBuildGradle(config, (config) => {
    const contents = config.modResults.contents;
    if (contents.includes(EXCLUDE_PATH)) {
      return config;
    }
    config.modResults.contents = contents.replace(
      /^(android \{)/m,
      `$1${PACKAGING_BLOCK}`
    );
    return config;
  });
}

module.exports = withAndroidPackaging;
