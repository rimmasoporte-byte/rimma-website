import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const get=p=>fs.readFileSync(path.join(root,p),'utf8');
test('Premium V3 keeps a single truthful indicative price, honest demo and original logo',()=>{
 const html=get('index.html');
 assert.match(html,/MÁS QUE ORGANIZACIÓN\. TRANQUILIDAD/);
 assert.match(html,/Playfair|v3\.css/);
 assert.match(html,/logo\.webp/);
 assert.match(html,/5 €\s*<span>\/ mes<\/span>/);
 assert.match(html,/No se realiza ningún cobro/);
 assert.match(html,/Datos ficticios|datos ficticios/);
 assert.doesNotMatch(html,/12 USD|22 USD|39 USD|39\s*€|22\s*€|12\s*€/);
 assert.equal((html.match(/id="precio"/g)||[]).length,1);
 assert.ok(!html.includes('href="/'),"Use relative deploy-safe local URLs");
});
test('Locally licensed corporate-grade serif and modern sans, offline loading',()=>{
 for(const f of ['assets/fonts/playfair-400.woff2','assets/fonts/playfair-500.woff2','assets/fonts/playfair-600.woff2','assets/fonts/licenses/PLAYFAIR-LICENSE.txt','assets/v3.css','demo/v3-dashboard.css']){
  assert.ok(fs.existsSync(path.join(root,f)),f+' is required');
 }
 const css=get('assets/v3.css');
 assert.match(css,/font-family:Playfair/);
 assert.match(css,/@media\(max-width:600px\)/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.doesNotMatch(css,/https:\/\//);
 const demo=get('demo/index.html');
 assert.match(demo,/v3-dashboard\.css/);
 assert.match(demo,/demo-shim\.js/);
 assert.match(demo,/DEMO INTERACTIVA/);
});

