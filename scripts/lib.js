'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {createRequire} = require('node:module');
const root = path.resolve(__dirname, '..');
function packageVersion(file) {
  let dir = path.dirname(file);
  while (!fs.existsSync(path.join(dir, 'package.json'))) {
    const parent = path.dirname(dir); if (parent === dir) throw Error('No package.json for ' + file); dir = parent;
  }
  return JSON.parse(fs.readFileSync(path.join(dir, 'package.json'))).version;
}
function loadVersion(label) {
  const req = createRequire(path.join(root, 'versions', label, 'package.json'));
  const loggingPath = req.resolve('@google-cloud/logging/package.json');
  const loggingRequire = createRequire(loggingPath);
  const {v2, Logging} = req('@google-cloud/logging');
  const clientPath = loggingRequire.resolve(label === 'v11'
    ? './build/src/v2/logging_service_v2_client.js'
    : '@google-cloud/logging-api/build/src/v2/logging_service_v2_client.js');
  const clientRequire = createRequire(clientPath);
  return {v2, Logging, clientPath, req, gax: clientRequire('google-gax'),
    version: req('@google-cloud/logging/package.json').version,
    googleGaxVersion: packageVersion(clientRequire.resolve('google-gax')),
    generatedPackageVersion: label === 'v12' ? loggingRequire('@google-cloud/logging-api/package.json').version : null};
}
function safe(value) {
  const seen = new WeakSet();
  return JSON.parse(JSON.stringify(value, (key, v) => {
    if (typeof v === 'function') return `[Function ${v.name || 'anonymous'}]`;
    if (typeof v === 'bigint') return v.toString();
    if (v && typeof v === 'object') {if (seen.has(v)) return '[Circular]'; seen.add(v);}
    return v;
  }));
}
async function inspect(label) {
  const pkg = loadVersion(label);
  // Constructor initializes descriptors synchronously; initialize() is unnecessary here.
  const client = new pkg.v2.LoggingServiceV2Client({projectId: 'offline-investigation'});
  try {
    const d = client.descriptors?.batching?.writeLogEntries;
    return {version: pkg.version, googleGaxVersion: pkg.googleGaxVersion,
      generatedPackageVersion: pkg.generatedPackageVersion,
      nodeVersion: process.version, hasDescriptors: !!client.descriptors,
      hasBatchingDescriptor: !!client.descriptors?.batching,
      hasWriteLogEntriesBatching: !!d,
      batchingDescriptorKeys: Object.keys(client.descriptors?.batching || {}),
      writeLogEntriesBatchingDetails: d ? {type: d.constructor.name, ...safe(d)} : {},
      bundleSettings: safe(client._defaults?.writeLogEntries?.bundleOptions ?? null),
      clientPath: path.relative(root, pkg.clientPath)};
  } finally {await client.close();}
}
async function main(label) {
  try {
    const result = await inspect(label);
    const json = JSON.stringify(result, null, 2) + '\n';
    fs.mkdirSync(path.join(root, 'artifacts'), {recursive: true});
    fs.writeFileSync(path.join(root, 'artifacts', `${label}-runtime.json`), json);
    process.stdout.write(json);
  } catch (err) {console.error(`Cannot inspect ${label}: ${err.stack}`); process.exitCode = 1;}
}
module.exports = {root, loadVersion, inspect, main};
