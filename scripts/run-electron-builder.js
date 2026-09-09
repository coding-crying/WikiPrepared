#!/usr/bin/env node
/* eslint-disable no-console */
const path = require('path');
const { spawnSync } = require('child_process');
const os = require('os');
const fs = require('fs');

// electron-builder calls `npm` internally to collect the dependency tree.
// Some npm installations emit warnings to stdout (e.g. polluted by global/env configs),
// which breaks electron-builder's JSON parsing. Force a quiet loglevel.
//
// We also isolate npm config to a clean temp npmrc to avoid "Unknown config" warnings
// polluting stdout during `npm ls --json`.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wikiprepared-npmrc-'));
const cleanUserNpmrc = path.join(tmpDir, 'user.npmrc');
const cleanGlobalNpmrc = path.join(tmpDir, 'global.npmrc');
fs.writeFileSync(cleanUserNpmrc, '', 'utf8');
fs.writeFileSync(cleanGlobalNpmrc, '', 'utf8');

const env = {
  ...process.env,
  NPM_CONFIG_LOGLEVEL: process.env.NPM_CONFIG_LOGLEVEL || 'error',
  NPM_CONFIG_AUDIT: process.env.NPM_CONFIG_AUDIT || 'false',
  NPM_CONFIG_FUND: process.env.NPM_CONFIG_FUND || 'false',
  NPM_CONFIG_UPDATE_NOTIFIER: process.env.NPM_CONFIG_UPDATE_NOTIFIER || 'false',
  // Override user/global configs unless the user explicitly set them.
  NPM_CONFIG_USERCONFIG: process.env.NPM_CONFIG_USERCONFIG || cleanUserNpmrc,
  NPM_CONFIG_GLOBALCONFIG: process.env.NPM_CONFIG_GLOBALCONFIG || cleanGlobalNpmrc,
};

// Some environments set `npm_config_python`, which newer npm versions warn about.
// Remove it to keep `npm ls --json` output clean for electron-builder.
delete env.npm_config_python;
delete env.NPM_CONFIG_PYTHON;

const bin = path.join(
  __dirname,
  '..',
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'electron-builder.cmd' : 'electron-builder'
);

const args = process.argv.slice(2);
const res = spawnSync(bin, args, { stdio: 'inherit', env });

if (res.error) {
  console.error(res.error);
  process.exit(1);
}

process.exit(typeof res.status === 'number' ? res.status : 1);
