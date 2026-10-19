'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const {root, loadVersion} = require('./lib');
const versions = ['v11', 'v12'].map(label => ({label, ...loadVersion(label)}));
const evidence = {};
let diff = '';
for (const suffix of ['.js', '.d.ts', '_config.json']) {
  const files = versions.map(v => v.clientPath.replace(/\.js$/, suffix));
  const r = spawnSync('diff', ['-u', '--label', path.relative(root, files[0]), '--label', path.relative(root, files[1]), ...files], {encoding: 'utf8', maxBuffer: 10 * 1024 * 1024});
  if (r.error || r.status > 1) throw r.error || Error(r.stderr);
  diff += r.stdout;
  for (let i = 0; i < versions.length; i++) {
    const {label} = versions[i];
    const text = fs.readFileSync(files[i], 'utf8');
    evidence[label] ||= {};
    evidence[label][suffix] = {file: path.relative(root, files[i]),
      initializesBatchingObject: /batching:\s*\{\}/.test(text),
      initializesWriteLogEntriesBatching: /writeLogEntries:\s*new this\._gaxModule\.BundleDescriptor/.test(text),
      selectsBatchingDescriptor: /descriptors\.batching[^\n]*methodName/.test(text),
      matches: text.split('\n').flatMap((line, n) => /batching|BundleDescriptor|bundling|bundle|google-gax|writeLogEntries|WriteLogEntries/.test(line) ? [{line: n + 1, text: line}] : [])};
  }
}
fs.writeFileSync(path.join(root, 'artifacts/logging-service-v2.diff'), diff);
fs.writeFileSync(path.join(root, 'artifacts/source-evidence.json'), JSON.stringify(evidence, null, 2) + '\n');
for (const [label, e] of Object.entries(evidence)) {
  console.log(`${label}: ${e['.js'].file}`);
  console.log(`  batching object: ${e['.js'].initializesBatchingObject}; WriteLogEntries descriptor: ${e['.js'].initializesWriteLogEntriesBatching}; batching selection: ${e['.js'].selectsBatchingDescriptor}`);
  for (const m of e['.js'].matches.filter(m => /batching|BundleDescriptor/.test(m.text))) console.log(`  ${m.line}: ${m.text.trim()}`);
}
console.log('\nv12 relocates the generated client into @google-cloud/logging-api.');
console.log('Full implementation, declarations, and config diff: artifacts/logging-service-v2.diff');
console.log(diff);
