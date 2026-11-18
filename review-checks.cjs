const { spawnSync } = require('node:child_process');

const result = spawnSync(process.execPath, [
  '--test',
  'tests/trainerOwnership.test.cjs',
  'tests/progressReset.test.cjs',
  'tests/progressStorage.test.cjs'
], { cwd: __dirname, stdio: 'inherit' });

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
