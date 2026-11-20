const ts = require('typescript');
// Nest 12 publishes ESM. Transform its JavaScript for the existing Jest CJS
// harness while production executes the original modules on Node 24.
module.exports = {
  getCacheKey(source, filename, options) {
    return require('crypto').createHash('sha256').update('mailhive-esm-v2' + source + filename + options.configString).digest('hex');
  },
  process(source, filename) {
  return { code: ts.transpileModule(source.replaceAll('import.meta.url', 'require("url").pathToFileURL(__filename).href').replaceAll('import.meta.dirname', '__dirname'), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, allowJs: true } }).outputText };
} };
