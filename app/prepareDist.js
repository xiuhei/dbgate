const fs = require('fs');
const path = require('path');

const destination = path.join(__dirname, 'packages');
fs.rmSync(destination, { recursive: true, force: true });
for (const [source, target] of [
  ['packages/api/dist', 'api/dist'],
  ['packages/web/public', 'web/public'],
  ['plugins/dist', 'plugins'],
]) {
  fs.cpSync(path.join(__dirname, '..', source), path.join(destination, target), { recursive: true });
}
