const fs = require('fs');
const os = require('os');
const path = require('path');

if (!process.versions.electron) {
  const { spawnSync } = require('child_process');
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'dbgate-desktop-test-'));
  const archive = path.resolve(process.argv[2] || path.join(__dirname, 'dist/win-unpacked/resources/app.asar'));
  const env = { ...process.env, WORKSPACE_DIR: workspace };
  for (const key of ['ELECTRON_RUN_AS_NODE', 'DEVMODE', 'ELECTRON_START_URL']) delete env[key];
  const result = spawnSync(require('electron'), [__filename, archive], {
    env,
    stdio: 'inherit',
    windowsHide: true,
    timeout: 45000,
  });
  if (result.error) console.error(result.error);
  process.exit(result.status ?? 1);
}

const assert = require('assert/strict');
const { app, ipcMain } = require('electron');
const archive = process.argv[2];
app.setPath('userData', path.join(process.env.WORKSPACE_DIR, 'electron'));
app.setAppPath(archive);

function fail(error) {
  console.error(error);
  app.exit(1);
}

process.on('uncaughtException', fail);
process.on('unhandledRejection', fail);
setTimeout(() => fail(new Error('DBGM-00000 Desktop startup timed out')), 35000);

app.on('browser-window-created', (event, window) => {
  window.hide();
  window.webContents.on('did-fail-load', (event, code, description) => fail(new Error(description)));
  window.webContents.on('render-process-gone', (event, details) => fail(new Error(details.reason)));
});

ipcMain.once('app-started', async event => {
  try {
    const result = await event.sender.executeJavaScript(`(async () => {
      const waitFor = async selector => {
        for (let attempt = 0; attempt < 100; attempt++) {
          const element = document.querySelector(selector);
          if (element) return element;
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        throw new Error('DBGM-00000 Missing desktop control: ' + selector);
      };
      await waitFor('[data-testid="WidgetIconPanel_database"]');
      (await waitFor('[data-testid="WidgetIconPanel_settings"]')).click();
      await waitFor('[data-testid="settings-general"]');
      const ipc = require('electron').ipcRenderer;
      const connection = await ipc.invoke('connections-new-sqlite-database', { file: 'desktop-startup' });
      const query = await ipc.invoke('sessions-execute-reader', {
        conid: connection._id, database: connection.defaultDatabase, sql: 'SELECT 42 AS answer'
      });
      if (!query.jslid) throw new Error(JSON.stringify(query));
      for (let attempt = 0; attempt < 100; attempt++) {
        const rows = await ipc.invoke('jsldata-get-rows', { jslid: query.jslid, offset: 0, limit: 10 });
        if (rows.length) return { answer: rows[0].answer };
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      throw new Error('DBGM-00000 Desktop SQLite query timed out');
    })()`);
    assert.equal(result.answer, 42);
    console.log('PASS packaged Electron entry, window, settings, IPC and SQLite query');
    app.exit(0);
  } catch (error) {
    fail(error);
  }
});

try {
  require(path.join(archive, 'src/electron.js'));
} catch (error) {
  fail(error);
}
