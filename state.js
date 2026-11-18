import { prescriptionFields } from './prescription.js';

export const STORAGE_KEY = 'workout-state-v2';
export const PREVIOUS_STORAGE_KEY = 'workout-state-v1';
export const LEGACY_KEY = 'marco-workout-v1';
export const MAX_BACKUP_BYTES = 5 * 1024 * 1024;
const THEMES = new Set(['dark', 'light', 'system']);
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const fail = (message) => { throw new Error(message); };
const now = () => new Date().toISOString();

function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail('Data de sessão inválida.');
  const parsed = new Date(value + 'T12:00:00Z');
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) fail('Data de sessão inválida.');
  return value;
}

function timestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value) || !Number.isFinite(Date.parse(value))) fail('Data de atualização inválida.');
  return new Date(value).toISOString();
}

function label(value, max = 240) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) fail('Nome ou identificador inválido no backup.');
  return value;
}

function identifier(value) {
  if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9-]{0,159}$/.test(value)) fail('Identificador inválido no backup.');
  return value;
}

function boolean(value) {
  if (typeof value !== 'boolean') fail('Marcação de série inválida no backup.');
  return value;
}

export function emptyState() {
  return { schemaVersion: 2, preferences: { theme: 'dark' }, sessions: {}, updatedAt: now() };
}

export function setKey(exercise, index) {
  return exercise.id + ':' + index;
}

export function sessionKey(sessionDate, dayId) {
  return date(sessionDate) + ':' + identifier(dayId);
}

export function createSession(sessionDate, day) {
  return {
    date: date(sessionDate), dayId: day.id, title: day.title,
    exercises: day.exercises.map(exercise => ({ id: exercise.id, name: exercise.name, sets: exercise.sets, reps: exercise.reps, ...prescriptionFields(exercise) })),
    sets: {}, loads: {}, warm: false, finished: false, updatedAt: now()
  };
}

export function sessionProgress(session) {
  let total = 0;
  let completed = 0;
  for (const exercise of session.exercises) {
    for (let index = 0; index < exercise.sets; index++) {
      total++;
      if (session.sets[setKey(exercise, index)] === true) completed++;
    }
  }
  return { total, completed };
}

export function exerciseHistory(state, exerciseId) {
  return Object.values(state.sessions)
    .filter(session => Object.hasOwn(session.loads, exerciseId))
    .sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt))
    .map(session => ({ date: session.date, dayId: session.dayId, title: session.title, kg: session.loads[exerciseId] }));
}

export function parseLoad(value) {
  const normalized = String(value).trim().replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) fail('Informe uma carga em kg, como 20 ou 12,5.');
  const kg = Number(normalized);
  if (kg > 2000) fail('Informe uma carga entre 0 e 2.000 kg.');
  return kg;
}

export function validateState(input) {
  if (!isObject(input) || ![1, 2].includes(input.schemaVersion)) fail('Versão de dados incompatível. Atualize o Workout para importar este backup.');
  if (!isObject(input.preferences) || !THEMES.has(input.preferences.theme)) fail('Tema inválido no backup.');
  if (!isObject(input.sessions)) fail('O backup não contém uma lista de sessões válida.');
  const result = { schemaVersion: 2, preferences: { theme: input.preferences.theme }, sessions: {}, updatedAt: timestamp(input.updatedAt) };
  for (const [key, value] of Object.entries(input.sessions)) {
    if (!isObject(value)) fail('Sessão inválida no backup.');
    const sessionDate = date(value.date);
    const dayId = identifier(value.dayId);
    if (key !== sessionKey(sessionDate, dayId)) fail('A identificação de uma sessão não corresponde à data e ao treino.');
    if (!Array.isArray(value.exercises) || value.exercises.length < 1 || value.exercises.length > 100) fail('Exercícios inválidos em uma sessão.');
    const seen = new Set();
    const allowedSets = new Set();
    const exercises = value.exercises.map((exercise) => {
      if (!isObject(exercise)) fail('Exercício inválido no backup.');
      const id = identifier(exercise.id);
      if (seen.has(id)) fail('Uma sessão contém exercícios duplicados.');
      seen.add(id);
      if (!Number.isInteger(exercise.sets) || exercise.sets < 1 || exercise.sets > 30) fail('Quantidade de séries inválida no backup.');
      for (let index = 0; index < exercise.sets; index++) allowedSets.add(setKey({ id }, index));
      return { id, name: label(exercise.name), sets: exercise.sets, reps: label(exercise.reps, 80), ...prescriptionFields(exercise) };
    });
    if (!isObject(value.sets)) fail('Marcações inválidas no backup.');
    const sets = {};
    for (const [set, checked] of Object.entries(value.sets)) {
      if (!allowedSets.has(set)) fail('O backup contém uma marcação que não pertence aos exercícios da sessão.');
      sets[set] = boolean(checked);
    }
    const inputLoads = input.schemaVersion === 1 && value.loads === undefined ? {} : value.loads;
    if (!isObject(inputLoads)) fail('Cargas inválidas no backup.');
    const loads = {};
    for (const [id, kg] of Object.entries(inputLoads)) {
      if (!seen.has(id) || typeof kg !== 'number' || !Number.isFinite(kg) || kg < 0 || kg > 2000 || Math.abs(kg * 100 - Math.round(kg * 100)) > 1e-7) fail('O backup contém uma carga inválida ou sem exercício correspondente.');
      loads[id] = kg;
    }
    const session = { date: sessionDate, dayId, title: label(value.title), exercises, sets, loads, warm: boolean(value.warm), finished: boolean(value.finished), updatedAt: timestamp(value.updatedAt) };
    const progress = sessionProgress(session);
    if (session.finished && progress.total !== progress.completed) fail('Uma sessão finalizada contém séries pendentes.');
    result.sessions[key] = session;
  }
  return result;
}

