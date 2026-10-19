'use strict';
const {test, before, after} = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const http = require('node:http');
const https = require('node:https');
const {inspect, loadVersion} = require('../scripts/lib');
const {behavior, higherLevel} = require('../scripts/behavior');
const originals = [];
before(() => {
  for (const [object, key] of [[net.Socket.prototype, 'connect'], [http, 'request'], [https, 'request'], [globalThis, 'fetch']]) {
    originals.push([object, key, object[key]]);
    object[key] = () => {throw Error('Network access forbidden in offline regression tests');};
  }
});
after(() => {for (const [object, key, value] of originals) object[key] = value;});
test('metadata regression: v11 descriptor present, v12 batching object empty', async () => {
  const a = await inspect('v11'), b = await inspect('v12');
  assert.equal(a.hasDescriptors, true); assert.equal(b.hasDescriptors, true);
  assert.equal(a.hasBatchingDescriptor, true); assert.equal(b.hasBatchingDescriptor, true);
  assert.equal(a.hasWriteLogEntriesBatching, true);
  assert.equal(b.hasWriteLogEntriesBatching, false);
  assert.deepEqual(b.batchingDescriptorKeys, []);
});
test('actual GAPIC calls: v11 coalesces two writes; v12 sends two calls', async () => {
  const a = await behavior('v11'), b = await behavior('v12');
  assert.equal(a.transportCalls, 1); assert.deepEqual(a.entriesPerCall, [2]);
  assert.equal(b.transportCalls, 2); assert.deepEqual(b.entriesPerCall, [1, 1]);
  if (process.env.ASSERT_V11_PARITY === '1') {
    assert.equal(b.transportCalls, a.transportCalls, 'REGRESSION DEMONSTRATION: v12 must retain v11 automatic batching');
  }
});
test('v12 google-gax still batches when descriptor, settings and selection are restored', async () => {
  const result = await behavior('v12', {restoreBatching: true});
  assert.equal(result.transportCalls, 1); assert.deepEqual(result.entriesPerCall, [2]);
});
test('v11 discriminator separates different log names', async () => {
  const requests = ['a', 'b'].map(name => ({logName: `projects/offline-investigation/logs/${name}`, resource: {type: 'global'}, entries: [{textPayload: name}]}));
  const result = await behavior('v11', {requests});
  assert.equal(result.transportCalls, 2);
});
test('higher-level explicit arrays preserve both user entries in one request in both versions', async () => {
  for (const label of ['v11', 'v12']) {
    const result = await higherLevel(label);
    assert.equal(result.transportCalls, 1); assert.equal(result.userEntries, 2);
  }
});
