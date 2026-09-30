import test from 'node:test';
import assert from 'node:assert/strict';
import {trialDaysRemaining,renderBilling,describeBillingSyncOutcome} from '../public/billing-view.mjs';

const clock=Date.parse('2026-09-29T12:00:00Z');
const trial={status:'trial',active:false,accessActive:true,owner:true,configured:true,
  trialEndsAt:'2026-10-04T12:00:00Z',willRenew:false};
test('server 5-day trial is clearly separate from paid Google Play renewal',()=>{
 assert.equal(trialDaysRemaining(trial.trialEndsAt,clock),5);
 const html=renderBilling(trial,{now:clock});
 assert.match(html,/Quedan aproximadamente 5 días/);
 assert.match(html,/no genera cobros automáticos/);
 assert.match(html,/4,99 €\/mes/);
 assert.doesNotMatch(html,/Gestionar mi compra en Google Play/);
 assert.doesNotMatch(html,/Suscribirme ahora en la web/);
 assert.match(html,/solo probadores invitados/);
});
test('paid subscription shows real renewal state and Play management',()=>{
 const paid={status:'active',active:true,owner:true,configured:true,
  expiresAt:'2026-10-12T00:00:00Z',willRenew:true};
 const html=renderBilling(paid,{now:clock});
 assert.match(html,/Renovación comunicada por el proveedor: activada/);
 assert.match(html,/Gestionar mi compra en Google Play/);
 assert.doesNotMatch(html,/no genera cobros automáticos/);
 assert.doesNotMatch(html,/Suscribirme ahora en la web/);
 const cancelled=renderBilling({...paid,willRenew:false},{now:clock});
 assert.match(cancelled,/la renovación no está activada/);
});
test('web card checkout is hidden until backend says it is available',()=>{
 const expired={status:'expired',active:false,owner:true,configured:true};
 const url='https://pay.rev.cat/TESTCODE123456/rimma_workspace_aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
 assert.doesNotMatch(renderBilling(expired,{webCheckoutUrl:url}),/Suscribirme ahora en la web/);
 assert.match(renderBilling({...expired,webPurchasesEnabled:true},{webCheckoutUrl:url}),/Suscribirme ahora en la web/);
 assert.doesNotMatch(renderBilling({...expired,webPurchasesEnabled:true},{webCheckoutUrl:'https://evil.test/phishing'}),/Suscribirme ahora en la web/);
 assert.doesNotMatch(renderBilling({...expired,owner:false,webPurchasesEnabled:true},{webCheckoutUrl:url}),/Suscribirme ahora en la web/);
 const trialUrl=renderBilling({...trial,webPurchasesEnabled:true},{now:clock,webCheckoutUrl:url});
 assert.match(trialUrl,/Suscribirme ahora en la web/);
 assert.match(trialUrl,/sin esperar a que termine/);
});
test('sandbox is never presented as production access; absent date handled',()=>{
 const html=renderBilling({status:'expired',active:false,configured:false,isSandbox:true});
 assert.match(html,/No activa una suscripción real/);
 assert.doesNotMatch(html,/solo probadores invitados/);
 assert.equal(trialDaysRemaining('bad-date',clock),null);
});

test('payment verification shows its result directly under the subscription buttons',()=>{
 const view=renderBilling(trial,{now:clock});
 assert.match(view, /id="billing-feedback"/);
 assert.match(view, /role="status"/);
 assert.match(describeBillingSyncOutcome(trial),/aún no hay una suscripción de pago activa/);
 assert.match(describeBillingSyncOutcome(trial),/4 de octubre de 2026/);
 const paid={status:'active',active:true,expiresAt:'2026-10-12T12:00:00Z'};
 assert.match(describeBillingSyncOutcome(paid),/suscripción pagada está activa/);
 assert.match(describeBillingSyncOutcome({status:'expired',active:false}),/no se ha confirmado ninguna suscripción/);
});
