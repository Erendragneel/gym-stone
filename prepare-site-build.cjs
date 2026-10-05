#!/usr/bin/env node
'use strict';

// Usage: node prepare-site-build.cjs <absolute-new-staging-dir> <absolute-archive.tar.gz>
// Copies only the static build and Sites metadata. Existing outputs are never removed.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function outputPath(input) {
  if (!path.isAbsolute(input) || (process.platform === 'win32' && path.parse(input).root.length < 3)) {
    throw new Error('Both output arguments must be fully qualified absolute paths.');
  }
  const resolved = path.resolve(input);
  const parent = fs.realpathSync(path.dirname(resolved));
  if (!fs.statSync(parent).isDirectory()) throw new Error('Output parent must be an existing directory.');
  return path.join(parent, path.basename(resolved));
}

function within(parent, child) {
  const relative = path.relative(parent, child);
  return relative === '' || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + path.sep));
}

function checkSource(source, directory) {
  const stat = fs.lstatSync(source);
  if (stat.isSymbolicLink() || (directory ? !stat.isDirectory() : !stat.isFile())) {
    throw new Error('Source must be a regular ' + (directory ? 'directory: ' : 'file: ') + source);
  }
  if (directory) {
    for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) throw new Error('Static build contains a symbolic link: ' + entry.name);
      checkSource(path.join(source, entry.name), entry.isDirectory());
    }
  }
}

function main() {
  const args = process.argv.slice(2);
  if (args.length !== 2) throw new Error('Usage: node prepare-site-build.cjs <absolute-new-staging-dir> <absolute-archive.tar.gz>');
  const repo = fs.realpathSync(__dirname);
  const staging = outputPath(args[0]);
  const archive = outputPath(args[1]);
  if (within(repo, staging) || within(repo, archive)) throw new Error('Keep staging and archive outside the source repository.');
  if (within(staging, archive)) throw new Error('Archive must be outside the staging directory.');
  if (fs.existsSync(staging) || fs.existsSync(archive)) throw new Error('Staging directory and archive must not already exist.');
  const gzip = /\.(?:tar\.gz|tgz)$/i.test(archive);
  if (!gzip && !/\.tar$/i.test(archive)) throw new Error('Archive extension must be .tar.gz, .tgz, or .tar.');

  const dist = path.join(repo, 'dist');
  const hosting = path.join(repo, '.openai', 'hosting.json');
  checkSource(dist, true);
  checkSource(hosting, false);
  const windowsRoot = process.env.SystemRoot || process.env.WINDIR;
  if (process.platform === 'win32' && !windowsRoot) throw new Error('Windows system directory is unavailable.');
  const tar = process.platform === 'win32' ? path.join(windowsRoot, 'System32', 'tar.exe') : 'tar';
  if (process.platform === 'win32' && !fs.existsSync(tar)) throw new Error('Windows native tar.exe was not found.');

  fs.mkdirSync(staging); // Exclusive fresh directory; never recursively remove an old build.
  fs.cpSync(dist, path.join(staging, 'dist'), { recursive: true, force: false, errorOnExist: true });
  fs.mkdirSync(path.join(staging, '.openai'));
  fs.copyFileSync(hosting, path.join(staging, '.openai', 'hosting.json'), fs.constants.COPYFILE_EXCL);
  fs.closeSync(fs.openSync(archive, 'wx')); // Reserve an output we own before tar writes it.
  const result = spawnSync(tar, [gzip ? '-czf' : '-cf', archive, '-C', staging, 'dist', '.openai/hosting.json'], { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error('tar failed with exit status ' + result.status + '; staged files remain for inspection.');
  console.log('Staging: ' + staging);
  console.log('Archive: ' + archive);
}

try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
