'use strict';
const {loadVersion} = require('./lib');
async function behavior(label, {restoreBatching = false, bundleOptions, requests} = {}) {
  const {v2, gax} = loadVersion(label);
  const client = new v2.LoggingServiceV2Client({projectId: 'offline-investigation'});
  const calls = [];
  // Replace stub creation before initialize: no credentials, channels or API requests.
  const stub = {writeLogEntries(request, ...args) {
    const callback = args.at(-1);
    calls.push(JSON.parse(JSON.stringify(request)));
    setImmediate(() => callback(null, {}));
    return {cancel() {}};
  }, close() {}};
  client._gaxGrpc.createStub = async () => stub;
  if (restoreBatching) {
    const v11 = loadVersion('v11');
    const original = new v11.v2.LoggingServiceV2Client({projectId: 'offline-investigation'});
    const d = original.descriptors.batching.writeLogEntries;
    const descriptor = new gax.BundleDescriptor(d.bundledField, d.requestDiscriminatorFields, d.subresponseField, d.byteLengthFunction);
    client._defaults.writeLogEntries = new gax.CallSettings({
      ...client._defaults.writeLogEntries,
      bundleOptions: {...original._defaults.writeLogEntries.bundleOptions, delayThreshold: 20},
    });
    await original.close();
    // Diagnostic only: emulate the missing generated descriptor-selection branch.
    await client.initialize();
    client.innerApiCalls.writeLogEntries = gax.createApiCall(
      Promise.resolve(stub.writeLogEntries.bind(stub)), client._defaults.writeLogEntries, descriptor);
  }
  if (bundleOptions) client._defaults.writeLogEntries.bundleOptions = {...client._defaults.writeLogEntries.bundleOptions, ...bundleOptions};
  const input = requests || [1, 2].map(i => ({logName: 'projects/offline-investigation/logs/test',
    resource: {type: 'global'}, labels: {test: 'batch'}, entries: [{textPayload: `entry-${i}`}]}));
  try {
    await client.initialize();
    await Promise.all(input.map(request => client.writeLogEntries(request)));
    return {label, restoreBatching, logicalWrites: input.length, transportCalls: calls.length,
      entriesPerCall: calls.map(c => c.entries.length), requests: calls};
  } finally {await client.close();}
}
async function higherLevel(label) {
  const {Logging} = loadVersion(label);
  const logging = new Logging({projectId: 'offline-investigation'});
  logging.detectedResource = {type: 'global'};
  const calls = [];
  logging.loggingService.writeLogEntries = async request => {calls.push(request); return [{}];};
  const log = logging.log('test', {removeCircular: true});
  try {
    await log.write([log.entry({resource: {type: 'global'}}, 'one'), log.entry({resource: {type: 'global'}}, 'two')], {resource: {type: 'global'}});
    return {label, transportCalls: calls.length, entriesPerCall: calls.map(r=>r.entries.length),
      userEntries: calls.flatMap(r=>r.entries).filter(e=>e.textPayload === 'one' || e.textPayload === 'two').length};
  } finally {await logging.loggingService.close(); await logging.configService.close();}
}
module.exports = {behavior, higherLevel};
if (require.main === module) (async () => {
  const fs = require('node:fs');
  const results = {gapic: [await behavior('v11'), await behavior('v12')],
    restoredV12: await behavior('v12', {restoreBatching: true}),
    higherLevel: [await higherLevel('v11'), await higherLevel('v12')]};
  const json = JSON.stringify(results, null, 2) + '\n';
  fs.writeFileSync('artifacts/behavior.json', json); process.stdout.write(json);
})().catch(e=>{console.error(e);process.exitCode=1});
