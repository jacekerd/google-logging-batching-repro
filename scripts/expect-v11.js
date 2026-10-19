'use strict';
const {spawnSync} = require('node:child_process');
const path = require('node:path');
const result = spawnSync(process.execPath, ['--test', 'test/batching-regression.test.js'], {
  cwd: path.resolve(__dirname, '..'),
  env: {...process.env, ASSERT_V11_PARITY: '1'},
  stdio: 'inherit',
});
if (result.error) {console.error(result.error); process.exitCode = 1;}
else process.exitCode = result.status ?? 1;
