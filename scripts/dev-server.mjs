import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { pipeline } from 'node:stream';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = fileURLToPath(new URL('../', import.meta.url));
const HOST = '127.0.0.1';
const MIME_TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
  ['.webmanifest', 'application/manifest+json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.webp', 'image/webp'],
  ['.avif', 'image/avif'],
  ['.ico', 'image/x-icon'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
  ['.ttf', 'font/ttf'],
  ['.otf', 'font/otf'],
  ['.wasm', 'application/wasm'],
  ['.gltf', 'model/gltf+json'],
  ['.glb', 'model/gltf-binary'],
  ['.mp3', 'audio/mpeg'],
  ['.wav', 'audio/wav'],
  ['.ogg', 'audio/ogg'],
  ['.m4a', 'audio/mp4'],
  ['.aac', 'audio/aac'],
  ['.flac', 'audio/flac'],
  ['.mp4', 'video/mp4'],
  ['.webm', 'video/webm'],
  ['.pdf', 'application/pdf'],
  ['.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  ['.md', 'text/markdown; charset=utf-8'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.xml', 'application/xml; charset=utf-8'],
]);

function httpError(status) {
  return Object.assign(new Error('Request rejected'), { status });
}

function isInside(root, target) {
  const path = relative(root, target);
  return path === '' || (!isAbsolute(path) && path !== '..' && !path.startsWith('..' + sep));
}

function hasBlockedSegment(path) {
  return path.split(/[\\/]/).some((part) => part.startsWith('.') || part.toLowerCase() === 'node_modules');
}

// Inspect the raw path before URL normalization can hide encoded dot segments.
export function parseRequestPath(requestTarget) {
  if (!requestTarget?.startsWith('/') || requestTarget.startsWith('//')) throw httpError(400);
  let pathname;
  try {
    pathname = decodeURIComponent(requestTarget.split(/[?#]/, 1)[0]);
  } catch {
    throw httpError(400);
  }
  if (/[\u0000-\u001f\u007f]/.test(pathname)) throw httpError(400);
  if (pathname.includes('\\') || hasBlockedSegment(pathname)) throw httpError(403);
  return pathname;
}

function sendText(request, response, status, message) {
  if (response.destroyed) return;
  response.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(message),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...(status === 405 ? { Allow: 'GET, HEAD' } : {}),
  });
  response.end(request.method === 'HEAD' ? undefined : message);
}

export async function createDevServer({ root = PROJECT_ROOT } = {}) {
  const documentRoot = await realpath(root);

  async function checkedRealPath(path) {
    if (!isInside(documentRoot, path)) throw httpError(403);
    const actual = await realpath(path);
    if (!isInside(documentRoot, actual) || hasBlockedSegment(relative(documentRoot, actual))) {
      throw httpError(403);
    }
    return actual;
  }

  return createServer(async (request, response) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      sendText(request, response, 405, 'Method Not Allowed\n');
      return;
    }
    try {
      const pathname = parseRequestPath(request.url);
      let path = await checkedRealPath(resolve(documentRoot, '.' + pathname));
      let info = await stat(path);
      if (info.isDirectory()) {
        path = await checkedRealPath(resolve(path, 'index.html'));
        info = await stat(path);
      }
      if (!info.isFile()) throw httpError(404);
      response.writeHead(200, {
        'Content-Type': MIME_TYPES.get(extname(path).toLowerCase()) ?? 'application/octet-stream',
        'Content-Length': info.size,
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff',
      });
      if (request.method === 'HEAD') {
        response.end();
        return;
      }
      pipeline(createReadStream(path), response, (error) => {
        if (error && !response.destroyed) response.destroy();
      });
    } catch (error) {
      if (response.headersSent) {
        response.destroy();
        return;
      }
      const status = error.status ?? (
        ['ENOENT', 'ENOTDIR'].includes(error.code) ? 404
          : ['EACCES', 'EPERM', 'ELOOP'].includes(error.code) ? 403 : 500
      );
      const message = { 400: 'Bad Request', 403: 'Forbidden', 404: 'Not Found', 500: 'Internal Server Error' }[status];
      sendText(request, response, status, message + '\n');
    }
  });
}

export function parsePort(args = process.argv.slice(2), env = process.env) {
  let argument;
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    if (flag !== '--port' && !flag.startsWith('--port=')) throw new Error('Unknown argument: ' + flag);
    if (argument !== undefined) throw new Error('Specify --port only once.');
    argument = flag === '--port' ? args[++index] : flag.slice('--port='.length);
    if (argument === undefined) throw new Error('--port requires a value.');
  }
  const value = argument ?? env.PORT ?? '4173';
  const port = Number(value);
  if (!/^\d+$/.test(String(value)) || !Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new Error('Port must be an integer from 1 to 65535.');
  }
  return port;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const port = parsePort();
    const server = await createDevServer();
    server.on('error', (error) => {
      console.error('Development server failed: ' + error.message);
      process.exitCode = 1;
    });
    server.listen(port, HOST, () => {
      console.log('Development server: http://' + HOST + ':' + port + '/');
    });
    const close = () => server.close(() => process.exit(0));
    process.once('SIGINT', close);
    process.once('SIGTERM', close);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
