import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync, existsSync } from 'node:fs';

const source = readFileSync(new URL('./sw.js', import.meta.url), 'utf8');

function worker(base = 'https://tchez.github.io/workout/') {
  const handlers = {};
  const cached = new Map();
  const deleted = [];
  let precached = [];
  const self = { location: { href: base + 'sw.js' }, addEventListener: (type, handler) => { handlers[type] = handler; }, clients: { claim: async () => {} }, skipWaiting: () => {} };
  const cache = { addAll: async entries => { precached = entries; }, match: async request => cached.get(typeof request === 'string' ? request : request.url) };
  const context = vm.createContext({ self, URL, caches: { open: async () => cache, keys: async () => ['workout:%2Fworkout%2F:old', 'workout:%2Fother%2F:old', 'unrelated'], delete: async key => { deleted.push(key); } }, fetch: async () => { throw new Error('offline'); } });
  vm.runInContext(source, context);
  return { handlers, cached, deleted, precached: () => precached };
}

test('GitHub repository paths are preserved by manifest, precache and registration', async () => {
  const w = worker();let pending;
  w.handlers.install({ waitUntil: promise => { pending = promise; } });await pending;
  for (const url of w.precached()) {
    assert.ok(url.startsWith('https://tchez.github.io/workout/'));
    assert.ok(existsSync(new URL('./' + url.split('/workout/')[1], import.meta.url)), url);
  }
  const manifest = JSON.parse(readFileSync(new URL('./manifest.webmanifest', import.meta.url), 'utf8'));
  assert.equal(manifest.scope, './');
  assert.equal(manifest.start_url, './');
  for (const icon of manifest.icons) assert.ok(existsSync(new URL(icon.src, import.meta.url)));
});

test('cached navigation and code can load while the network is offline', async () => {
  const w = worker();
  const base = 'https://tchez.github.io/workout/';
  w.cached.set(base + 'index.html', { body: 'offline shell' });
  w.cached.set(base + 'state.js', { body: 'offline module' });
  for (const [url, mode, expected] of [[base + '?source=home', 'navigate', 'offline shell'], [base + 'state.js', 'cors', 'offline module']]) {
    let response;
    w.handlers.fetch({ request: { url, mode, method: 'GET' }, respondWith: promise => { response = promise; } });
    assert.equal((await response).body, expected);
  }
});

test('activation only removes old caches belonging to this app path', async () => {
  const w = worker();let pending;
  w.handlers.activate({ waitUntil: promise => { pending = promise; } });await pending;
  assert.deepEqual(w.deleted, ['workout:%2Fworkout%2F:old']);
});

test('external videos, other Pages projects and non-GET requests are untouched', () => {
  const w = worker();
  for (const [url, method] of [['https://www.youtube.com/watch?v=example', 'GET'], ['https://tchez.github.io/other/index.html', 'GET'], ['https://tchez.github.io/workout/index.html', 'POST']]) {
    w.handlers.fetch({ request: { url, method, mode: 'cors' }, respondWith: () => assert.fail('request should not be intercepted') });
  }
});
