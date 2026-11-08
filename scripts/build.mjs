import { constants } from 'node:fs';
import { copyFile, lstat, mkdir, readdir, realpath, rm } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = fileURLToPath(new URL('../', import.meta.url));
export const BUILD_ENTRIES = Object.freeze([
  'index.html', 'src', 'vendor', 'assets', 'favicon.svg', 'site.webmanifest',
  'CNAME', '.nojekyll', 'robots.txt', 'sitemap.xml', 'docs',
]);
const EXCLUDED_NAMES = new Set([
  'node_modules', 'test', 'tests', '__tests__', 'e2e', 'coverage',
  'playwright-report', 'playwright-output', 'playwright-results', 'test-results',
  'test-screenshots', '__screenshots__', '__snapshots__', 'blob-report',
  'output', 'private',
]);

export function isPublishablePath(path) {
  if (path === '.nojekyll') return true;
  return path.split(/[\\/]/).every((part) => {
    const name = part.toLowerCase();
    return !part.startsWith('.')
      && !EXCLUDED_NAMES.has(name)
      && !/^(github-private-|github-\d{4}-\d{2}-\d{2}|parsifal-redesign-|private-)/.test(name)
      && !/^(infra-|org-).+\.(json|md|txt|py)$/.test(name)
      && !/\.(test|spec)\.[cm]?[jt]sx?$/.test(name);
  });
}

function assertInside(root, target) {
  const path = relative(root, target);
  if (path === '' || isAbsolute(path) || path === '..' || path.startsWith('..' + sep)) {
    throw new Error('Build path must remain inside the project.');
  }
}

async function optionalStat(path) {
  try {
    return await lstat(path);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

export async function build() {
  const root = await realpath(PROJECT_ROOT);
  const dist = join(root, 'dist');
  if (basename(dist) !== 'dist' || dirname(dist) !== root) throw new Error('Unsafe output directory.');
  assertInside(root, dist);
  const outputInfo = await optionalStat(dist);
  if (outputInfo && (outputInfo.isSymbolicLink() || !outputInfo.isDirectory())) {
    throw new Error('Refusing to clean dist: it must be a real directory, not a symlink or file.');
  }

  const directories = [];
  const files = [];
  const included = [];
  const missing = [];

  async function collect(source, path, info) {
    if (!isPublishablePath(path)) return;
    assertInside(root, source);
    if (info.isSymbolicLink()) throw new Error('Build inputs cannot contain symlinks: ' + path);
    if (info.isDirectory()) {
      directories.push(path);
      for (const name of (await readdir(source)).sort()) {
        const child = join(source, name);
        const childPath = join(path, name);
        if (isPublishablePath(childPath)) await collect(child, childPath, await lstat(child));
      }
    } else if (info.isFile()) {
      files.push({ source, path });
    } else {
      throw new Error('Unsupported build input: ' + path);
    }
  }

  // Validate every existing input before touching the previous output.
  for (const entry of BUILD_ENTRIES) {
    const source = join(root, entry);
    const info = await optionalStat(source);
    if (!info) {
      missing.push(entry);
      continue;
    }
    await collect(source, entry, info);
    included.push(entry);
  }

  // No command-line output override: cleanup is restricted to this project's dist.
  await rm(dist, { recursive: true, force: true });
  await mkdir(dist, { recursive: true });
  for (const path of directories) {
    const destination = join(dist, path);
    assertInside(dist, destination);
    await mkdir(destination, { recursive: true });
  }
  for (const { source, path } of files) {
    const destination = join(dist, path);
    assertInside(dist, destination);
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(source, destination, constants.COPYFILE_EXCL);
  }
  console.log('Built ' + files.length + ' files into dist/.');
  console.log('Included: ' + included.join(', '));
  if (missing.length) console.log('Skipped missing entries: ' + missing.join(', '));
  return { directory: dist, fileCount: files.length, included, missing };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await build();
  } catch (error) {
    console.error('Build failed: ' + error.message);
    process.exitCode = 1;
  }
}
