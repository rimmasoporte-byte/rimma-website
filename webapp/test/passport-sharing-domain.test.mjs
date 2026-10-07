import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createPassportSharing} from '../public/portal-passport-sharing.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

const ORDER='11111111-1111-4111-8111-111111111111';
const ITEM='22222222-2222-4222-8222-222222222222';

const settle=async()=>{
 await new Promise(resolve=>setImmediate(resolve));
 await new Promise(resolve=>setImmediate(resolve));
};

test('passport sharing renders channel actions from the active passport',()=>{
 const ui=createPassportSharing({
  api:async()=>({}),
  dlg:{querySelector:()=>null},
  safe:async action=>action(),
  getLocale:()=> 'es-ES'
 });
 const markup=ui.renderShareSection({
  client:{phone:'+34 612 345 678',email:'cliente@example.com'}
 });
 assert.match(markup,/data-feature="passport-whatsapp"/);
 assert.match(markup,/data-feature="passport-email"/);
 assert.match(markup,/data-feature="passport-copy"/);
 assert.match(markup,/data-feature="passport-open-page"/);
 assert.match(markup,/data-feature="passport-revoke"/);
 assert.match(markup,/id="passport-share-result"/);
});

test('passport sharing preserves create-link then email delivery flow',async()=>{
 const calls=[];
 const node={innerHTML:''};
 const api=async(route,options={})=>{
  calls.push({route,options});
  if(route===`/orders/${ORDER}/items/${ITEM}/passport/share`&&options.method==='POST')
   return {share:{shareUrl:'https://rimmaapp.com/pedido/token'}};
  if(route===`/orders/${ORDER}/items/${ITEM}/passport/share/email`&&options.method==='POST')
   return {email:{recipient:'cliente@example.com'}};
  throw new Error('Unexpected API '+route);
 };
 const safe=async action=>{await action();};
 const ui=createPassportSharing({
  api,
  dlg:{querySelector:selector=>selector==='#passport-share-result'?node:null},
  safe,
  getLocale:()=> 'es-ES'
 });
 ui.setContext({
  orderId:ORDER,
  itemId:ITEM,
  passport:{
   orderNumber:42,
   client:{name:'María',phone:'612 345 678',email:'cliente@example.com'},
   workspace:{countryCode:'ES'}
  }
 });

 const classes=new Set();
 const button={
  disabled:false,
  innerHTML:'Enviar',
  classList:{add:name=>classes.add(name),remove:name=>classes.delete(name)}
 };
 assert.equal(ui.handleAction('passport-email',button),true);
 await settle();

 assert.equal(calls.length,2);
 assert.equal(calls[0].route,`/orders/${ORDER}/items/${ITEM}/passport/share`);
 assert.equal(calls[0].options.method,'POST');
 assert.equal(calls[1].route,`/orders/${ORDER}/items/${ITEM}/passport/share/email`);
 assert.equal(calls[1].options.method,'POST');
 assert.deepEqual(JSON.parse(calls[1].options.body),{
  shareUrl:'https://rimmaapp.com/pedido/token',
  locale:'es-ES'
 });
 assert.match(node.innerHTML,/Correo enviado/);
 assert.match(node.innerHTML,/cliente@example\.com/);
 assert.equal(button.disabled,false);
 assert.equal(button.innerHTML,'Enviar');
 assert.equal(classes.has('is-loading'),false);
});

test('passport sharing revokes the active client link',async()=>{
 const calls=[];
 const node={innerHTML:''};
 const ui=createPassportSharing({
  api:async(route,options={})=>{
   calls.push({route,options});
   return {revoked:true};
  },
  dlg:{querySelector:selector=>selector==='#passport-share-result'?node:null},
  safe:async action=>{await action();},
  getLocale:()=> 'es-ES'
 });
 ui.setContext({orderId:ORDER,itemId:ITEM,passport:{client:{}}});

 assert.equal(ui.handleAction('passport-revoke',{}),true);
 await settle();

 assert.equal(calls.length,1);
 assert.equal(calls[0].route,`/orders/${ORDER}/items/${ITEM}/passport/share`);
 assert.equal(calls[0].options.method,'DELETE');
 assert.match(node.innerHTML,/Acceso revocado/);
});

test('portal delegates share markup and actions to the passport sharing domain',()=>{
 const features=read('public/portal-features.mjs');
 const sharing=read('public/portal-passport-sharing.mjs');
 const sharingCss=read('public/portal-passport-sharing.css');
 const appCss=read('public/app.css');
 const passportEditor=read('public/portal-passport-editor.mjs');
 const server=read('../webapp/server.mjs');

 assert.match(features,/createPassportSharing/);
 assert.match(passportEditor,/passportSharing\.setContext\(\{orderId,itemId,passport\}\)/);
 assert.match(passportEditor,/passportSharing\.renderShareSection\(passport\)/);
 assert.match(features,/passportSharing\.handleAction\(action,el\)/);
 assert.doesNotMatch(features,/async function createPassportShareLink/);
 assert.doesNotMatch(features,/async function sendPassportEmail/);
 assert.doesNotMatch(features,/passport-channel-grid/);

 assert.match(sharing,/portal-passport-share\.mjs/);
 assert.match(sharing,/\/passport\/share\/email/);
 assert.match(sharing,/https:\/\/wa\.me\//);
 assert.match(sharingCss,/^\/\* Passport sharing UX: prioritize communication channels, keep technical link actions secondary\. \*\//);
 assert.match(sharingCss,/\.passport-channel-grid/);
 assert.match(sharingCss,/\.passport-secondary-actions/);
 assert.doesNotMatch(appCss,/Passport sharing UX: prioritize communication channels/);
 assert.match(server,/pathname==='\/app\/portal-passport-sharing\.mjs'/);
 assert.match(server,/pathname==='\/app\/portal-passport-sharing\.css'/);
});
