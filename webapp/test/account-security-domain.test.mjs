import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createAccountSecurity} from '../public/portal-account-security.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

const formWith=values=>{
 const fields=new Map(Object.entries(values).map(([name,value])=>[name,{value}]));
 return {
  resetCalled:false,
  elements:{namedItem:name=>fields.get(name)||null},
  reset(){this.resetCalled=true;}
 };
};

test('account security keeps password validation and global logout semantics',async()=>{
 const calls=[],layouts=[];
 let closes=0,logouts=0;
 const api=async(route,options={})=>{calls.push({route,options});return {success:true};};
 const ui=createAccountSecurity({
  api,
  layout:(...args)=>layouts.push(args),
  close:()=>{closes++;},
  logoutAfterPassword:async()=>{logouts++;}
 });

 ui.openPasswordForm();
 assert.equal(layouts.length,1);
 assert.equal(layouts[0][0],'password-change');
 assert.match(layouts[0][2],/Contraseña actual/);
 assert.match(layouts[0][2],/Nueva contraseña/);
 assert.match(layouts[0][2],/Repetir contraseña/);
 assert.match(layouts[0][2],/cerrará la sesión en todos los dispositivos/);

 const mismatch=formWith({
  currentPassword:'old-secret',
  newPassword:'new-secret',
  confirmPassword:'different'
 });
 await assert.rejects(()=>ui.save('password-change',mismatch),/no coinciden/);
 assert.equal(calls.length,0);

 const same=formWith({
  currentPassword:'same-secret',
  newPassword:'same-secret',
  confirmPassword:'same-secret'
 });
 await assert.rejects(()=>ui.save('password-change',same),/diferente de la actual/);
 assert.equal(calls.length,0);

 const valid=formWith({
  currentPassword:'old-secret',
  newPassword:'new-secret-123',
  confirmPassword:'new-secret-123'
 });
 assert.equal(await ui.save('password-change',valid),true);
 assert.equal(calls.length,1);
 assert.equal(calls[0].route,'/account/password');
 assert.equal(calls[0].options.method,'POST');
 assert.deepEqual(JSON.parse(calls[0].options.body),{
  currentPassword:'old-secret',
  newPassword:'new-secret-123'
 });
 assert.equal(valid.resetCalled,true);
 assert.equal(closes,1);
 assert.equal(logouts,1);
});

test('account security ignores unrelated save modes',async()=>{
 const ui=createAccountSecurity({
  api:async()=>{throw new Error('API must not run');},
  layout:()=>{},
  close:()=>{},
  logoutAfterPassword:async()=>{}
 });
 assert.equal(await ui.save('business-profile',formWith({})),false);
});

test('portal delegates password workflow to the account security domain',()=>{
 const features=read('public/portal-features.mjs');
 const security=read('public/portal-account-security.mjs');
 const server=read('../webapp/server.mjs');

 assert.match(features,/createAccountSecurity/);
 assert.match(features,/accountSecurity\.openPasswordForm\(\)/);
 assert.match(features,/accountSecurity\.save\(mode,form\(\)\)/);
 assert.doesNotMatch(features,/function passwordForm\(/);
 assert.doesNotMatch(features,/\/account\/password/);
 assert.doesNotMatch(features,/Las contraseñas nuevas no coinciden/);

 assert.match(security,/\/account\/password/);
 assert.match(security,/Las contraseñas nuevas no coinciden/);
 assert.match(security,/logoutAfterPassword/);
 assert.match(server,/pathname==='\/app\/portal-account-security\.mjs'/);
});
