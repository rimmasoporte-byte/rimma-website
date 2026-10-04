(()=>{'use strict';
const KEY='rimma_locale_v1';
const OPTIONS=Object.freeze([
 ['es-ES','ES · Español'],
 ['ca-ES','CAT · Català'],
 ['ca-ES-valencia','VAL · Valencià'],
 ['eu-ES','EUS · Euskara'],
 ['gl-ES','GAL · Galego']
]);
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
for(const candidate of (navigator.languages||[navigator.language||''])){
 browser=normalize(candidate);if(browser)break;
}
const locale=normalize(params.get('locale'))||normalize(stored)||browser||'es-ES';
try{localStorage.setItem(KEY,locale);}catch{}
document.documentElement.lang=locale;
if(params.has('locale')&&params.get('locale')!==locale){
 const u=new URL(location.href);u.searchParams.set('locale',locale);
 history.replaceState(null,'',u.pathname+u.search+u.hash);
}
const rows=[
['RIMMA — Software para talleres de costura y arreglos de ropa','RIMMA — Programari per a tallers de costura i arranjaments','RIMMA — Joskintza eta konponketa tailerretarako softwarea','RIMMA — Software para obradoiros de costura e arranxos'],
['Saltar al contenido','Saltar al contingut','Joan edukira','Saltar ao contido'],
['GESTIÓN PENSADA PARA TU OFICIO','GESTIÓ PENSADA PER AL TEU OFICI','ZURE LANBIDERAKO PENTSATUTAKO KUDEAKETA','XESTIÓN PENSADA PARA O TEU OFICIO'],
['TALLERES DE COSTURA Y ARREGLOS','TALLERS DE COSTURA I ARRANJAMENTS','JOSKINTZA ETA KONPONKETA TAILERRAK','OBRADOIROS DE COSTURA E ARRANXOS'],
['Inicio','Inici','Hasiera','Inicio'],
['Funciones','Funcions','Funtzioak','Funcións'],
['Cómo funciona','Com funciona','Nola funtzionatzen du','Como funciona'],
['Precio','Preu','Prezioa','Prezo'],
['Preguntas','Preguntes','Galderak','Preguntas'],
['Contacto','Contacte','Kontaktua','Contacto'],
['Entrar a mi taller','Entrar al meu taller','Sartu nire tailerrean','Entrar no meu obradoiro'],
['RIMMA · SOFTWARE PARA TALLERES DE COSTURA Y ARREGLOS','RIMMA · PROGRAMARI PER A TALLERS DE COSTURA I ARRANJAMENTS','RIMMA · JOSKINTZA ETA KONPONKETA TAILERRETARAKO SOFTWAREA','RIMMA · SOFTWARE PARA OBRADOIROS DE COSTURA E ARRANXOS'],
['Cada prenda, bajo control.','Cada peça, sota control.','Jantzi bakoitza, kontrolpean.','Cada prenda, baixo control.'],
['De la recepción a la entrega.','De la recepció al lliurament.','Harreratik entregara.','Da recepción á entrega.'],
['RIMMA conecta cliente, prenda, trabajo, fotografías, fecha de entrega, cobros y comunicación en un flujo sencillo pensado para un taller real.','RIMMA connecta client, peça, treball, fotografies, data de lliurament, cobraments i comunicació en un flux senzill pensat per a un taller real.','RIMMAk bezeroa, jantzia, lana, argazkiak, entrega-data, kobrantzak eta komunikazioa benetako tailerrerako pentsatutako fluxu erraz batean lotzen ditu.','RIMMA conecta cliente, prenda, traballo, fotografías, data de entrega, cobros e comunicación nun fluxo sinxelo pensado para un obradoiro real.'],
['Empieza 5 días gratis','Comença 5 dies gratis','Hasi 5 egun doan','Comeza 5 días gratis'],
['Ver cómo funciona','Veure com funciona','Ikusi nola funtzionatzen duen','Ver como funciona'],
['5 días gratis sin tarjeta','5 dies gratis sense targeta','5 egun doan txartelik gabe','5 días gratis sen tarxeta'],
['4,99 €/mes en España','4,99 €/mes a Espanya','4,99 €/hilean Espainian','4,99 €/mes en España'],
['INTERFAZ RIMMA','INTERFÍCIE RIMMA','RIMMA INTERFAZEA','INTERFAZ RIMMA'],
['Datos de ejemplo','Dades d’exemple','Adibideko datuak','Datos de exemplo'],
['Abrir la demo interactiva','Obrir la demo interactiva','Ireki demo interaktiboa','Abrir a demo interactiva'],
['Ficha de cada prenda','Fitxa de cada peça','Jantzi bakoitzaren fitxa','Ficha de cada prenda'],
['Trabajo, estado, fecha y precio.','Treball, estat, data i preu.','Lana, egoera, data eta prezioa.','Traballo, estado, data e prezo.'],
['Fotos antes y después','Fotos abans i després','Aurretik eta ondoren argazkiak','Fotos antes e despois'],
['Ligadas a la prenda correcta.','Vinculades a la peça correcta.','Dagokion jantziarekin lotuta.','Ligadas á prenda correcta.'],
['Cobros y saldo pendiente','Cobraments i saldo pendent','Kobrantzak eta saldo ordaintzeke','Cobros e saldo pendente'],
['Sabes cuánto queda por cobrar.','Saps quant queda per cobrar.','Badakizu zenbat geratzen den kobratzeko.','Sabes canto queda por cobrar.'],
['WhatsApp en un clic','WhatsApp amb un clic','WhatsApp klik batean','WhatsApp nun clic'],
['Mensajes preparados según el estado.','Missatges preparats segons l’estat.','Egoeraren araberako mezu prestatuak.','Mensaxes preparadas segundo o estado.'],
['TODO EL VIAJE DE LA PRENDA','TOT EL RECORREGUT DE LA PEÇA','JANTZIAREN IBILBIDE OSOA','TODO O PERCORRIDO DA PRENDA'],
['De “me deja este pantalón” a','De «em deixa aquests pantalons» a','“Praka hauek uzten dizkizut” esatetik','De «déixolle este pantalón» a'],
['“ya está listo”.','«ja està llest».','“prest dago” esatera.','«xa está listo».'],
['No necesitas una ERP enorme. Necesitas saber qué prenda entró, qué hay que hacer, para cuándo, cuánto se ha cobrado y qué decirle al cliente.','No necessites un ERP enorme. Necessites saber quina peça ha entrat, què cal fer, per a quan, quant s’ha cobrat i què dir al client.','Ez duzu ERP erraldoirik behar. Zein jantzi sartu den, zer egin behar den, noizko, zenbat kobratu den eta bezeroari zer esan jakin behar duzu.','Non necesitas un ERP enorme. Necesitas saber que prenda entrou, que hai que facer, para cando, canto se cobrou e que dicirlle ao cliente.'],
['Cliente','Client','Bezeroa','Cliente'],
['Datos y medidas cuando los necesitas.','Dades i mides quan les necessites.','Datuak eta neurriak behar dituzunean.','Datos e medidas cando os necesitas.'],
['Prenda','Peça','Jantzia','Prenda'],
['Foto, trabajo, precio y fecha.','Foto, treball, preu i data.','Argazkia, lana, prezioa eta data.','Foto, traballo, prezo e data.'],
['Trabajo','Treball','Lana','Traballo'],
['Recibido, en proceso o listo.','Rebut, en procés o preparat.','Jasota, prozesuan edo prest.','Recibido, en proceso ou listo.'],
['Cobro','Cobrament','Kobrantza','Cobro'],
['Pagado, pendiente y saldo restante.','Pagat, pendent i saldo restant.','Ordainduta, ordaintzeke eta gainerako saldoa.','Pagado, pendente e saldo restante.'],
['Mensaje preparado según el estado.','Missatge preparat segons l’estat.','Egoeraren araberako mezu prestatua.','Mensaxe preparada segundo o estado.'],
['Entrega','Lliurament','Entrega','Entrega'],
['Todo el encargo claro antes de entregar.','Tot l’encàrrec clar abans de lliurar.','Lan osoa argi entregatu aurretik.','Todo o encargo claro antes de entregar.'],
['RIMMA sigue la prenda, no una lista abstracta de tareas.','RIMMA segueix la peça, no una llista abstracta de tasques.','RIMMAk jantzia jarraitzen du, ez zereginen zerrenda abstraktu bat.','RIMMA segue a prenda, non unha lista abstracta de tarefas.'],
['Ver el flujo en la demo','Veure el flux a la demo','Ikusi fluxua demoan','Ver o fluxo na demo'],
['HECHA PARA EL TRABAJO REAL','FETA PER A LA FEINA REAL','BENETAKO LANERAKO EGINA','FEITA PARA O TRABALLO REAL'],
['Lo que necesitas','El que necessites','Behar duzuna','O que necesitas'],
['2–3 toques.','2–3 tocs.','2–3 ukitu.','2–3 toques.'],
['RIMMA evita pantallas de ERP que un pequeño taller no necesita. Cada función responde a una acción cotidiana.','RIMMA evita pantalles d’ERP que un petit taller no necessita. Cada funció respon a una acció quotidiana.','RIMMAk tailer txiki batek behar ez dituen ERP pantailak saihesten ditu. Funtzio bakoitzak eguneroko ekintza bati erantzuten dio.','RIMMA evita pantallas de ERP que un pequeno obradoiro non necesita. Cada función responde a unha acción cotiá.'],
['01 / PASAPORTE DE LA PRENDA','01 / PASSAPORT DE LA PEÇA','01 / JANTZIAREN PASAPORTEA','01 / PASAPORTE DA PRENDA'],
['Una ficha para','Una fitxa per a','Fitxa bat','Unha ficha para'],
['cada prenda.','cada peça.','jantzi bakoitzarentzat.','cada prenda.'],
['Trabajo, precio, estado, fecha y fotografías quedan asociados al mismo encargo para que no tengas que reconstruir la historia entre mensajes y notas.','Treball, preu, estat, data i fotografies queden associats al mateix encàrrec perquè no hagis de reconstruir la història entre missatges i notes.','Lana, prezioa, egoera, data eta argazkiak lan berari lotuta geratzen dira, mezu eta ohar artean historia berreraiki beharrik ez izateko.','Traballo, prezo, estado, data e fotografías quedan asociados ao mesmo encargo para que non teñas que reconstruír a historia entre mensaxes e notas.'],
['02 / FOTOS Y MEDIDAS','02 / FOTOS I MIDES','02 / ARGAZKIAK ETA NEURRIAK','02 / FOTOS E MEDIDAS'],
['Detalles que no','Detalls que no','Galduko ez diren','Detalles que non'],
['se pierden.','es perden.','xehetasunak.','se perden.'],
['Guarda fotografías de recepción, detalle o trabajo terminado y conserva fichas de medidas del cliente dentro de RIMMA.','Desa fotografies de recepció, detall o treball acabat i conserva fitxes de mides del client dins de RIMMA.','Gorde harrerako, xehetasuneko edo amaitutako lanaren argazkiak eta mantendu bezeroaren neurri-fitxak RIMMAn.','Garda fotografías de recepción, detalle ou traballo rematado e conserva fichas de medidas do cliente dentro de RIMMA.'],
['03 / COBROS','03 / COBRAMENTS','03 / KOBRANTZAK','03 / COBROS'],
['Sabes qué está','Saps què està','Badakizu zer dagoen','Sabes que está'],
['pagado y qué falta.','pagat i què falta.','ordainduta eta zer falta den.','pagado e que falta.'],
['Registra cobros, confirma el dinero recibido y consulta el saldo pendiente del pedido antes de entregar la prenda.','Registra cobraments, confirma els diners rebuts i consulta el saldo pendent de la comanda abans de lliurar la peça.','Erregistratu kobrantzak, baieztatu jasotako dirua eta begiratu eskaeraren saldoa jantzia entregatu aurretik.','Rexistra cobros, confirma o diñeiro recibido e consulta o saldo pendente do pedido antes de entregar a prenda.'],
['04 / WHATSAPP + SEGUIMIENTO','04 / WHATSAPP + SEGUIMENT','04 / WHATSAPP + JARRAIPENA','04 / WHATSAPP + SEGUIMENTO'],
['Del estado del pedido','De l’estat de la comanda','Eskaeraren egoeratik','Do estado do pedido'],
['al mensaje correcto.','al missatge correcte.','mezu egokira.','á mensaxe correcta.'],
['RIMMA prepara mensajes para pedido recibido, pedido listo, recordatorio o pago pendiente. Tú revisas y abres WhatsApp para enviarlo.','RIMMA prepara missatges per a comanda rebuda, comanda preparada, recordatori o pagament pendent. Tu ho revises i obres WhatsApp per enviar-lo.','RIMMAk eskaera jasota, eskaera prest, oroigarri edo ordainketa pendiente egoeretarako mezuak prestatzen ditu. Zuk berrikusi eta WhatsApp irekitzen duzu bidaltzeko.','RIMMA prepara mensaxes para pedido recibido, pedido listo, recordatorio ou pago pendente. Ti revísalo e abres WhatsApp para envialo.'],
['SIMPLE A PROPÓSITO','SENZILL A PROPÒSIT','NAHITAZ SINPLEA','SIMPLE A PROPÓSITO'],
['Tu taller primero.','El teu taller primer.','Zure tailerra lehenik.','O teu obradoiro primeiro.'],
['El software,','El programari,','Softwarea,','O software,'],
['después.','després.','ondoren.','despois.'],
['Explora cómo RIMMA convierte el trabajo diario del taller en una secuencia clara: recibir, organizar, cobrar, avisar y entregar.','Explora com RIMMA converteix la feina diària del taller en una seqüència clara: rebre, organitzar, cobrar, avisar i lliurar.','Ikusi RIMMAk tailerreko eguneroko lana sekuentzia argi batean nola bihurtzen duen: jaso, antolatu, kobratu, abisatu eta entregatu.','Explora como RIMMA converte o traballo diario do obradoiro nunha secuencia clara: recibir, organizar, cobrar, avisar e entregar.'],
['Empieza con claridad','Comença amb claredat','Hasi argi','Comeza con claridade'],
['Tu día, de un vistazo.','El teu dia, d’un cop d’ull.','Zure eguna, begirada batean.','O teu día, dunha ollada.'],
['Cada pedido importa','Cada comanda importa','Eskaera bakoitza garrantzitsua da','Cada pedido importa'],
['Consulta el trabajo y su entrega.','Consulta el treball i el lliurament.','Kontsultatu lana eta entrega.','Consulta o traballo e a entrega.'],
['Tu relación con cada cliente','La teva relació amb cada client','Bezero bakoitzarekin duzun harremana','A túa relación con cada cliente'],
['Los detalles, siempre cerca.','Els detalls, sempre a prop.','Xehetasunak, beti gertu.','Os detalles, sempre preto.'],
['Explorar la demostración completa','Explorar la demostració completa','Arakatu demo osoa','Explorar a demostración completa'],
['Tu taller,','El teu taller,','Zure tailerra,','O teu obradoiro,'],
['al día.','al dia.','egunean.','ao día.'],
['Hoy tienes todo a la vista.','Avui ho tens tot a la vista.','Gaur dena begi-bistan duzu.','Hoxe tes todo á vista.'],
['PRENDAS PARA HOY','PECES PER AVUI','GAURKO JANTZIAK','PRENDAS PARA HOXE'],
['El ritmo de tu taller','El ritme del teu taller','Zure tailerraren erritmoa','O ritmo do teu obradoiro'],
['Nuevo pedido ＋','Comanda nova ＋','Eskaera berria ＋','Novo pedido ＋'],
['Listos para recoger','Preparats per recollir','Jasotzeko prest','Listos para recoller'],
['Próximos 7 días','Pròxims 7 dies','Hurrengo 7 egunak','Próximos 7 días'],
['Pedidos recientes','Comandes recents','Azken eskaerak','Pedidos recentes'],
['Ver todos →','Veure’ls tots →','Ikusi guztiak →','Ver todos →'],
['ORGANIZACIÓN DEL TALLER','ORGANITZACIÓ DEL TALLER','TAILERRAREN ANTOLAKETA','ORGANIZACIÓN DO OBRADOIRO'],
['Pedidos','Comandes','Eskaerak','Pedidos'],
['Cada prenda, en su momento.','Cada peça, al seu moment.','Jantzi bakoitza, bere unean.','Cada prenda, no seu momento.'],
['Buscar pedido o cliente','Cercar comanda o client','Bilatu eskaera edo bezeroa','Buscar pedido ou cliente'],
['Nuevo pedido','Comanda nova','Eskaera berria','Novo pedido'],
['Todos','Tots','Guztiak','Todos'],
['Recibidos','Rebuts','Jasotakoak','Recibidos'],
['Listo','Preparat','Prest','Listo'],
['PERSONAS Y PRENDAS','PERSONES I PECES','PERTSONAK ETA JANTZIAK','PERSOAS E PRENDAS'],
['Clientes','Clients','Bezeroak','Clientes'],
['El detalle que hace volver.','El detall que fa tornar.','Itzultzea eragiten duen xehetasuna.','O detalle que fai volver.'],
['Buscar nombre o teléfono','Cercar nom o telèfon','Bilatu izena edo telefonoa','Buscar nome ou teléfono'],
['Nuevo cliente','Client nou','Bezero berria','Novo cliente'],
['Información de contacto','Informació de contacte','Harremanetarako informazioa','Información de contacto'],
['Datos de ejemplo.','Dades d’exemple.','Adibideko datuak.','Datos de exemplo.'],
['TRES MOMENTOS, UN MISMO FLUJO','TRES MOMENTS, UN MATEIX FLUX','HIRU UNE, FLUXU BERA','TRES MOMENTOS, UN MESMO FLUXO'],
['Sin perder el hilo.','Sense perdre el fil.','Haria galdu gabe.','Sen perder o fío.'],
['Recibe','Rep','Jaso','Recibe'],
['Selecciona el cliente, añade la prenda, el trabajo, el precio, la fecha y una foto si la necesitas.','Selecciona el client, afegeix la peça, el treball, el preu, la data i una foto si la necessites.','Hautatu bezeroa, gehitu jantzia, lana, prezioa, data eta argazki bat behar baduzu.','Selecciona o cliente, engade a prenda, o traballo, o prezo, a data e unha foto se a necesitas.'],
['Trabaja y avisa','Treballa i avisa','Egin lan eta abisatu','Traballa e avisa'],
['Cambia el estado, guarda fotos del proceso y abre en WhatsApp el mensaje adecuado para ese momento.','Canvia l’estat, desa fotos del procés i obre a WhatsApp el missatge adequat per a aquell moment.','Aldatu egoera, gorde prozesuaren argazkiak eta ireki WhatsAppen une horretarako mezu egokia.','Cambia o estado, garda fotos do proceso e abre en WhatsApp a mensaxe adecuada para ese momento.'],
['Cobra y entrega','Cobra i lliura','Kobratu eta entregatu','Cobra e entrega'],
['Consulta lo confirmado y lo pendiente. Cuando todo esté listo, entrega con el historial del encargo ordenado.','Consulta el que està confirmat i pendent. Quan tot estigui preparat, lliura amb l’historial de l’encàrrec ordenat.','Kontsultatu baieztatutakoa eta pendiente dagoena. Dena prest dagoenean, entregatu lanaren historia ordenatuta.','Consulta o confirmado e o pendente. Cando todo estea listo, entrega co historial do encargo ordenado.'],
['SIN UNA ERP QUE TE SOBRE','SENSE UN ERP QUE ET SOBRI','SOBERAN DUZUN ERP-RIK GABE','SEN UN ERP QUE CHE SOBRE'],
['Un precio pequeño.','Un preu petit.','Prezio txikia.','Un prezo pequeno.'],
['Un flujo completo.','Un flux complet.','Fluxu osoa.','Un fluxo completo.'],
['Clientes, prendas, fotografías, medidas, fechas, servicios, cobros y WhatsApp desde una sola cuenta.','Clients, peces, fotografies, mides, dates, serveis, cobraments i WhatsApp des d’un sol compte.','Bezeroak, jantziak, argazkiak, neurriak, datak, zerbitzuak, kobrantzak eta WhatsApp kontu bakarretik.','Clientes, prendas, fotografías, medidas, datas, servizos, cobros e WhatsApp desde unha soa conta.'],
['RIMMA · PLAN MENSUAL','RIMMA · PLA MENSUAL','RIMMA · HILEKO PLANA','RIMMA · PLAN MENSUAL'],
['Tu taller, en orden.','El teu taller, en ordre.','Zure tailerra, ordenan.','O teu obradoiro, en orde.'],
['Precio en España. En otros países, Google Play mostrará el precio final en tu moneda local, con los impuestos aplicables, antes de confirmar el pago.','Preu a Espanya. Google Play mostrarà el preu final i els impostos aplicables abans de confirmar el pagament.','Prezioa Espainian. Google Play-k azken prezioa eta aplikatu beharreko zergak erakutsiko ditu ordainketa baieztatu aurretik.','Prezo en España. Google Play mostrará o prezo final e os impostos aplicables antes de confirmar o pagamento.'],
['Suscribirme ahora','Subscriure’m ara','Harpidetu orain','Subscribirme agora'],
['Puedes suscribirte en cualquier momento, también durante los 5 días de prueba.','Pots subscriure’t en qualsevol moment, també durant els 5 dies de prova.','Edonoiz harpidetu zaitezke, baita 5 eguneko proban ere.','Podes subscribirte en calquera momento, tamén durante os 5 días de proba.'],
['Explorar gratis la demo ↗','Explorar la demo gratis ↗','Probatu demo doan ↗','Explorar gratis a demo ↗'],
['INCLUIDO EN RIMMA','INCLÒS A RIMMA','RIMMAN BARNE','INCLUÍDO EN RIMMA'],
['Tu flujo diario.','El teu flux diari.','Zure eguneroko fluxua.','O teu fluxo diario.'],
['Sin módulos extra.','Sense mòduls extra.','Aparteko modulurik gabe.','Sen módulos extra.'],
['La idea es simple: que puedas seguir una prenda sin saltar entre libreta, galería, calculadora y WhatsApp.','La idea és simple: que puguis seguir una peça sense saltar entre llibreta, galeria, calculadora i WhatsApp.','Ideia sinplea da: jantzi bati koadernoa, galeria, kalkulagailua eta WhatsApp artean jauzi egin gabe jarraitu ahal izatea.','A idea é simple: que poidas seguir unha prenda sen saltar entre caderno, galería, calculadora e WhatsApp.'],
['Prendas, estados y fechas de entrega','Peces, estats i dates de lliurament','Jantziak, egoerak eta entrega-datak','Prendas, estados e datas de entrega'],
['Fotos antes, detalle y trabajo terminado','Fotos abans, detall i treball acabat','Aurretik, xehetasuneko eta amaitutako lanaren argazkiak','Fotos antes, detalle e traballo rematado'],
['Medidas, servicios y precios','Mides, serveis i preus','Neurriak, zerbitzuak eta prezioak','Medidas, servizos e prezos'],
['Cobros, saldo pendiente y WhatsApp','Cobraments, saldo pendent i WhatsApp','Kobrantzak, saldo pendiente eta WhatsApp','Cobros, saldo pendente e WhatsApp'],
['ESTAMOS AQUÍ PARA AYUDARTE','SOM AQUÍ PER AJUDAR-TE','HEMEN GAUDE ZURI LAGUNTZEKO','ESTAMOS AQUÍ PARA AXUDARTE'],
['Lo importante,','El que importa,','Garrantzitsuena,','O importante,'],
['sin dudas.','sense dubtes.','zalantzarik gabe.','sen dúbidas.'],
['¿Necesitas algo más? Escríbenos','Necessites alguna cosa més? Escriu-nos','Beste zerbait behar duzu? Idatzi','Necesitas algo máis? Escríbenos'],
['¿Para qué negocios está pensada RIMMA?','Per a quins negocis està pensada RIMMA?','Zein negoziotarako dago pentsatuta RIMMA?','Para que negocios está pensada RIMMA?'],
['Para talleres de costura, modistas y negocios de arreglos de ropa que necesitan organizar encargos, clientes y servicios.','Per a tallers de costura, modistes i negocis d’arranjaments de roba que necessiten organitzar encàrrecs, clients i serveis.','Joskintza-tailerrentzat, modistentzat eta arropa-konponketa negozioentzat, lanak, bezeroak eta zerbitzuak antolatu behar dituztenentzat.','Para obradoiros de costura, modistas e negocios de arranxos de roupa que necesitan organizar encargos, clientes e servizos.'],
['¿Podré trabajar desde el ordenador?','Podré treballar des de l’ordinador?','Ordenagailutik lan egin ahal izango dut?','Poderei traballar desde o ordenador?'],
['Sí. El espacio web funciona con tu cuenta RIMMA y los datos de tu taller. Algunas funciones avanzadas siguen disponibles únicamente en Android.','Sí. L’espai web funciona amb el teu compte RIMMA i les dades del teu taller. Algunes funcions avançades continuen disponibles només a Android.','Bai. Web guneak zure RIMMA kontuarekin eta tailerreko datuekin funtzionatzen du. Funtzio aurreratu batzuk Androiden bakarrik daude oraindik.','Si. O espazo web funciona coa túa conta RIMMA e os datos do teu obradoiro. Algunhas funcións avanzadas seguen dispoñibles só en Android.'],
['¿RIMMA puede guardar fotos de la prenda?','RIMMA pot desar fotos de la peça?','RIMMAk jantziaren argazkiak gorde ditzake?','RIMMA pode gardar fotos da prenda?'],
['Sí. Puedes asociar fotografías a cada prenda y distinguir entre recepción, detalle, trabajo terminado u otro tipo de foto.','Sí. Pots associar fotografies a cada peça i distingir entre recepció, detall, treball acabat o un altre tipus de foto.','Bai. Jantzi bakoitzari argazkiak lotu eta harrera, xehetasuna, amaitutako lana edo beste argazki mota batzuk bereiz ditzakezu.','Si. Podes asociar fotografías a cada prenda e distinguir entre recepción, detalle, traballo rematado ou outro tipo de foto.'],
['¿RIMMA envía WhatsApp automáticamente?','RIMMA envia WhatsApp automàticament?','RIMMAk WhatsApp automatikoki bidaltzen du?','RIMMA envía WhatsApp automaticamente?'],
['No. RIMMA prepara el texto según el estado del pedido y abre WhatsApp; tú revisas y decides cuándo enviarlo.','No. RIMMA prepara el text segons l’estat de la comanda i obre WhatsApp; tu revises i decideixes quan enviar-lo.','Ez. RIMMAk testua eskaeraren egoeraren arabera prestatzen du eta WhatsApp irekitzen du; zuk berrikusi eta noiz bidali erabakitzen duzu.','Non. RIMMA prepara o texto segundo o estado do pedido e abre WhatsApp; ti revisas e decides cando envialo.'],
['¿Mis datos de la demostración se guardan?','Es guarden les meves dades de la demostració?','Demoaren nire datuak gordetzen dira?','Gárdanse os meus datos da demostración?'],
['No. La demostración funciona con datos ficticios, separados del entorno real. No introduzcas información personal ni contraseñas en ella.','No. La demostració funciona amb dades fictícies, separades de l’entorn real. No hi introdueixis informació personal ni contrasenyes.','Ez. Demoak datu fikziozkoekin funtzionatzen du, benetako ingurunetik bereizita. Ez sartu informazio pertsonalik edo pasahitzik.','Non. A demostración funciona con datos ficticios, separados do contorno real. Non introduzas información persoal nin contrasinais.'],
['DE LA PRIMERA FOTO A LA ENTREGA','DE LA PRIMERA FOTO AL LLIURAMENT','LEHEN ARGAZKITIK ENTREGARA','DA PRIMEIRA FOTO Á ENTREGA'],
['Que cada prenda tenga','Que cada peça tingui','Jantzi bakoitzak izan dezala','Que cada prenda teña'],
['su historia en orden.','la seva història en ordre.','bere historia ordenan.','a súa historia en orde.'],
['Prueba el flujo completo de RIMMA durante 5 días sin tarjeta y decide después.','Prova el flux complet de RIMMA durant 5 dies sense targeta i decideix després.','Probatu RIMMAren fluxu osoa 5 egunez txartelik gabe eta erabaki gero.','Proba o fluxo completo de RIMMA durante 5 días sen tarxeta e decide despois.'],
['Ver demo primero →','Veure primer la demo →','Ikusi lehenik demoa →','Ver primeiro a demo →'],
['Pensada para quienes transforman','Pensada per a qui transforma','Eraldatzen dutenentzat pentsatua','Pensada para quen transforma'],
['cada detalle en algo especial.','cada detall en una cosa especial.','xehetasun bakoitza zerbait berezi bihurtzen dutenentzat.','cada detalle en algo especial.'],
['EXPLORA','EXPLORA','ARAKATU','EXPLORA'],
['La experiencia','L’experiència','Esperientzia','A experiencia'],
['Plan mensual','Pla mensual','Hileko plana','Plan mensual'],
['Demo interactiva','Demo interactiva','Demo interaktiboa','Demo interactiva'],
['Ayuda y soporte','Ajuda i suport','Laguntza eta euskarria','Axuda e soporte'],
['INFORMACIÓN','INFORMACIÓ','INFORMAZIOA','INFORMACIÓN'],
['Aviso legal','Avís legal','Lege-oharra','Aviso legal'],
['Privacidad','Privacitat','Pribatutasuna','Privacidade'],
['Términos','Condicions','Baldintzak','Termos'],
['Eliminar cuenta','Eliminar compte','Ezabatu kontua','Eliminar conta'],
['RIMMA · Con cariño por tu oficio.','RIMMA · Zure ofizioarekiko maitasunez.','RIMMA · Zure lanbidearekiko maitasunez.','RIMMA · Con cariño polo teu oficio.'],
['ES · DISEÑADA PARA TALLERES DE COSTURA','ES · DISSENYADA PER A TALLERS DE COSTURA','ES · JOSKINTZA-TAILERRENTZAT DISEINATUA','ES · DESEÑADA PARA OBRADOIROS DE COSTURA']
];
const family=locale==='eu-ES'?'eu':locale==='gl-ES'?'gl':'ca';
const col=family==='ca'?1:family==='eu'?2:3;
const dict=new Map(rows.map(row=>[row[0],row[col]]));
if(locale==='ca-ES-valencia'){
 const valencian=new Map([
  ['Cómo funciona','Com funciona'],['Preguntas','Preguntes'],
  ['Cada pieza, sota control.','Cada peça, sota control.'],
  ['De la recepción a la entrega.','De la recepció a l’entrega.'],
  ['Ver cómo funciona','Vore com funciona'],
  ['Abrir la demo interactiva','Obrir la demo interactiva'],
  ['Hoy tienes todo a la vista.','Hui ho tens tot a la vista.'],
  ['PRENDAS PARA HOY','PECES PER A HUI'],
  ['Ver todos →','Vore’ls tots →'],
  ['Fecha de entrega','Data d’entrega']
 ]);
 for(const [k,v] of valencian)dict.set(k,v);
}
const translate=value=>{
 if(typeof value!=='string'||!value)return value;
 const key=value.trim();if(!key)return value;
 const next=dict.get(key)||key;
 if(next===key)return value;
 return (value.match(/^\s*/)?.[0]||'')+next+(value.match(/\s*$/)?.[0]||'');
};
const translateElement=el=>{
 if(!(el instanceof Element))return;
 for(const attr of ['aria-label','title','placeholder']){
  if(el.hasAttribute(attr))el.setAttribute(attr,translate(el.getAttribute(attr)));
 }
};
const apply=root=>{
 if(root.nodeType===Node.TEXT_NODE){
  const p=root.parentElement;
  if(p&&!['SCRIPT','STYLE','TEXTAREA'].includes(p.tagName)){
   const next=translate(root.nodeValue);if(next!==root.nodeValue)root.nodeValue=next;
  }
  return;
 }
 if(root instanceof Element)translateElement(root);
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;
 while((node=walker.nextNode())){
  const p=node.parentElement;
  if(p&&!['SCRIPT','STYLE','TEXTAREA'].includes(p.tagName)){
   const next=translate(node.nodeValue);if(next!==node.nodeValue)node.nodeValue=next;
  }
 }
 root.querySelectorAll?.('*').forEach(translateElement);
};
const withLocale=raw=>{
 try{
  const u=new URL(raw,location.href);
  if(u.hostname==='rimmaapp.com'||u.hostname==='www.rimmaapp.com'||u.hostname==='app.rimmaapp.com'){
   u.searchParams.set('locale',locale);
   if(u.hostname==='app.rimmaapp.com')u.searchParams.set('country','ES');
   return u.toString();
  }
 }catch{}
 return raw;
};
const rewriteLinks=()=>{
 document.querySelectorAll('a[href]').forEach(a=>{
  const href=a.getAttribute('href');if(!href||href.startsWith('#')||href.startsWith('mailto:'))return;
  const next=withLocale(href);if(next!==href)a.href=next;
 });
};
const mount=()=>{
 document.querySelectorAll('.public-locale-select').forEach(select=>{
  select.replaceChildren();
  for(const [value,label] of OPTIONS){
   const o=document.createElement('option');o.value=value;o.textContent=label;select.append(o);
  }
  select.value=locale;
  select.addEventListener('change',()=>{
   const next=normalize(select.value)||'es-ES';
   try{localStorage.setItem(KEY,next);}catch{}
   const u=new URL(location.href);u.searchParams.set('locale',next);
   location.assign(u.pathname+u.search+u.hash);
  });
 });
};
const start=()=>{
 document.title=translate(document.title);
 if(locale!=='es-ES')apply(document.documentElement);
 mount();rewriteLinks();
 if(locale!=='es-ES'){
  const obs=new MutationObserver(records=>{
   for(const record of records)record.addedNodes.forEach(node=>{if(node.nodeType===1||node.nodeType===3)apply(node);});
  });
  obs.observe(document.documentElement,{subtree:true,childList:true});
 }
};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();