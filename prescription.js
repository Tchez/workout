const LOAD_MODES = { steady: 'Carga estável', ramp: 'Carga crescente' };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const invalid = () => { throw new Error('Séries preparatórias ou método de carga inválidos no backup.'); };

export function loadModeLabel(mode = 'steady') {
  return LOAD_MODES[mode];
}

export function doseLabel({ sets, reps, seconds }) {
  if (seconds !== undefined) return `${sets} × ${seconds % 60 === 0 ? seconds / 60 + ' min' : seconds + ' s'}`;
  const [range, side] = reps.split(' por ');
  return `${sets} × ${range} reps${side ? ' por ' + side : ''}`;
}

export function warmupLabel(warmup) {
  const counts = warmup.steps.map(step => step.reps);
  return counts.every(reps => reps === counts[0])
    ? doseLabel({ sets: counts.length, reps: String(counts[0]) })
    : `${counts.length} séries · ${counts.join(' + ')} reps`;
}

export function effortLabel({ min, max }) {
  return `${min === max ? min : min + '–' + max} ${max === 1 ? 'repetição de margem' : 'repetições de margem'}`;
}

export function prescriptionFields(exercise) {
  const result = {};
  if (exercise.loadMode !== undefined) {
    if (typeof exercise.loadMode !== 'string' || !Object.hasOwn(LOAD_MODES, exercise.loadMode)) invalid();
    result.loadMode = exercise.loadMode;
  }
  if (exercise.repsInReserve !== undefined) {
    const reserve = exercise.repsInReserve;
    if (!object(reserve) || !Number.isInteger(reserve.min) || !Number.isInteger(reserve.max) || reserve.min < 0 || reserve.max > 10 || reserve.min > reserve.max) invalid();
    result.repsInReserve = { min: reserve.min, max: reserve.max };
  }
  if (exercise.warmup !== undefined) {
    const warmup = exercise.warmup;
    if (!object(warmup) || !['ramp', 'light'].includes(warmup.mode) || !Array.isArray(warmup.steps) || warmup.steps.length < 1 || warmup.steps.length > 10) invalid();
    const steps = warmup.steps.map(step => {
      if (!object(step) || !Number.isInteger(step.reps) || step.reps < 1 || step.reps > 50 || !Number.isFinite(step.loadPercent) || step.loadPercent <= 0 || step.loadPercent >= 100) invalid();
      return { reps: step.reps, loadPercent: step.loadPercent };
    });
    if (warmup.mode === 'ramp' && (steps.length < 2 || steps.some((step, index) => index > 0 && step.loadPercent <= steps[index - 1].loadPercent))) invalid();
    result.warmup = { mode: warmup.mode, steps };
  }
  return result;
}
