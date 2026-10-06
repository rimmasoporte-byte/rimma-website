import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createOrderWhatsApp} from '../public/portal-whatsapp.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const UUID='11111111-1111-4111-8111-111111111111';

test('manual WhatsApp workflow preserves message preparation and logging',async()=>{
  const calls=[];
  const layouts=[];
  const errors=[];
  const successes=[];
  let opened=null;
  const api=async(path,options={})=>{
    calls.push({path,options});
    if(path===`/orders/${UUID}/whatsapp`)return {whatsapp:{
      client:{whatsappPhone:'+34 612 345 678'},
      actions:[{enabled:true,key:'ready',label:'Pedido listo',text:'Tu pedido está listo'}]
    }};
    if(path===`/orders/${UUID}/whatsapp/log`)return {ok:true};
    throw new Error('Unexpected API '+path);
  };
  const dlg={
    querySelector(selector){
      if(selector==='[data-wa-message="ready"]')return {value:'Tu pedido está listo'};
      return null;
    }
  };
  const previousWindow=globalThis.window;
  const previousCSS=globalThis.CSS;
  globalThis.window={open:(url,target,features)=>{
    opened={url,target,features};
    return {};
  }};
  globalThis.CSS={escape:value=>String(value)};
  try{
    const ui=createOrderWhatsApp({
      api,
      success:message=>successes.push(message),
      globalError:message=>errors.push(message),
      layout:(...args)=>layouts.push(args),
      dlg,
      alertError:message=>errors.push(message)
    });

    await ui.openWhatsApp(UUID);
    assert.equal(layouts.length,1);
    assert.match(layouts[0][2],/Vista previa editable/);
    assert.match(layouts[0][2],/data-feature="whatsapp-open"/);
    assert.match(layouts[0][2],/data-phone="34612345678"/);

    ui.openPreparedWhatsApp({dataset:{phone:'34612345678',template:'ready'}});
    await new Promise(resolve=>setImmediate(resolve));

    assert.deepEqual(opened,{
      url:'https://wa.me/34612345678?text=Tu%20pedido%20est%C3%A1%20listo',
      target:'_blank',
      features:'noopener,noreferrer'
    });
    const log=calls.find(call=>call.path.endsWith('/whatsapp/log'));
    assert.ok(log);
    assert.equal(log.options.method,'POST');
    assert.deepEqual(JSON.parse(log.options.body),{action:'opened',templateKey:'ready',messageLength:20});
    assert.deepEqual(errors,[]);
    assert.deepEqual(successes,['WhatsApp abierto. RIMMA no marca el mensaje como enviado.']);
  }finally{
    if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;
    if(previousCSS===undefined)delete globalThis.CSS;else globalThis.CSS=previousCSS;
  }
});

test('manual WhatsApp workflow fails closed for invalid order or phone',async()=>{
  const errors=[];
  const ui=createOrderWhatsApp({
    api:async()=>({whatsapp:{client:{whatsappPhone:''},actions:[]}}),
    success:()=>{},
    globalError:message=>errors.push(message),
    layout:()=>{},
    dlg:{querySelector:()=>null},
    alertError:message=>errors.push(message)
  });
  await ui.openWhatsApp('bad');
  assert.deepEqual(errors,['Pedido inválido.']);
});

test('portal delegates WhatsApp behavior to its domain module',()=>{
  const features=read('public/portal-features.mjs');
  const whatsapp=read('public/portal-whatsapp.mjs');
  const server=read('../webapp/server.mjs');

  assert.match(features,/createOrderWhatsApp/);
  assert.match(features,/whatsappUI\.openPreparedWhatsApp\(el\)/);
  assert.doesNotMatch(features,/async function openWhatsApp\(/);
  assert.doesNotMatch(features,/RIMMA prepara el mensaje|data-feature="whatsapp-open"/);
  assert.match(whatsapp,/https:\/\/wa\.me\//);
  assert.match(whatsapp,/\/whatsapp\/log/);
  assert.match(server,/pathname==='\/app\/portal-whatsapp\.mjs'/);
});
