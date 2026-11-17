import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { STORAGE_KEY, LEGACY_KEY, emptyState, createSession, setKey, sessionKey, validateState, loadState, saveState, exportBackup, parseBackup, replaceFromBackup, summarize } from './state.js';

const days = JSON.parse(readFileSync(new URL('./workout.json', import.meta.url), 'utf8'));
const memory = () => {
  const entries = new Map();
  return { getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value), removeItem: key => entries.delete(key) };
};

function withSession(sessionDate = '2026-11-17', day = days[1]) {
  const state = emptyState();
  const session = createSession(sessionDate, day);
  session.sets[setKey(day.exercises[0], 0)] = true;
  state.sessions[sessionKey(sessionDate, day.id)] = session;
  return state;
}

test('dated sessions survive saving, loading and crossing a day boundary', () => {
  const storage = memory();
  const state = withSession();
  const next = createSession('2026-11-18', days[2]);
  state.sessions[sessionKey(next.date, next.dayId)] = next;
  saveState(storage, state);
  const result = loadState(storage, days);
  assert.equal(result.available, true);
  assert.equal(Object.keys(result.state.sessions).length, 2);
  assert.equal(result.state.sessions['2026-11-17:tue'].sets['supino-inclinado-com-halteres:0'], true);
});

test('backup round trip retains all sessions, preferences and prescription snapshots', () => {
  const state = withSession();
  state.preferences.theme = 'light';
  const restored = parseBackup(exportBackup(state));
  assert.deepEqual(restored.state, state);
  const before = state.sessions['2026-11-17:tue'].exercises[0].name;
  const planCopy = structuredClone(days);
  planCopy[1].exercises[0].name = 'Changed plan name';
  assert.equal(restored.state.sessions['2026-11-17:tue'].exercises[0].name, before);
});

test('confirmed replacement replaces rather than merges and only writes its own key', () => {
  const storage = memory();
  storage.setItem('another-app', 'keep');
  saveState(storage, withSession('2026-11-16', days[0]));
  const incoming = withSession();
  replaceFromBackup(storage, exportBackup(incoming));
  const result = loadState(storage, days).state;
  assert.deepEqual(Object.keys(result.sessions), ['2026-11-17:tue']);
  assert.equal(storage.getItem('another-app'), 'keep');
});

test('previewing an import does not mutate saved data', () => {
  const storage = memory();
  saveState(storage, withSession());
  const before = storage.getItem(STORAGE_KEY);
  parseBackup(exportBackup(emptyState()));
  assert.equal(storage.getItem(STORAGE_KEY), before);
});

test('malformed, future, invalid-date and inconsistent backups cannot overwrite local data', () => {
  const storage = memory();
  saveState(storage, withSession());
  const before = storage.getItem(STORAGE_KEY);
  const original = JSON.parse(exportBackup(withSession()));
  const invalid = [ '{', '{}', JSON.stringify({ ...original, formatVersion: 2 }) ];
  for (const mutate of [
    value => { value.state.preferences.theme = 'unknown'; },
    value => { value.state.sessions['2026-11-17:tue'].date = '2026-02-31'; },
    value => { value.state.sessions['2026-11-17:tue'].sets['__proto__'] = true; },
    value => { value.state.sessions['2026-11-17:tue'].finished = true; },
    value => { value.state.sessions['2026-11-17:tue'].exercises[0].sets = -1; },
    value => { value.state.sessions['2026-11-17:tue'].sets['supino-inclinado-com-halteres:0'] = 'yes'; }
  ]) {
    const changed = structuredClone(original);
    mutate(changed);
    invalid.push(JSON.stringify(changed));
  }
  // Explicitly include an own __proto__ property, as JSON input can contain one.
  invalid.push(exportBackup(withSession()).replace('"sets": {', '"sets": {"__proto__": true,'));
  for (const text of invalid) {
    // Setting __proto__ through assignment above does not create an own property.
    if (text === JSON.stringify(original)) continue;
    assert.throws(() => replaceFromBackup(storage, text));
    assert.equal(storage.getItem(STORAGE_KEY), before);
  }
});

test('a quota error leaves the existing saved state untouched', () => {
  const storage = memory();
  saveState(storage, withSession());
  const before = storage.getItem(STORAGE_KEY);
  const blocked = { getItem: storage.getItem, setItem: () => { throw new Error('QuotaExceededError'); } };
  assert.throws(() => replaceFromBackup(blocked, exportBackup(emptyState())), /QuotaExceededError/);
  assert.equal(storage.getItem(STORAGE_KEY), before);
});

test('legacy marks migrate to stable exercise keys without changing the legacy entry', () => {
  const storage = memory();
  const legacy = JSON.stringify({ theme: 'system', sessionDate: '2026-11-17', sessions: { 1: { warm: true, finished: false, sets: { '0-0': true, '1-2': false } } } });
  storage.setItem(LEGACY_KEY, legacy);
  const result = loadState(storage, days);
  assert.equal(result.migrated, true);
  assert.equal(result.state.preferences.theme, 'system');
  assert.equal(result.state.sessions['2026-11-17:tue'].sets['supino-inclinado-com-halteres:0'], true);
  assert.equal(storage.getItem(LEGACY_KEY), legacy);
});

test('failed legacy migration persistence still returns the recovered in-memory marks', () => {
  const legacy = JSON.stringify({ theme: 'dark', sessionDate: '2026-11-17', sessions: { 1: { warm: false, finished: false, sets: { '0-0': true } } } });
  const storage = { getItem: key => key === LEGACY_KEY ? legacy : null, setItem: () => { throw new Error('Blocked'); } };
  const result = loadState(storage, days);
  assert.equal(result.available, false);
  assert.equal(result.state.sessions['2026-11-17:tue'].sets['supino-inclinado-com-halteres:0'], true);
});

test('corrupt saved data is preserved on disk for recovery and is not silently reset', () => {
  const storage = memory();
  storage.setItem(STORAGE_KEY, '{broken');
  const result = loadState(storage, days);
  assert.equal(result.available, false);
  assert.equal(storage.getItem(STORAGE_KEY), '{broken');
});

test('summary counts only completed sets and explicitly finalized sessions', () => {
  const state = withSession();
  const summary = summarize(state);
  assert.equal(summary.sessions, 1);
  assert.equal(summary.finished, 0);
  assert.equal(summary.completedSets, 1);
  assert.equal(summary.firstDate, '2026-11-17');
  assert.ok(summary.bytes > 0);
});

test('oversize files are rejected before parsing', () => {
  assert.throws(() => parseBackup(' '.repeat(5 * 1024 * 1024 + 1)), /5 MB/);
});

test('valid finished sessions require all prescribed sets, including unilateral exercises', () => {
  const state = withSession('2026-11-20', days[4]);
  const session = state.sessions['2026-11-20:fri'];
  for (const exercise of session.exercises) {
    for (let index = 0; index < exercise.sets; index++) session.sets[setKey(exercise, index)] = true;
  }
  session.finished = true;
  assert.equal(summarize(validateState(state)).completedSets, 15);
});
