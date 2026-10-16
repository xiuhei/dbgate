const fs = require('fs-extra');

const path = require('path');
const { extractPackageName, assertValidPluginPackageName } = require('dbgate-tools');
const { pluginsdir, packagedPluginsDir } = require('../utility/directories');
const socket = require('../utility/socket');

const requirePlugin = require('../shell/requirePlugin');

const { hasPermission, loadPermissionsFromRequest } = require('../utility/hasPermission');
const _ = require('lodash');
const packagedPluginsContent = require('../packagedPluginsContent');

module.exports = {
  script_meta: true,
  async script({ packageName }) {
    assertValidPluginPackageName(packageName);
    const packagedContent = packagedPluginsContent();

    if (packagedContent && packagedContent[packageName]) {
      return packagedContent[packageName].frontend;
    }

    const file1 = path.join(packagedPluginsDir(), packageName, 'dist', 'frontend.js');
    const file2 = path.join(pluginsdir(), packageName, 'dist', 'frontend.js');
    // @ts-ignore
    const file = (await fs.exists(file1)) ? file1 : file2;
    const data = await fs.readFile(file, {
      encoding: 'utf-8',
    });
    return data;
  },

  installed_meta: true,
  async installed() {
    const packagedContent = packagedPluginsContent();

    const files1 = packagedContent ? _.keys(packagedContent) : await fs.readdir(packagedPluginsDir());
    const files2 = await fs.readdir(pluginsdir());

    const res = [];
    for (const packageName of _.union(files1, files2)) {
      if (packageName == 'dist') continue;
      if (!/^dbgate-plugin-.*$/.test(packageName)) continue;
      try {
        if (packagedContent && packagedContent[packageName]) {
          const manifest = {
            ...packagedContent[packageName].manifest,
          };
          manifest.isPackaged = true;
          manifest.readme = packagedContent[packageName].readme;
          res.push(manifest);
        } else {
          const isPackaged = files1.includes(packageName);
          const manifest = await fs
            .readFile(path.join(isPackaged ? packagedPluginsDir() : pluginsdir(), packageName, 'package.json'), {
              encoding: 'utf-8',
            })
            .then(x => JSON.parse(x));
          if (!manifest.keywords) {
            continue;
          }
          if (!manifest.keywords.includes('dbgateplugin') && !manifest.keywords.includes('dbgatebuiltin')) {
            continue;
          }
          const readmeFile = path.join(isPackaged ? packagedPluginsDir() : pluginsdir(), packageName, 'README.md');
          // @ts-ignore
          if (await fs.exists(readmeFile)) {
            manifest.readme = await fs.readFile(readmeFile, { encoding: 'utf-8' });
          }
          manifest.isPackaged = isPackaged;
          res.push(manifest);
        }
      } catch (err) {
        console.log(`Skipped plugin ${packageName}, error:`, err.message);
      }
    }
    return res;
  },

  uninstall_meta: true,
  async uninstall({ packageName }, req) {
    const loadedPermissions = await loadPermissionsFromRequest(req);
    if (!hasPermission(`plugins/install`, loadedPermissions)) return;
    assertValidPluginPackageName(packageName);
    const dir = path.join(pluginsdir(), packageName);
    await fs.rmdir(dir, { recursive: true });
    socket.emitChanged(`installed-plugins-changed`);
    // this.removedPlugins.push(packageName);
    // await this.saveRemovePlugins();
    return true;
  },

  command_meta: true,
  async command({ packageName, command, args }, req) {
    const loadedPermissions = await loadPermissionsFromRequest(req);
    if (!hasPermission(`plugins/command`, loadedPermissions)) {
      throw new Error('DBGM-00000 Permission plugins/command not granted');
    }

    assertValidPluginPackageName(packageName);
    const content = requirePlugin(packageName);

    // Only dispatch to own, function-valued command handlers. This prevents reaching
    // inherited/prototype members (eg. constructor, __proto__) via the command name.
    const commands = (content && content.commands) || {};
    if (
      typeof command !== 'string' ||
      !Object.prototype.hasOwnProperty.call(commands, command) ||
      typeof commands[command] !== 'function'
    ) {
      throw new Error(`DBGM-00000 Unknown plugin command: ${String(command).substring(0, 100)}`);
    }
    return commands[command](args);
  },

  authTypes_meta: true,
  async authTypes({ engine }) {
    const packageName = extractPackageName(engine);
    if (!packageName) return null;
    const content = requirePlugin(packageName);
    const driver = content.drivers.find(x => x.engine == engine);
    if (!driver || !driver.getAuthTypes) return null;
    return driver.getAuthTypes() || null;
  },

};
