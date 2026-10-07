import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const css=await fs.readFile(new URL('../public/app.css',import.meta.url),'utf8');
const shellCss=await fs.readFile(new URL('../public/portal-shell-controls.css',import.meta.url),'utf8');
const wizardCss=await fs.readFile(new URL('../public/portal-order-wizard.css',import.meta.url),'utf8');
const marker='/* The site has one scroll container. Dialog backgrounds cannot scroll at';

test('order dialog has one canonical scroll geometry with no legacy modal-form patch',()=>{
  const cut=shellCss.indexOf(marker);
  assert.ok(cut>0,'canonical modal section exists');
  const canonical=shellCss.slice(cut);

  assert.doesNotMatch(css,/#modal-form\s*\{/,'legacy modal-form geometry is removed from app.css');
  assert.match(canonical,/#modal\{[\s\S]*?overflow:clip/);
  assert.match(canonical,/#modal-form\{[\s\S]*?overflow:clip/);
  assert.match(canonical,/#modal-fields\{[\s\S]*?overflow-y:auto/);
  assert.match(canonical,/#modal-fields\{[\s\S]*?scrollbar-gutter:stable/);
});

test('desktop wizard shell cannot become a hidden programmatic scroll container',()=>{
  const desktop=shellCss.slice(shellCss.indexOf(marker),shellCss.indexOf('@media(max-height:480px)'));
  assert.doesNotMatch(desktop,/#modal-form\{[^}]*overflow\s*:\s*(?:auto|hidden)/);
});


test('first order step hides its redundant scrollbar without disabling scroll',()=>{
  assert.doesNotMatch(css,/Order creation wizard: one canonical implementation/);
  assert.match(wizardCss,/\.order-wizard-modal\[data-wizard-step="0"\] #modal-fields\{[^}]*scrollbar-width:none/);
  assert.match(wizardCss,/\.order-wizard-modal\[data-wizard-step="0"\] #modal-fields::\-webkit-scrollbar\{[^}]*display:none/);
  const firstStep=wizardCss.slice(wizardCss.indexOf('.order-wizard-modal[data-wizard-step="0"] #modal-fields{'));
  assert.doesNotMatch(firstStep.slice(0,900),/overflow-y\s*:\s*hidden/);
});
