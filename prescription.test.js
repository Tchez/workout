import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { doseLabel, warmupLabel, loadModeLabel, effortLabel, prescriptionFields } from './prescription.js';
import { createSession, emptyState, exportBackup, parseBackup, sessionProgress, validateState } from './state.js';

const days=JSON.parse(readFileSync(new URL('./workout.json',import.meta.url),'utf8'));

test('doses show sets and repetitions or duration, including unilateral movements',()=>{
  assert.equal(doseLabel({sets:1,reps:'8'}),'1 × 8 reps');
  assert.equal(doseLabel({sets:2,reps:'8–12 por perna'}),'2 × 8–12 reps por perna');
  assert.equal(doseLabel({sets:1,seconds:120}),'1 × 2 min');
  assert.equal(doseLabel({sets:1,seconds:45}),'1 × 45 s');
  assert.equal(warmupLabel({steps:[{reps:6},{reps:6}]}),'2 × 6 reps');
  assert.equal(warmupLabel({steps:[{reps:8},{reps:4}]}),'2 séries · 8 + 4 reps');
  assert.equal(loadModeLabel('steady'),'Carga estável');
  assert.equal(effortLabel({min:1,max:3}),'1–3 repetições de margem');
});

test('all exercises and general preparations have explicit prescriptions',()=>{
  for(const day of days){
    for(const exercise of day.exercises){
      assert.ok(exercise.sets>0&&exercise.reps.length>0);
      assert.equal(prescriptionFields(exercise).loadMode,'steady');
      assert.ok(exercise.repsInReserve.min>=1);
    }
    for(const item of day.preparation){assert.ok(item.sets>0);assert.ok(item.reps||item.seconds>0);}
  }
  for(const day of [days[1],days[3]]){
    assert.equal(day.preparation[0].title,'Flexão de braços');
    assert.equal(doseLabel(day.preparation[0]),'1 × 8 reps');
    assert.equal(day.preparation[1].title,'Barra fixa');
    assert.equal(doseLabel(day.preparation[1]),'1 × 3 reps');
  }
});

test('preparation stays attached to its exercise and never changes working-set totals',()=>{
  for(const [index,total] of [[0,15],[1,16],[2,11],[3,17],[4,15]]){
    const session=createSession('2026-11-18',days[index]);
    assert.equal(sessionProgress(session).total,total);
    assert.deepEqual(session.exercises[0].warmup.steps,[{reps:index===2?8:6,loadPercent:index===2?50:40},...(index===2?[]:[{reps:6,loadPercent:80}])]);
  }
});

test('new backup snapshots retain warm-up steps and training methods independently of later plan edits',()=>{
  const state=emptyState();const session=createSession('2026-11-17',days[1]);state.sessions['2026-11-17:tue']=session;
  const restored=parseBackup(exportBackup(state)).state;
  assert.deepEqual(restored.sessions['2026-11-17:tue'].exercises[0],session.exercises[0]);
  const before=restored.sessions['2026-11-17:tue'].exercises[0].warmup.steps[0].reps;
  const changed=structuredClone(days);changed[1].exercises[0].warmup.steps[0].reps=20;
  assert.equal(restored.sessions['2026-11-17:tue'].exercises[0].warmup.steps[0].reps,before);
});

test('older v2 records without method metadata remain valid and retain loads',()=>{
  const state=emptyState();const session=createSession('2026-11-17',days[1]);state.sessions['2026-11-17:tue']=session;
  for(const exercise of session.exercises){delete exercise.loadMode;delete exercise.repsInReserve;delete exercise.warmup;}
  session.loads[session.exercises[0].id]=20;
  assert.deepEqual(validateState(state),state);
});

test('invalid methods, effort ranges and unsafe ramp metadata cannot enter backups',()=>{
  for(const metadata of [
    {loadMode:'maximum'}, {loadMode:['steady']}, {repsInReserve:{min:3,max:1}},
    {warmup:{mode:'ramp',steps:[]}},
    {warmup:{mode:'ramp',steps:[{reps:6,loadPercent:80},{reps:6,loadPercent:40}]}},
    {warmup:{mode:'light',steps:[{reps:0,loadPercent:50}]}},
    {warmup:{mode:'light',steps:[{reps:6,loadPercent:100}]}}
  ])assert.throws(()=>prescriptionFields(metadata));
});