export function migrateLegacy(legacy, days) {
  if (!isObject(legacy)) fail('O estado antigo está inválido.');
  const state = emptyState();
  if (THEMES.has(legacy.theme)) state.preferences.theme = legacy.theme;
  if (!legacy.sessionDate && !legacy.sessions) return state;
  date(legacy.sessionDate);
  if (!isObject(legacy.sessions)) fail('As sessões antigas estão inválidas.');
  for (const [index, old] of Object.entries(legacy.sessions)) {
    if (!/^\d+$/.test(index) || !days[Number(index)] || !isObject(old)) fail('Uma sessão antiga está inválida.');
    const day = days[Number(index)];
    const session = createSession(legacy.sessionDate, day);
    session.warm = old.warm === true;
    if (old.sets !== undefined && !isObject(old.sets)) fail('As séries antigas estão inválidas.');
    for (const [key, checked] of Object.entries(old.sets || {})) {
      const parts = key.match(/^(\d+)-(\d+)$/);
      if (!parts || !day.exercises[Number(parts[1])] || Number(parts[2]) >= day.exercises[Number(parts[1])].sets) fail('Uma marcação antiga está inválida.');
      session.sets[setKey(day.exercises[Number(parts[1])], Number(parts[2]))] = boolean(checked);
    }
    session.finished = old.finished === true;
    state.sessions[sessionKey(session.date, session.dayId)] = session;
  }
  return validateState(state);
}

export function loadState(storage, days) {
  let recovered = null;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw !== null) return { state: validateState(JSON.parse(raw)), available: true, blocked: false, migrated: false, error: null };
    const previous = storage.getItem(PREVIOUS_STORAGE_KEY);
    const legacy = previous === null ? storage.getItem(LEGACY_KEY) : null;
    const state = previous !== null ? validateState(JSON.parse(previous)) : legacy === null ? emptyState() : migrateLegacy(JSON.parse(legacy), days);
    recovered = state;
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return { state, available: true, blocked: false, migrated: previous !== null || legacy !== null, error: null };
  } catch (error) {
    return { state: recovered || emptyState(), available: false, blocked: recovered === null, migrated: false, error };
  }
}

export function saveState(storage, state) {
  const validated = validateState(state);
  storage.setItem(STORAGE_KEY, JSON.stringify(validated));
  return validated;
}

export function exportBackup(state) {
  return JSON.stringify({ format: 'workout-backup', formatVersion: 1, exportedAt: now(), state: validateState(state) }, null, 2);
}

export function parseBackup(text) {
  if (new TextEncoder().encode(text).length > MAX_BACKUP_BYTES) fail('O arquivo excede o limite de 5 MB.');
  let backup;
  try { backup = JSON.parse(text); } catch { fail('Não foi possível ler o JSON. Selecione um backup exportado pelo Workout.'); }
  if (!isObject(backup) || backup.format !== 'workout-backup' || backup.formatVersion !== 1) fail('Este arquivo não é um backup compatível do Workout.');
  timestamp(backup.exportedAt);
  return { state: validateState(backup.state), exportedAt: backup.exportedAt };
}

export function replaceFromBackup(storage, text) {
  const { state } = parseBackup(text);
  state.updatedAt = now();
  return saveState(storage, state);
}

export function summarize(state) {
  const sessions = Object.values(state.sessions);
  const dates = sessions.map((session) => session.date).sort();
  return {
    sessions: sessions.length,
    finished: sessions.filter((session) => session.finished).length,
    completedSets: sessions.reduce((sum, session) => sum + sessionProgress(session).completed, 0),
    firstDate: dates[0] || null,
    lastDate: dates.at(-1) || null,
    bytes: new TextEncoder().encode(JSON.stringify(state)).length
  };
}
