// Only reached for the ESM-only inversify packages Jest is configured to
// transform (see jest.config.cjs's transformIgnorePatterns) — inversify
// ships no CommonJS build, so Jest's default require()-based loader can't
// load it without this being downleveled first.
module.exports = {
  presets: [["@babel/preset-env", { targets: { node: "current" } }]],
};
