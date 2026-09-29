import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const read=p=>readFile(new URL("../"+p,import.meta.url),"utf8");

test("approved RIMMA artwork is a verified optimized full landscape image",async()=>{
 const file=await readFile(new URL("../public/rimma-luxury-full.webp",import.meta.url));
 assert.ok(file.length>4000&&file.length<12000,"fast first-party WebP asset");
 assert.equal(file.toString("ascii",0,4),"RIFF");
 assert.equal(file.toString("ascii",8,12),"WEBP");
 assert.equal(file.readUInt32LE(4)+8,file.length,"non-truncated source image");
});
test("full photo is displayed with no cover crop, remains separate from navigation and logout",async()=>{
 const [html,css,oldCss,js]=await Promise.all([
  read("public/index.html"),read("public/sidebar-photo.css"),read("public/sidebar-finish.css"),read("public/site.js")
 ]);
 const sidebar=html.split('<aside class="sidebar"')[1]?.split("</aside>")[0]||"";
 assert.ok(sidebar.indexOf('class="side-nav"') < sidebar.indexOf('id="brand-art-open"'));
 assert.ok(sidebar.indexOf('id="brand-art-open"') < sidebar.indexOf('id="logout"'));
 assert.match(sidebar,/id="brand-art-open"[^>]+aria-controls="brand-art-dialog"/);
 assert.match(sidebar,/src="\/app\/rimma-luxury-full\.webp" width="420" height="236"/);
 assert.match(html,/id="brand-art-dialog"[^>]+aria-label=/);
 assert.match(html,/id="brand-art-close"/);
 assert.match(css,/object-fit:contain/);
 assert.doesNotMatch(css,/object-fit\s*:\s*cover/i);
 assert.match(css,/\.sidebar>\.sidebar-luxe-art::before/);
 assert.match(css,/display:none!important/);
 assert.match(css,/@media \(min-width:931px\) and \(max-height:820px\)/);
 assert.match(css,/@media \(max-width:930px\)/);
 assert.match(oldCss,/background-size:100% 100%,100% 100%,auto 100%/);
 assert.match(js,/brandArtwork\.showModal\(\)/);
 assert.match(js,/brandArtwork\.close\(\)/);
 const original=html.indexOf("/app/sidebar-finish.css");
 const newest=html.indexOf("/app/sidebar-photo.css");
 assert.ok(original>0&&newest>original,"fix must load after legacy image");
});
test("new visual-only assets preserve existing HTTPS, session and CSP security",async()=>{
 const [html,css,server]=await Promise.all([
  read("public/index.html"),read("public/sidebar-photo.css"),read("server.mjs")
 ]);
 assert.match(server,/pathname==='\/app\/sidebar-photo\.css'/);
 assert.match(server,/pathname==='\/app\/rimma-luxury-full\.webp'/);
 assert.match(server,/staticFile\(res,'rimma-luxury-full\.webp','image\/webp'\)/);
 assert.match(server,/img-src 'self' data:/);
 assert.match(server,/script-src 'self'/);
 assert.match(server,/strict-transport-security/);
 assert.doesNotMatch(css,/(?:url\(|src=)[^\n]*http:\/\//i);
 assert.doesNotMatch(html,/src="http:\/\//i);
});

test("sidebar scrollbar stays invisible while wheel and keyboard scrolling remain available",async()=>{
 const css=await read("public/sidebar-photo.css");
 const patch=css.slice(css.lastIndexOf("/* RIMMA sidebar: hide the redundant"));
 assert.match(patch,/\.sidebar\s*\{[\s\S]*?overflow-y:auto/);
 assert.match(patch,/scrollbar-width:none/);
 assert.match(patch,/-ms-overflow-style:none/);
 assert.match(patch,/scrollbar-gutter:auto/);
 assert.match(patch,/\.sidebar::-webkit-scrollbar\s*\{[\s\S]*?display:none/);
 assert.doesNotMatch(patch,/overflow-y:hidden/);
 assert.doesNotMatch(patch,/pointer-events:none/);
 const html=await read("public/index.html");
 assert.match(html,/id="brand-art-open"/);
 assert.match(html,/id="logout"/);
});
