const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const executable = process.env.ELECTRON_PATH || path.resolve(__dirname, '../app/dist/win-unpacked/DbGate.exe');
const apiBundle = path.resolve(__dirname, '../app/packages/api/dist/bundle.js');
if (!fs.existsSync(executable) || !fs.existsSync(apiBundle)) {
  throw new Error('DBGM-00000 Build the desktop app before starting the local test server');
}
const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'dbgate-local-test-'));
const server = spawn(executable, [apiBundle, '--listen-api'], {
  env: {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
    WORKSPACE_DIR: workspace,
    DEVWEB: '1',
    PORT: '3000',
    HOST: '127.0.0.1',
  },
  stdio: 'inherit',
  windowsHide: true,
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.kill());
server.on('error', error => { console.error(error); process.exitCode = 1; });
server.on('exit', code => { process.exitCode = code || 0; });
