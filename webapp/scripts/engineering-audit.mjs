import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webappRoot=fileURLToPath(new URL("../",import.meta.url));
const repoRoot=path.resolve(webappRoot,"..");
const budgets=JSON.parse(await fs.readFile(path.join(webappRoot,"engineering-budgets.json"),"utf8"));

const failures=[];
const notes=[];

function fail(message){failures.push(message);}
function rel(file){return path.relative(webappRoot,file).replaceAll(path.sep,"/");}
function lines(text){return text.split(/\r?\n/).length;}

async function exists(file){
  try{await fs.access(file);return true;}catch{return false;}
}

async function walk(dir){
  const out=[];
  for(const entry of await fs.readdir(dir,{withFileTypes:true})){
    if(["node_modules",".git"].includes(entry.name))continue;
    const full=path.join(dir,entry.name);
    if(entry.isDirectory())out.push(...await walk(full));
    else out.push(full);
  }
  return out;
}

const requiredRepoFiles=[
  ".editorconfig",
  ".gitattributes",
  "CONTRIBUTING.md",
  "SECURITY.md",
  ".github/CODEOWNERS",
  ".github/pull_request_template.md",
  ".github/dependabot.yml",
  ".github/workflows/codeql.yml",
  ".github/workflows/dependency-review.yml",
  "docs/ARCHITECTURE.md",
  "docs/ENGINEERING_STANDARDS.md",
  "docs/ADR/0001-application-module-boundaries.md"
];
for(const item of requiredRepoFiles){
  if(!await exists(path.join(repoRoot,item)))fail("Missing engineering governance file: "+item);
}

const productionModules=[
  path.join(webappRoot,"server.mjs"),
  path.join(webappRoot,"session-store.mjs"),
  path.join(webappRoot,"signup.mjs"),
  path.join(webappRoot,"web-billing.mjs"),
  path.join(webappRoot,"photo-capture-route.mjs"),
  ...(await walk(path.join(webappRoot,"public"))).filter(file=>/\.(?:js|mjs)$/.test(file))
];

const forbiddenProductionPatterns=[
  {re:/\beval\s*\(/,label:"eval()"},
  {re:/\bnew\s+Function\s*\(/,label:"new Function()"},
  {re:/\bdebugger\s*;/,label:"debugger statement"},
  {re:/\bconsole\.log\s*\(/,label:"console.log()"},
  {re:/\b(?:TODO|FIXME)\b/,label:"untracked TODO/FIXME"}
];

for(const file of productionModules){
  const text=await fs.readFile(file,"utf8");
  const relative=rel(file);
  const lineCount=lines(text);
  const max=budgets.files[relative] ?? budgets.defaultJsMaxLines;
  if(lineCount>max)fail(`${relative} has ${lineCount} lines; architecture budget is ${max}`);
  for(const {re,label} of forbiddenProductionPatterns){
    if(re.test(text))fail(`${relative} contains forbidden production pattern: ${label}`);
  }
  if(/\bdocument\.write\s*\(/.test(text)){
    const reason=budgets.intentionalExceptions?.documentWrite?.[relative];
    if(!reason)fail(`${relative} uses document.write() without a documented isolated-print exception`);
    else notes.push(`${relative}: reviewed document.write() exception — ${reason}`);
  }
}

const cssFile=path.join(webappRoot,"public/app.css");
if(await exists(cssFile)){
  const css=await fs.readFile(cssFile,"utf8");
  const max=budgets.files["public/app.css"];
  if(lines(css)>max)fail(`public/app.css has ${lines(css)} lines; architecture budget is ${max}`);
}

const publicSource=await Promise.all(
  (await walk(path.join(webappRoot,"public")))
    .filter(file=>/\.(?:html|js|mjs)$/.test(file))
    .map(file=>fs.readFile(file,"utf8").then(text=>({file,text})))
);
for(const {file,text} of publicSource){
  if(/\b(?:accessToken|refreshToken)\b/.test(text)){
    fail(rel(file)+" references backend token material in browser source");
  }
  if(/\s(?:onclick|ondblclick|onchange|oninput|onsubmit|onload|onerror|onfocus|onblur|onkeydown|onkeyup|onpointerdown|onpointerup)\s*=\s*["']/i.test(text)){
    fail(rel(file)+" contains an inline DOM event handler");
  }
}

const envExample=await fs.readFile(path.join(webappRoot,".env.example"),"utf8");
for(const line of envExample.split(/\r?\n/)){
  const match=line.match(/^([A-Z0-9_]*(?:SECRET|PASSWORD|TOKEN|PRIVATE_KEY|SESSION_KEY)[A-Z0-9_]*)=(.+)$/);
  if(match&&match[2].trim())fail(".env.example contains a non-empty secret-like value for "+match[1]);
}

const repoTextFiles=(await walk(repoRoot)).filter(file=>
  !file.includes(path.sep+"node_modules"+path.sep) &&
  /\.(?:js|mjs|json|yml|yaml|md|html|css|txt|example)$/.test(file)
);
const secretPatterns=[
  {re:/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,label:"private key"},
  {re:/\bAKIA[0-9A-Z]{16}\b/,label:"AWS access key"},
  {re:/\bsk_live_[A-Za-z0-9]{16,}\b/,label:"Stripe live secret key"},
  {re:/\brk_live_[A-Za-z0-9]{16,}\b/,label:"Stripe restricted live key"},
  {re:/\bwhsec_[A-Za-z0-9]{16,}\b/,label:"webhook signing secret"}
];
for(const file of repoTextFiles){
  const text=await fs.readFile(file,"utf8");
  for(const {re,label} of secretPatterns){
    if(re.test(text))fail(path.relative(repoRoot,file).replaceAll(path.sep,"/")+" contains possible "+label);
  }
}

notes.push("Production JS modules checked: "+productionModules.length);
notes.push("Architecture budgets checked: "+Object.keys(budgets.files).length+" explicit hotspots + default budget");
notes.push("Repository secret-pattern scan completed");
notes.push("Engineering governance files present");

if(failures.length){
  console.error("RIMMA engineering audit failed:");
  for(const item of failures)console.error(" - "+item);
  process.exitCode=1;
}else{
  console.log("RIMMA engineering audit passed.");
  for(const item of notes)console.log(" - "+item);
}
