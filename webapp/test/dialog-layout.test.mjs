import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const css=await fs.readFile(new URL('../public/app.css',import.meta.url),'utf8');

test('order dialog has one canonical scroll geometry with no legacy modal-form patch',()=>{
  const marker='/* The site has one scroll container. Dialog backgrounds cannot scroll at';
  const cut=css.indexOf(marker);
  assert.ok(cut>0,'canonical modal section exists');
  const legacy=css.slice(0,cut);
  const canonical=css.slice(cut);

  assert.doesNotMatch(legacy,/#modal-form\s*\{/,'legacy modal-form geometry is removed');
  assert.match(canonical,/#modal\{[\s\S]*?overflow:clip/);
  assert.match(canonical,/#modal-form\{[\s\S]*?overflow:clip/);
  assert.match(canonical,/#modal-fields\{[\s\S]*?overflow-y:auto/);
  assert.match(canonical,/#modal-fields\{[\s\S]*?scrollbar-gutter:stable/);
});

test('desktop wizard shell cannot become a hidden programmatic scroll container',()=>{
  const desktop=css.slice(css.indexOf(marker),css.indexOf('@media(max-height:480px)'));
  assert.doesNotMatch(desktop,/#modal-form\{[^}]*overflow\s*:\s*(?:auto|hidden)/);
});
