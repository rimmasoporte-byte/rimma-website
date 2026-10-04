(()=>{'use strict';
const KEY='rimma_locale_v1';
const OPTIONS=[
 ['es-ES','ES · Español'],
 ['ca-ES','CAT · Català'],
 ['ca-ES-valencia','VAL · Valencià'],
 ['eu-ES','EUS · Euskara'],
 ['gl-ES','GAL · Galego']
];
const normalize=value=>{
 const v=String(value||'').trim().toLowerCase().replaceAll('_','-');
 if(v==='ca-es-valencia'||v==='ca-valencia'||v==='valencia'||v==='val')return'ca-ES-valencia';
 if(v==='ca'||v.startsWith('ca-'))return'ca-ES';
 if(v==='eu'||v.startsWith('eu-')||v==='euskara')return'eu-ES';
 if(v==='gl'||v.startsWith('gl-')||v==='galego')return'gl-ES';
 if(v==='es'||v.startsWith('es-'))return'es-ES';
 return'';
};
const params=new URLSearchParams(location.search);
let stored='';
try{stored=localStorage.getItem(KEY)||'';}catch{}
let browser='';
for(const item of (navigator.languages||[navigator.language||''])){browser=normalize(item);if(browser)break;}
const locale=normalize(params.get('locale'))||normalize(stored)||browser||'es-ES';
try{localStorage.setItem(KEY,locale);}catch{}
document.documentElement.lang=locale;
if(params.has('locale')&&params.get('locale')!==locale){
 const u=new URL(location.href);u.searchParams.set('locale',locale);
 history.replaceState(null,'',u.pathname+u.search+u.hash);
}
const rows=[
['RIMMA — Todo tu taller, en perfecta armonía','RIMMA — Tot el teu taller, en perfecta harmonia','RIMMA — Zure tailer osoa, harmonia perfektuan','RIMMA — Todo o teu obradoiro, en perfecta harmonía'],
['Saltar al contenido','Saltar al contingut','Joan edukira','Saltar ao contido'],
['GESTIÓN PENSADA PARA TU OFICIO','GESTIÓ PENSADA PER AL TEU OFICI','ZURE LANBIDERAKO PENTSATUTAKO KUDEAKETA','XESTIÓN PENSADA PARA O TEU OFICIO'],
['TALLERES DE COSTURA Y ARREGLOS','TALLERS DE COSTURA I ARRANJAMENTS','JOSKINTZA ETA KONPONKETA TAILERRAK','OBRADOIROS DE COSTURA E ARRANXOS'],
['Inicio','Inici','Hasiera','Inicio'],
['Funciones','Funcions','Funtzioak','Funcións'],
['La experiencia','L’experiència','Esperientzia','A experiencia'],
['Cómo funciona','Com funciona','Nola funtzionatzen du','Como funciona'],
['Precio','Preu','Prezioa','Prezo'],
['Ayuda','Ajuda','Laguntza','Axuda'],
['Vista del espacio','Espaiaren vista','Gunearen ikuspegia','Vista do espazo'],
['CADA PRENDA. SIEMPRE LOCALIZADA.','CADA PEÇA. SEMPRE LOCALITZADA.','JANTZI BAKOITZA. BETI KOKATUTA.','CADA PRENDA. SEMPRE LOCALIZADA.'],
['¿Dónde está cada prenda?','On és cada peça?','Non dago jantzi bakoitza?','Onde está cada prenda?'],
['RIMMA lo sabe.','RIMMA ho sap.','RIMMAk badaki.','RIMMA sábeo.'],
['¿Quién está trabajando en ella? ¿Está pagada? ¿Cuándo hay que entregarla? RIMMA lo reúne todo en una sola pantalla: prendas, fotos, trabajos, medidas, responsables, ubicación, pagos, citas y entregas.','Qui hi està treballant? Està pagada? Quan s’ha de lliurar? RIMMA ho reuneix tot en una sola pantalla: peces, fotos, treballs, mides, responsables, ubicació, pagaments, cites i lliuraments.','Nor ari da bertan lanean? Ordainduta dago? Noiz entregatu behar da? RIMMAk dena pantaila bakarrean biltzen du: jantziak, argazkiak, lanak, neurriak, arduradunak, kokapena, ordainketak, hitzorduak eta entregak.','Quen está traballando nela? Está pagada? Cando hai que entregala? RIMMA reúne todo nunha soa pantalla: prendas, fotos, traballos, medidas, responsables, localización, pagamentos, citas e entregas.'],
['Explorar RIMMA','Explorar RIMMA','Arakatu RIMMA','Explorar RIMMA'],
['Ver cómo funciona','Veure com funciona','Ikusi nola funtzionatzen duen','Ver como funciona'],
['Fácil de usar','Fàcil d’utilitzar','Erabilerraza','Fácil de usar'],
['Pensada para tu taller','Pentsada per al teu taller','Zure tailerrerako pentsatua','Pensada para o teu obradoiro'],
['En tu idioma','En la teva llengua','Zure hizkuntzan','No teu idioma'],
['Vista ilustrativa con datos ficticios. Acceso web en preparación.','Vista il·lustrativa amb dades fictícies. Accés web en preparació.','Datu fikziozkoekin egindako ikuspegi ilustratiboa. Web sarbidea prestatzen ari da.','Vista ilustrativa con datos ficticios. Acceso web en preparación.'],
['Buscar clientes, pedidos o teléfono…','Cercar clients, comandes o telèfon…','Bilatu bezeroak, eskaerak edo telefonoa…','Buscar clientes, pedidos ou teléfono…'],
['Hoy en el taller','Avui al taller','Gaur tailerrean','Hoxe no obradoiro'],
['Pedidos','Comandes','Eskaerak','Pedidos'],
['Clientes','Clients','Bezeroak','Clientes'],
['Servicios','Serveis','Zerbitzuak','Servizos'],
['Informes','Informes','Txostenak','Informes'],
['Todo lo importante, al entrar.','Tot el que importa, només entrar.','Garrantzitsuena, sartu bezain laster.','Todo o importante, ao entrar.'],
['Entregas, retrasos, cobros, citas y carga del equipo.','Lliuraments, retards, cobraments, cites i càrrega de l’equip.','Entregak, atzerapenak, kobrantzak, hitzorduak eta taldearen karga.','Entregas, atrasos, cobros, citas e carga do equipo.'],
['Para hoy','Per avui','Gaurko','Para hoxe'],
['Ver prendas →','Veure peces →','Ikusi jantziak →','Ver prendas →'],
['Atrasadas','Endarrerides','Atzeratuak','Atrasadas'],
['Resolver →','Resoldre →','Ebatzi →','Resolver →'],
['Listas','Preparades','Prest','Listas'],
['Para recoger →','Per recollir →','Jasotzeko →','Para recoller →'],
['Citas hoy','Cites avui','Gaurko hitzorduak','Citas hoxe'],
['Ver agenda →','Veure agenda →','Ikusi agenda →','Ver axenda →'],
['Pedidos recientes','Comandes recents','Azken eskaerak','Pedidos recentes'],
['Ver todos →','Veure’ls tots →','Ikusi guztiak →','Ver todos →'],
['CLIENTE','CLIENT','BEZEROA','CLIENTE'],
['PRENDA','PEÇA','JANTZIA','PRENDA'],
['ENTREGA','LLIURAMENT','ENTREGA','ENTREGA'],
['ESTADO','ESTAT','EGOERA','ESTADO'],
['En proceso','En procés','Prozesuan','En proceso'],
['Listo','Preparat','Prest','Listo'],
['Recibido','Rebut','Jasota','Recibido'],
['Entregado','Lliurat','Entregatuta','Entregado'],
['Cada prenda, en su momento.','Cada peça, al seu moment.','Jantzi bakoitza, bere unean.','Cada prenda, no seu momento.'],
['Buscar pedido o cliente','Cercar comanda o client','Bilatu eskaera edo bezeroa','Buscar pedido ou cliente'],
['Nuevo pedido','Comanda nova','Eskaera berria','Novo pedido'],
['Todos','Tots','Guztiak','Todos'],
['Recibidos','Rebuts','Jasotakoak','Recibidos'],
['Gestión de clientes','Gestió de clients','Bezeroen kudeaketa','Xestión de clientes'],
['Sus datos, siempre a mano.','Les seves dades, sempre a mà.','Haien datuak, beti eskura.','Os seus datos, sempre á man.'],
['Control de pedidos','Control de comandes','Eskaeren kontrola','Control de pedidos'],
['De la prenda a la entrega.','De la peça al lliurament.','Jantzitik entregara.','Da prenda á entrega.'],
['Fechas organizadas','Dates organitzades','Datak antolatuta','Datas organizadas'],
['Cada encargo, a tiempo.','Cada encàrrec, a temps.','Lan bakoitza, garaiz.','Cada encargo, a tempo.'],
['Informes del taller','Informes del taller','Tailerraren txostenak','Informes do obradoiro'],
['Una visión más clara.','Una visió més clara.','Ikuspegi argiagoa.','Unha visión máis clara.'],
['CADA DETALLE IMPORTA','CADA DETALL IMPORTA','XEHETASUN BAKOITZAK DU GARRANTZIA','CADA DETALLE IMPORTA'],
['Un taller organizado','Un taller organitzat','Tailer antolatu bat','Un obradoiro organizado'],
['se nota','es nota','nabaritzen da','nótase'],
['en todo.','en tot.','denean.','en todo.'],
['Herramientas claras para lo que haces cada día, sin pantallas innecesarias ni procesos complicados.','Eines clares per al que fas cada dia, sense pantalles innecessàries ni processos complicats.','Egunero egiten duzunerako tresna argiak, alferrikako pantailarik eta prozesu konplexurik gabe.','Ferramentas claras para o que fas cada día, sen pantallas innecesarias nin procesos complicados.'],
['Un lugar para','Un espai per a','Leku bat','Un lugar para'],
['cada prenda.','cada peça.','jantzi bakoitzarentzat.','cada prenda.'],
['Registra los encargos, controla sus fechas de entrega y consulta en qué punto se encuentra cada trabajo.','Registra els encàrrecs, controla les dates de lliurament i consulta en quin punt es troba cada treball.','Erregistratu lanak, kontrolatu entrega-datak eta ikusi lan bakoitza zer puntutan dagoen.','Rexistra os encargos, controla as datas de entrega e consulta en que punto se atopa cada traballo.'],
['Conoce a quienes','Coneix els qui','Ezagutu','Coñece a quen'],
['vuelven a ti.','tornen a tu.','itzultzen direnak.','volve a ti.'],
['Conserva los datos de tus clientes y encuentra fácilmente su información cuando regresen.','Conserva les dades dels teus clients i troba fàcilment la seva informació quan tornin.','Gorde bezeroen datuak eta aurkitu erraz haien informazioa itzultzen direnean.','Conserva os datos dos teus clientes e atopa facilmente a súa información cando volvan.'],
['Tu oficio','El teu ofici','Zure lanbideak','O teu oficio'],
['tiene su valor.','té el seu valor.','bere balioa du.','ten o seu valor.'],
['Organiza tu catálogo de servicios y precios para preparar cada encargo con mayor facilidad.','Organitza el teu catàleg de serveis i preus per preparar cada encàrrec amb més facilitat.','Antolatu zerbitzuen eta prezioen katalogoa lan bakoitza errazago prestatzeko.','Organiza o teu catálogo de servizos e prezos para preparar cada encargo con máis facilidade.'],
['Una visión clara.','Una visió clara.','Ikuspegi argia.','Unha visión clara.'],
['Sin complicaciones.','Sense complicacions.','Konplikaziorik gabe.','Sen complicacións.'],
['Consulta importes, pagos y el movimiento de tus pedidos para tomar decisiones con la información a mano.','Consulta imports, pagaments i el moviment de les comandes per prendre decisions amb la informació a mà.','Kontsultatu zenbatekoak, ordainketak eta eskaeren mugimendua informazioa eskura izanda erabakiak hartzeko.','Consulta importes, pagamentos e o movemento dos pedidos para tomar decisións coa información á man.'],
['Tan intuitiva','Tan intuïtiva','Hain intuitiboa','Tan intuitiva'],
['como debe ser.','com ha de ser.','behar duen bezala.','como debe ser.'],
['Empieza con claridad','Comença amb claredat','Hasi argi','Comeza con claridade'],
['Tu día, de un vistazo.','El teu dia, d’un cop d’ull.','Zure eguna, begirada batean.','O teu día, dunha ollada.'],
['Cada pedido importa','Cada comanda importa','Eskaera bakoitza garrantzitsua da','Cada pedido importa'],
['Consulta el trabajo y su entrega.','Consulta el treball i el lliurament.','Kontsultatu lana eta entrega.','Consulta o traballo e a entrega.'],
['El detalle que hace volver.','El detall que fa tornar.','Itzultzea eragiten duen xehetasuna.','O detalle que fai volver.'],
['TODO EN SU LUGAR','TOT AL SEU LLOC','DENA BERE LEKUAN','TODO NO SEU LUGAR'],
['Menos tareas repetitivas.','Menys tasques repetitives.','Zeregin errepikakor gutxiago.','Menos tarefas repetitivas.'],
['Más tiempo para crear.','Més temps per crear.','Sortzeko denbora gehiago.','Máis tempo para crear.'],
['Recibe a tu cliente','Rep el teu client','Hartu zure bezeroa','Recibe o teu cliente'],
['Organiza el trabajo','Organitza el treball','Antolatu lana','Organiza o traballo'],
['Entrega con confianza','Lliura amb confiança','Entregatu konfiantzaz','Entrega con confianza'],
['Más tiempo para','Més temps per a','Denbora gehiago','Máis tempo para'],
['lo que mejor haces.','allò que millor fas.','hobekien egiten duzunerako.','o que mellor fas.'],
['Una herramienta para gestionar tu taller con claridad, sin complicaciones.','Una eina per gestionar el teu taller amb claredat, sense complicacions.','Zure tailerra argi eta konplikaziorik gabe kudeatzeko tresna.','Unha ferramenta para xestionar o teu obradoiro con claridade, sen complicacións.'],
['Tu taller, en orden.','El teu taller, en ordre.','Zure tailerra, ordenan.','O teu obradoiro, en orde.'],
['Explorar gratis la demo','Explorar la demo gratis','Probatu demo doan','Explorar gratis a demo'],
['Demo gratuita · No se realiza ningún cobro.','Demo gratuïta · No es fa cap cobrament.','Doako demoa · Ez da kobrantzarik egiten.','Demo gratuíta · Non se realiza ningún cobro.'],
['Todo lo esencial.','Tot l’essencial.','Funtsezko guztia.','Todo o esencial.'],
['Clientes y pedidos organizados','Clients i comandes organitzats','Bezeroak eta eskaerak antolatuta','Clientes e pedidos organizados'],
['Fechas de entrega y estados','Dates de lliurament i estats','Entrega-datak eta egoerak','Datas de entrega e estados'],
['Catálogo de servicios e importes','Catàleg de serveis i imports','Zerbitzuen eta zenbatekoen katalogoa','Catálogo de servizos e importes'],
['Información clara sobre tu taller','Informació clara sobre el teu taller','Zure tailerrari buruzko informazio argia','Información clara sobre o teu obradoiro'],
['ESTAMOS AQUÍ PARA AYUDARTE','SOM AQUÍ PER AJUDAR-TE','HEMEN GAUDE ZURI LAGUNTZEKO','ESTAMOS AQUÍ PARA AXUDARTE'],
['Lo importante,','El que importa,','Garrantzitsuena,','O importante,'],
['sin dudas.','sense dubtes.','zalantzarik gabe.','sen dúbidas.'],
['¿Necesitas algo más? Escríbenos','Necessites alguna cosa més? Escriu-nos','Beste zerbait behar duzu? Idatzi','Necesitas algo máis? Escríbenos'],
['¿Para qué negocios está pensada RIMMA?','Per a quins negocis està pensada RIMMA?','Zein negoziotarako dago pentsatuta RIMMA?','Para que negocios está pensada RIMMA?'],
['Para talleres de costura, modistas y negocios de arreglos de ropa que necesitan organizar encargos, clientes y servicios.','Per a tallers de costura, modistes i negocis d’arranjaments de roba que necessiten organitzar encàrrecs, clients i serveis.','Joskintza-tailerrentzat, modistentzat eta arropa-konponketa negozioentzat, lanak, bezeroak eta zerbitzuak antolatu behar dituztenentzat.','Para obradoiros de costura, modistas e negocios de arranxos de roupa que necesitan organizar encargos, clientes e servizos.'],
['Que lo extraordinario','Que l’extraordinari','Apartekoa','Que o extraordinario'],
['sea','sigui','izan dadila','sexa'],
['tu trabajo.','la teva feina.','zure lana.','o teu traballo.'],
['Del orden nos encargamos juntos.','De l’ordre ens n’encarreguem junts.','Ordenaz elkarrekin arduratzen gara.','Da orde encargámonos xuntos.'],
['Explorar la demostración','Explorar la demostració','Arakatu demoa','Explorar a demostración'],
['EXPLORA','EXPLORA','ARAKATU','EXPLORA'],
['Plan mensual','Pla mensual','Hileko plana','Plan mensual'],
['Ayuda y soporte','Ajuda i suport','Laguntza eta euskarria','Axuda e soporte'],
['Contacto','Contacte','Kontaktua','Contacto'],
['INFORMACIÓN','INFORMACIÓ','INFORMAZIOA','INFORMACIÓN'],
['Privacidad','Privacitat','Pribatutasuna','Privacidade'],
['Términos','Condicions','Baldintzak','Termos'],
['Eliminar cuenta','Eliminar compte','Ezabatu kontua','Eliminar conta'],
['RIMMA · Con cariño por tu oficio.','RIMMA · Zure ofizioarekiko maitasunez.','RIMMA · Zure lanbidearekiko maitasunez.','RIMMA · Con cariño polo teu oficio.'],
['ES · DISEÑADA PARA TALLERES DE COSTURA','ES · DISSENYADA PER A TALLERS DE COSTURA','ES · JOSKINTZA-TAILERRENTZAT DISEINATUA','ES · DESEÑADA PARA OBRADOIROS DE COSTURA']
];
const family=locale==='eu-ES'?'eu':locale==='gl-ES'?'gl':'ca';
const col=family==='ca'?1:family==='eu'?2:3;
const dict=new Map(rows.map(r=>[r[0],r[col]]));
if(locale==='ca-ES-valencia'){
 const val=new Map([
  ['Hoy en el taller','Hui al taller'],['Para hoy','Per a hui'],['Citas hoy','Cites hui'],
  ['Ver prendas →','Vore peces →'],['Ver todos →','Vore tots →'],['Entrega','Entrega'],
  ['ENTREGA','ENTREGA'],['Fechas organizadas','Dates organitzades']
 ]);
 for(const [k,v] of val)dict.set(k,v);
}
const tr=value=>{
 if(typeof value!=='string'||!value)return value;
 const key=value.trim();if(!key)return value;
 const next=dict.get(key)||key;
 if(next===key)return value;
 const a=value.match(/^\s*/)?.[0]||'',b=value.match(/\s*$/)?.[0]||'';
 return a+next+b;
};
const translateElement=el=>{
 if(!(el instanceof Element))return;
 for(const a of ['aria-label','title','placeholder'])if(el.hasAttribute(a))el.setAttribute(a,tr(el.getAttribute(a)));
};
const apply=root=>{
 if(root.nodeType===Node.TEXT_NODE){
  const p=root.parentElement;
  if(p&&!['SCRIPT','STYLE','TEXTAREA'].includes(p.tagName)){const n=tr(root.nodeValue);if(n!==root.nodeValue)root.nodeValue=n;}
  return;
 }
 if(root instanceof Element)translateElement(root);
 const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let n;
 while((n=w.nextNode())){const p=n.parentElement;if(p&&!['SCRIPT','STYLE','TEXTAREA'].includes(p.tagName)){const v=tr(n.nodeValue);if(v!==n.nodeValue)n.nodeValue=v;}}
 root.querySelectorAll?.('*').forEach(translateElement);
};
const mountPicker=()=>{
 document.querySelectorAll('.public-locale-select').forEach(select=>{
  select.replaceChildren();
  for(const [value,label] of OPTIONS){const o=document.createElement('option');o.value=value;o.textContent=label;select.append(o);}
  select.value=locale;
  select.addEventListener('change',()=>{
   const next=normalize(select.value)||'es-ES';
   try{localStorage.setItem(KEY,next);}catch{}
   const u=new URL(location.href);u.searchParams.set('locale',next);location.assign(u.pathname+u.search+u.hash);
  });
 });
};
const preserveDemoLinks=()=>{
 document.querySelectorAll('a[href]').forEach(a=>{
  const raw=a.getAttribute('href')||'';
  if(!raw.includes('demo/'))return;
  try{const u=new URL(raw,location.href);u.searchParams.set('locale',locale);a.setAttribute('href',u.pathname+u.search+u.hash);}catch{}
 });
};
const start=()=>{
 document.title=tr(document.title);
 apply(document.documentElement);
 mountPicker();
 preserveDemoLinks();
 if(locale!=='es-ES'){
  const observer=new MutationObserver(records=>records.forEach(r=>r.addedNodes.forEach(apply)));
  observer.observe(document.documentElement,{subtree:true,childList:true});
 }
};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();