import test from 'node:test';
import assert from 'node:assert/strict';
import { runningInstalled,requestProtection } from './browser.js';

test('installed app modes and the iOS standalone flag hide installation help',()=>{
  for(const mode of ['standalone','minimal-ui','window-controls-overlay'])assert.equal(runningInstalled({matchMedia:query=>({matches:query===`(display-mode: ${mode})`})},{}),true);
  assert.equal(runningInstalled({matchMedia:()=>({matches:false})},{standalone:true}),true);
  assert.equal(runningInstalled({matchMedia:()=>({matches:false})},{}),false);
});
test('storage protection distinguishes grants, denials, missing APIs and failures',async()=>{
  assert.equal(await requestProtection({persist:async()=>true}),'granted');
  assert.equal(await requestProtection({persist:async()=>false}),'denied');
  assert.equal(await requestProtection(undefined),'unsupported');
  assert.equal(await requestProtection({persist:async()=>{throw Error('blocked');}}),'error');
});
