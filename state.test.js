import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { STORAGE_KEY, PREVIOUS_STORAGE_KEY, LEGACY_KEY, emptyState, createSession, setKey, sessionKey, validateState, loadState, saveState, exportBackup, parseBackup, replaceFromBackup, summarize, parseLoad, exerciseHistory } from './state.js';

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

test('v1 sessions and backups upgrade without discarding dates or overwriting the original storage', () => {
  const storage = memory();
  const old = withSession();old.schemaVersion = 1;
  delete old.sessions['2026-11-17:tue'].loads;
  const original = JSON.stringify(old);
  storage.setItem(PREVIOUS_STORAGE_KEY, original);
  const result = loadState(storage, days);
  assert.equal(result.migrated, true);
  assert.equal(result.state.schemaVersion, 2);
  assert.equal(result.state.sessions['2026-11-17:tue'].sets['supino-inclinado-com-halteres:0'], true);
  assert.deepEqual(result.state.sessions['2026-11-17:tue'].loads, {});
  assert.equal(storage.getItem(PREVIOUS_STORAGE_KEY), original);
  assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)).schemaVersion, 2);
  const oldBackup = JSON.stringify({format:'workout-backup',formatVersion:1,exportedAt:old.updatedAt,state:old});
  assert.deepEqual(parseBackup(oldBackup).state, result.state);
});

test('exercise loads survive reload and backup transfers across dates and training days', () => {
  const state = withSession();
  const id = 'elevacao-lateral';
  state.sessions['2026-11-17:tue'].loads[id] = 12.5;
  const next = createSession('2026-11-19', days[3]);next.loads[id] = 14;
  state.sessions['2026-11-19:thu'] = next;
  const storage = memory();saveState(storage, state);
  const restored = parseBackup(exportBackup(loadState(storage, days).state)).state;
  assert.deepEqual(exerciseHistory(restored, id).map(item => [item.date, item.kg]), [['2026-11-19', 14], ['2026-11-17', 12.5]]);
  assert.deepEqual(createSession('2026-11-24',days[1]).loads, {});
});

test('load entry accepts decimal commas and zero, while rejecting ambiguous or invalid values', () => {
  for (const [input, expected] of [['12,5',12.5],[' 20.25 ',20.25],['0',0],['2000',2000]]) assert.equal(parseLoad(input),expected);
  for (const input of ['', '-1', 'Infinity', '12kg', '1.000,5', '1,234', '2001', '1e2']) assert.throws(() => parseLoad(input));
});

test('invalid or orphaned loads cannot replace a saved backup', () => {
  const storage = memory();saveState(storage,withSession());
  const before = storage.getItem(STORAGE_KEY);
  const template = JSON.parse(exportBackup(withSession()));
  for (const loads of [null, [], {'not-an-exercise':20}, {'elevacao-lateral':-1}, {'elevacao-lateral':'12'}, {'elevacao-lateral':2001}, {'elevacao-lateral':12.345}]) {
    const changed=structuredClone(template);changed.state.sessions['2026-11-17:tue'].loads=loads;
    assert.throws(()=>replaceFromBackup(storage,JSON.stringify(changed)));
    assert.equal(storage.getItem(STORAGE_KEY),before);
  }
});

test('a transient first write failure can recover without blocking later writes', () => {
  const storage = memory();let blocked=true;
  const flaky = {...storage,setItem:(key,value)=>{if(blocked)throw new Error('QuotaExceededError');storage.setItem(key,value);}};
  const loaded=loadState(flaky,days);
  assert.equal(loaded.available,false);assert.equal(loaded.blocked,false);
  blocked=false;saveState(flaky,withSession());
  assert.equal(loadState(storage,days).available,true);
});

test('a corrupt v2 record is never replaced by an older v1 fallback', () => {
  const storage = memory();
  storage.setItem(STORAGE_KEY,'{broken');storage.setItem(PREVIOUS_STORAGE_KEY,JSON.stringify(withSession()));
  const loaded=loadState(storage,days);
  assert.equal(loaded.blocked,true);
  assert.equal(storage.getItem(STORAGE_KEY),'{broken');
});

test('rest presets use a single duration no longer than two minutes', () => {
  for(const day of days)for(const exercise of day.exercises){
    assert.ok(exercise.rest>0&&exercise.rest<=120);
    assert.equal(exercise.restLabel,exercise.rest===120?'2 min':exercise.rest+' s');
  }
});
