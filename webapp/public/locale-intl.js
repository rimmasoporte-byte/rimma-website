(()=>{'use strict';
const base=window.RimmaLocale||{};
const locale=base.locale||'es-ES';
if(locale==='es-ES')return;

const rows=[
['Mi taller — RIMMA','El meu taller — RIMMA','Nire tailerra — RIMMA','O meu obradoiro — RIMMA'],
['Crea tu taller — RIMMA','Crea el teu taller — RIMMA','Sortu zure tailerra — RIMMA','Crea o teu obradoiro — RIMMA'],
['Ir al contenido','Ves al contingut','Joan edukira','Ir ao contido'],
['TU TALLER, A TU RITMO','EL TEU TALLER, AL TEU RITME','ZURE TAILERRA, ZURE ERRITMOAN','O TEU OBRADOIRO, AO TEU RITMO'],
['Un lugar','Un espai','Lasai','Un lugar'],
['para','per','sortzeko','para'],
['crear','crear','leku','crear'],
['con calma.','amb calma.','bat.','con calma.'],
['Las prendas, los clientes y las cuentas de tu taller, en orden desde cualquier pantalla.','Les peces, els clients i els comptes del teu taller, ordenats des de qualsevol pantalla.','Zure tailerreko jantziak, bezeroak eta kontuak, edozein pantailatan antolatuta.','As prendas, os clientes e as contas do teu obradoiro, ordenadas desde calquera pantalla.'],
['COSTURA Y ARREGLOS','COSTURA I ARRANJAMENTS','JOSKINTZA ETA KONPONKETAK','COSTURA E ARRANXOS'],
['ACCEDE A TU ESPACIO','ACCEDEIX AL TEU ESPAI','SARTU ZURE GUNERA','ACCEDE AO TEU ESPAZO'],
['Qué bueno','Quina alegria','Pozten gara','Que ben'],
['tenerte aquí.','tenir-te aquí.','hemen izatea.','terte aquí.'],
['Inicia sesión con la misma cuenta que utilizas en la aplicación Android.','Inicia sessió amb el mateix compte que utilitzes a l’aplicació Android.','Hasi saioa Android aplikazioan erabiltzen duzun kontu berarekin.','Inicia sesión coa mesma conta que utilizas na aplicación Android.'],
['Correo electrónico','Correu electrònic','Helbide elektronikoa','Correo electrónico'],
['Sitio web','Lloc web','Webgunea','Sitio web'],
['Contraseña','Contrasenya','Pasahitza','Contrasinal'],
['Tu contraseña','La teva contrasenya','Zure pasahitza','O teu contrasinal'],
['Entrar a mi taller','Entrar al meu taller','Sartu nire tailerrean','Entrar no meu obradoiro'],
['¿Aún no tienes cuenta?','Encara no tens compte?','Oraindik ez duzu konturik?','Aínda non tes conta?'],
['Empieza 5 días gratis','Comença 5 dies gratis','Hasi 5 egun doan','Comeza 5 días gratis'],
['¿Necesitas ayuda?','Necessites ajuda?','Laguntza behar duzu?','Necesitas axuda?'],
['Escribe a soporte','Escriu a suport','Idatzi laguntzari','Escribe a soporte'],
['Privacidad','Privacitat','Pribatutasuna','Privacidade'],
['Términos','Condicions','Baldintzak','Termos'],
['Abriendo tu taller…','Obrint el teu taller…','Zure tailerra irekitzen…','Abrindo o teu obradoiro…'],
['MI ESPACIO DE TRABAJO','EL MEU ESPAI DE TREBALL','NIRE LAN-GUNEA','O MEU ESPAZO DE TRABALLO'],
['Mi taller','El meu taller','Nire tailerra','O meu obradoiro'],
['TU TALLER','EL TEU TALLER','ZURE TAILERRA','O TEU OBRADOIRO'],
['Inicio','Inici','Hasiera','Inicio'],
['Pedidos','Comandes','Eskaerak','Pedidos'],
['Citas','Cites','Hitzorduak','Citas'],
['Clientes','Clients','Bezeroak','Clientes'],
['Servicios','Serveis','Zerbitzuak','Servizos'],
['Informes','Informes','Txostenak','Informes'],
['TU CUENTA','EL TEU COMPTE','ZURE KONTUA','A TÚA CONTA'],
['Suscripción','Subscripció','Harpidetza','Subscrición'],
['Configuración','Configuració','Ezarpenak','Configuración'],
['Guía rápida','Guia ràpida','Gida azkarra','Guía rápida'],
['Ayuda','Ajuda','Laguntza','Axuda'],
['Cerrar sesión','Tancar sessió','Amaitu saioa','Pechar sesión'],
['Tu espacio privado','El teu espai privat','Zure gune pribatua','O teu espazo privado'],
['MI TALLER','EL MEU TALLER','NIRE TAILERRA','O MEU OBRADOIRO'],
['HOY EN TU TALLER','AVUI AL TEU TALLER','GAUR ZURE TAILERREAN','HOXE NO TEU OBRADOIRO'],
['Tu taller,','El teu taller,','Zure tailerra,','O teu obradoiro,'],
['al día.','al dia.','egunean.','ao día.'],
['Un lugar para cuidar cada detalle y no perder de vista la siguiente entrega.','Un espai per cuidar cada detall i no perdre de vista el pròxim lliurament.','Xehetasun bakoitza zaintzeko eta hurrengo entrega begi-bistan izateko gunea.','Un lugar para coidar cada detalle e non perder de vista a seguinte entrega.'],
['+ Nuevo pedido','+ Comanda nova','+ Eskaera berria','+ Novo pedido'],
['HOY','AVUI','GAUR','HOXE'],
['ATRASADAS','ENDARRERIDES','ATZERATUAK','ATRASADAS'],
['LISTAS','PREPARADES','PREST','LISTAS'],
['POR COBRAR','PER COBRAR','KOBRATZEKO','POR COBRAR'],
['Entrega hoy','Entrega avui','Entrega gaur','Entrega hoxe'],
['Esta semana:','Aquesta setmana:','Aste honetan:','Esta semana:'],
['Necesitan atención','Necessiten atenció','Arreta behar dute','Necesitan atención'],
['Sobrecargados','Sobrecarregats','Gainkargatuak','Sobrecargados'],
['Sin cobros pendientes','Sense cobraments pendents','Ez dago kobrantzarik pendiente','Sen cobros pendentes'],
['Nada pendiente.','Res pendent.','Ez dago ezer egiteke.','Nada pendente.'],
['No hay citas hoy.','Avui no hi ha cites.','Gaur ez dago hitzordurik.','Hoxe non hai citas.'],
['Añade responsables a las prendas para ver la carga.','Assigna responsables a les peces per veure la càrrega.','Esleitu arduradunak jantziei karga ikusteko.','Asigna responsables ás prendas para ver a carga.'],
['Taller','Taller','Tailerra','Obradoiro'],
['prendas activas','peces actives','jantzi aktibo','prendas activas'],
['Prendas con entrega hoy','Peces amb lliurament avui','Gaur entregatzeko jantziak','Prendas con entrega hoxe'],
['Requieren atención','Requereixen atenció','Arreta behar dute','Requiren atención'],
['Para recoger','Per recollir','Jasotzeko','Para recoller'],
['Pruebas y recogidas','Proves i recollides','Probak eta jasotzeak','Probas e recollidas'],
['Profesionales sobrecargados','Professionals sobrecarregats','Gainkargatutako profesionalak','Profesionais sobrecargados'],
['Ver prendas','Veure peces','Ikusi jantziak','Ver prendas'],
['Resolver','Resoldre','Ebatzi','Resolver'],
['Ver listas','Veure preparades','Ikusi prest daudenak','Ver listas'],
['Prendas recientes','Peces recents','Azken jantziak','Prendas recentes'],
['Ver todas','Veure totes','Ikusi guztiak','Ver todas'],
['Recibido','Rebut','Jasota','Recibido'],
['En proceso','En procés','Prozesuan','En proceso'],
['Listo','Preparat','Prest','Listo'],
['Entregado','Lliurat','Entregatuta','Entregado'],
['Cancelado','Cancel·lat','Ezeztatuta','Cancelado'],
['Sin estado','Sense estat','Egoerarik gabe','Sen estado'],
['Sin fecha','Sense data','Datarik gabe','Sen data'],
['Sin asignar','Sense assignar','Esleitu gabe','Sen asignar'],
['Sin ubicación','Sense ubicació','Kokapenik gabe','Sen localización'],
['Sin ficha vinculada','Sense fitxa vinculada','Lotutako fitxarik gabe','Sen ficha vinculada'],
['Abrir prenda','Obrir peça','Ireki jantzia','Abrir prenda'],
['Cobrar','Cobrar','Kobratu','Cobrar'],
['Editar','Editar','Editatu','Editar'],
['Más acciones','Més accions','Ekintza gehiago','Máis accións'],
['Información del pedido','Informació de la comanda','Eskaeraren informazioa','Información do pedido'],
['Documentos','Documents','Dokumentuak','Documentos'],
['Imprimir etiqueta','Imprimir etiqueta','Etiketa inprimatu','Imprimir etiqueta'],
['Repetir pedido','Repetir comanda','Eskaera errepikatu','Repetir pedido'],
['Eliminar','Eliminar','Ezabatu','Eliminar'],
['Pagado','Pagat','Ordainduta','Pagado'],
['Pendiente','Pendent','Ordaintzeke','Pendente'],
['Total','Total','Guztira','Total'],
['Pedido','Comanda','Eskaera','Pedido'],
['Prenda','Peça','Jantzia','Prenda'],
['Entrega','Lliurament','Entrega','Entrega'],
['Estado','Estat','Egoera','Estado'],
['Importe','Import','Zenbatekoa','Importe'],
['Acciones','Accions','Ekintzak','Accións'],
['Buscar pedidos','Cercar comandes','Bilatu eskaerak','Buscar pedidos'],
['Buscar pedido o cliente','Cercar comanda o client','Bilatu eskaera edo bezeroa','Buscar pedido ou cliente'],
['Filtrar estado','Filtrar estat','Iragazi egoera','Filtrar estado'],
['Todos los estados','Tots els estats','Egoera guztiak','Todos os estados'],
['Recibidos','Rebuts','Jasotakoak','Recibidos'],
['Listos','Preparats','Prest daudenak','Listos'],
['Entregados','Lliurats','Entregatutakoak','Entregados'],
['← Anterior','← Anterior','← Aurrekoa','← Anterior'],
['Siguiente →','Següent →','Hurrengoa →','Seguinte →'],
['Nuevo cliente','Client nou','Bezero berria','Novo cliente'],
['+ Nuevo cliente','+ Client nou','+ Bezero berria','+ Novo cliente'],
['Buscar clientes','Cercar clients','Bilatu bezeroak','Buscar clientes'],
['Buscar nombre, teléfono o correo','Cercar nom, telèfon o correu','Bilatu izena, telefonoa edo posta','Buscar nome, teléfono ou correo'],
['Nombre','Nom','Izena','Nome'],
['Teléfono','Telèfon','Telefonoa','Teléfono'],
['Correo','Correu','Posta','Correo'],
['Notas','Notes','Oharrak','Notas'],
['Nuevo pedido','Comanda nova','Eskaera berria','Novo pedido'],
['Cliente','Client','Bezeroa','Cliente'],
['Selecciona un cliente','Selecciona un client','Hautatu bezero bat','Selecciona un cliente'],
['Servicio','Servei','Zerbitzua','Servizo'],
['Trabajo','Treball','Lana','Traballo'],
['Precio','Preu','Prezioa','Prezo'],
['Moneda','Moneda','Moneta','Moeda'],
['Fecha de entrega','Data de lliurament','Entrega-data','Data de entrega'],
['Fotografía de la prenda','Fotografia de la peça','Jantziaren argazkia','Fotografía da prenda'],
['Guardar','Desar','Gorde','Gardar'],
['Cancelar','Cancel·lar','Utzi','Cancelar'],
['Cerrar','Tancar','Itxi','Pechar'],
['Descargar','Baixar','Deskargatu','Descargar'],
['Categoría','Categoria','Kategoria','Categoría'],
['+ Categoría','+ Categoria','+ Kategoria','+ Categoría'],
['+ Servicio','+ Servei','+ Zerbitzua','+ Servizo'],
['Periodo del informe','Període de l’informe','Txostenaren aldia','Período do informe'],
['Este mes','Aquest mes','Hilabete honetan','Este mes'],
['Esta semana','Aquesta setmana','Aste honetan','Esta semana'],
['Hoy','Avui','Gaur','Hoxe'],
['Este año','Aquest any','Aurten','Este ano'],
['Selecciona un periodo.','Selecciona un període.','Hautatu aldi bat.','Selecciona un período.'],
['CLIENTES QUE VUELVEN','CLIENTS QUE TORNEN','ITZULTZEN DIREN BEZEROAK','CLIENTES QUE VOLVEN'],
['Trabajos más solicitados','Treballs més sol·licitats','GEHIEN ESKATUTAKO LANAK','Traballos máis solicitados'],
['Ticket medio','Tiquet mitjà','Batez besteko tiketa','Tícket medio'],
['Saldo pendiente actual','Saldo pendent actual','Uneko saldo ordaintzeke','Saldo pendente actual'],
['Cómo te pagan','Com et paguen','Nola ordaintzen dizute','Como che pagan'],
['Tu suscripción','La teva subscripció','Zure harpidetza','A túa subscrición'],
['Prueba gratuita','Prova gratuïta','Doako proba','Proba gratuíta'],
['Activa','Activa','Aktibo','Activa'],
['Sin acceso','Sense accés','Sarbiderik gabe','Sen acceso'],
['Actualizar estado','Actualitzar estat','Eguneratu egoera','Actualizar estado'],
['Gestionar en Google Play ↗','Gestionar a Google Play ↗','Kudeatu Google Play-n ↗','Xestionar en Google Play ↗'],
['Mi cuenta','El meu compte','Nire kontua','A miña conta'],
['Datos de la cuenta','Dades del compte','Kontuaren datuak','Datos da conta'],
['Cambiar contraseña','Canviar contrasenya','Aldatu pasahitza','Cambiar contrasinal'],
['Centro de ayuda ↗','Centre d’ajuda ↗','Laguntza-zentroa ↗','Centro de axuda ↗'],
['Política de privacidad ↗','Política de privacitat ↗','Pribatutasun-politika ↗','Política de privacidade ↗'],
['Descargar mis datos','Baixar les meves dades','Deskargatu nire datuak','Descargar os meus datos'],
['Eliminar mi cuenta','Eliminar el meu compte','Ezabatu nire kontua','Eliminar a miña conta'],
['Equipo','Equip','Taldea','Equipo'],
['Mi equipo','El meu equip','Nire taldea','O meu equipo'],
['Invitar empleado','Convidar empleat','Langilea gonbidatu','Convidar empregado'],
['Empleado','Empleat','Langilea','Empregado'],
['Propietario','Propietari','Jabea','Propietario'],
['Rol','Rol','Rola','Rol'],
['ELIGE CÓMO EMPEZAR','TRIA COM COMENÇAR','AUKERATU NOLA HASI','ESCOLLE COMO COMEÇAR'],
['Tu taller,','El teu taller,','Zure tailerra,','O teu obradoiro,'],
['tu','el teu','zure','o teu'],
['espacio.','espai.','gunea.','espazo.'],
['Prueba RIMMA 5 días gratis sin tarjeta o activa tu suscripción ahora con cobro inmediato.','Prova RIMMA 5 dies gratis sense targeta o activa ara la subscripció amb cobrament immediat.','Probatu RIMMA 5 egun doan txartelik gabe, edo aktibatu harpidetza orain berehalako kobrantzarekin.','Proba RIMMA 5 días gratis sen tarxeta ou activa agora a subscrición con cobro inmediato.'],
['VERIFICA TU CORREO','VERIFICA EL TEU CORREU','EGIAZTATU ZURE POSTA','VERIFICA O TEU CORREO'],
['Bienvenido','Benvingut','Ongi etorri','Benvido'],
['a RIMMA.','a RIMMA.','RIMMAra.','a RIMMA.'],
['Nombre y apellidos','Nom i cognoms','Izen-abizenak','Nome e apelidos'],
['Nombre del taller','Nom del taller','Tailerraren izena','Nome do obradoiro'],
['Contraseña (8 caracteres como mínimo)','Contrasenya (mínim 8 caràcters)','Pasahitza (gutxienez 8 karaktere)','Contrasinal (8 caracteres como mínimo)'],
['Repetir contraseña','Repetir contrasenya','Errepikatu pasahitza','Repetir contrasinal'],
['País','País','Herrialdea','País'],
['¿Cómo quieres empezar?','Com vols començar?','Nola hasi nahi duzu?','Como queres comezar?'],
['Probar 5 días gratis','Provar 5 dies gratis','Probatu 5 egun doan','Probar 5 días gratis'],
['Acceso completo durante 5 días. Sin tarjeta y sin cobro automático.','Accés complet durant 5 dies. Sense targeta i sense cobrament automàtic.','Sarbide osoa 5 egunez. Txartelik eta kobrantza automatikorik gabe.','Acceso completo durante 5 días. Sen tarxeta e sen cobro automático.'],
['Suscribirme ahora','Subscriure’m ara','Harpidetu orain','Subscribirme agora'],
['Enviarme un código por correo','Enviar-me un codi per correu','Bidali kode bat postaz','Enviarme un código por correo'],
['Código de seis cifras','Codi de sis xifres','Sei digituko kodea','Código de seis cifras'],
['Correo verificado','Correu verificat','Posta egiaztatuta','Correo verificado'],
['Antes de continuar','Abans de continuar','Jarraitu aurretik','Antes de continuar'],
['Crear mi taller · 5 días gratis','Crear el meu taller · 5 dies gratis','Sortu nire tailerra · 5 egun doan','Crear o meu obradoiro · 5 días gratis'],
['Crear mi taller y suscribirme ahora','Crear el meu taller i subscriure’m ara','Sortu nire tailerra eta harpidetu orain','Crear o meu obradoiro e subscribirme agora'],
['← Volver al inicio de sesión','← Tornar a l’inici de sessió','← Itzuli saio-hasierara','← Volver ao inicio de sesión'],
['Las contraseñas no coinciden.','Les contrasenyes no coincideixen.','Pasahitzak ez datoz bat.','Os contrasinais non coinciden.'],
['Código enviado. Revisa tu correo y, si es necesario, la carpeta de spam.','Codi enviat. Revisa el correu i, si cal, la carpeta de correu brossa.','Kodea bidalita. Begiratu zure posta eta, beharrezkoa bada, spam karpeta.','Código enviado. Revisa o correo e, se é necesario, a carpeta de spam.'],
['Verificando código…','Verificant el codi…','Kodea egiaztatzen…','Verificando o código…'],
['Correo verificado. Ya puedes crear tu taller.','Correu verificat. Ja pots crear el teu taller.','Posta egiaztatuta. Orain zure tailerra sor dezakezu.','Correo verificado. Xa podes crear o teu obradoiro.'],
['Código incorrecto. Compruébalo e inténtalo de nuevo.','Codi incorrecte. Comprova’l i torna-ho a provar.','Kode okerra. Egiaztatu eta saiatu berriro.','Código incorrecto. Compróbao e inténtao de novo.'],
['Primero verifica este correo electrónico.','Primer verifica aquest correu electrònic.','Lehenik egiaztatu helbide elektroniko hau.','Primeiro verifica este correo electrónico.'],
['¡Cuenta creada! Estamos abriendo tu taller…','Compte creat! Estem obrint el teu taller…','Kontua sortuta! Zure tailerra irekitzen ari gara…','Conta creada! Estamos abrindo o teu obradoiro…'],
['Cuenta creada correctamente. Ya puedes iniciar sesión desde la página de acceso.','Compte creat correctament. Ja pots iniciar sessió des de la pàgina d’accés.','Kontua behar bezala sortu da. Sarbide-orritik saioa has dezakezu.','Conta creada correctamente. Xa podes iniciar sesión desde a páxina de acceso.'],
['Error de conexión. Inténtalo de nuevo.','Error de connexió. Torna-ho a provar.','Konexio-errorea. Saiatu berriro.','Erro de conexión. Inténtao de novo.'],
['No se ha podido completar la solicitud.','No s’ha pogut completar la sol·licitud.','Ezin izan da eskaera osatu.','Non se puido completar a solicitude.'],
['Selecciona un país válido.','Selecciona un país vàlid.','Hautatu baliozko herrialde bat.','Selecciona un país válido.'],
['Datos del taller y facturación','Dades del taller i facturació','Tailerraren datuak eta fakturazioa','Datos do obradoiro e facturación'],
['Datos fiscales, documentos, impuestos y facturación de tu taller.','Dades fiscals, documents, impostos i facturació del teu taller.','Zure tailerraren zerga-datuak, dokumentuak, zergak eta fakturazioa.','Datos fiscais, documentos, impostos e facturación do teu obradoiro.'],
['Completa la información del negocio y selecciona el territorio fiscal que te corresponde.','Completa la informació del negoci i selecciona el territori fiscal que et correspon.','Osatu negozioaren informazioa eta hautatu dagokizun zerga-lurraldea.','Completa a información do negocio e selecciona o territorio fiscal que che corresponde.'],
['Configurar datos','Configurar dades','Datuak konfiguratu','Configurar datos'],
['Datos fiscales del taller','Dades fiscals del taller','Tailerraren zerga-datuak','Datos fiscais do obradoiro'],
['Identificación del negocio que aparecerá en documentos y facturas.','Identificació del negoci que apareixerà als documents i factures.','Dokumentu eta fakturetan agertuko den negozioaren identifikazioa.','Identificación do negocio que aparecerá nos documentos e facturas.'],
['Nombre / razón social *','Nom / raó social *','Izena / sozietate-izena *','Nome / razón social *'],
['Nombre comercial','Nom comercial','Izen komertziala','Nome comercial'],
['NIF *','NIF *','NIF *','NIF *'],
['Dirección fiscal *','Adreça fiscal *','Helbide fiskala *','Enderezo fiscal *'],
['País *','País *','Herrialdea *','País *'],
['España','Espanya','Espainia','España'],
['Documentos comerciales','Documents comercials','Merkataritza-dokumentuak','Documentos comerciais'],
['Idioma y reglas para presupuestos, resguardos y recibos.','Idioma i regles per a pressupostos, resguards i rebuts.','Aurrekontu, gordailu-agiri eta ordainagirietarako hizkuntza eta arauak.','Idioma e regras para orzamentos, resgardos e recibos.'],
['Normativa de consumo','Normativa de consum','Kontsumo-araudia','Normativa de consumo'],
['Validez del presupuesto (días)','Validesa del pressupost (dies)','Aurrekontuaren balio-epea (egunak)','Validez do orzamento (días)'],
['Facturación e impuestos','Facturació i impostos','Fakturazioa eta zergak','Facturación e impostos'],
['Selecciona primero el territorio fiscal real de tu actividad.','Selecciona primer el territori fiscal real de la teva activitat.','Hautatu lehenik zure jarduerari dagokion benetako zerga-lurraldea.','Selecciona primeiro o territorio fiscal real da túa actividade.'],
['Territorio fiscal *','Territori fiscal *','Zerga-lurraldea *','Territorio fiscal *'],
['Territorio común · IVA / AEAT','Territori comú · IVA / AEAT','Lurralde erkidea · BEZ / AEAT','Territorio común · IVE / AEAT'],
['Canarias · IGIC','Canàries · IGIC','Kanariak · IGIC','Canarias · IGIC'],
['Ceuta · IPSI','Ceuta · IPSI','Ceuta · IPSI','Ceuta · IPSI'],
['Melilla · IPSI','Melilla · IPSI','Melilla · IPSI','Melilla · IPSI'],
['País Vasco · normativa foral / TicketBAI','País Basc · normativa foral / TicketBAI','Euskadi · foru-araudia / TicketBAI','País Vasco · normativa foral / TicketBAI'],
['Navarra · normativa foral','Navarra · normativa foral','Nafarroa · foru-araudia','Navarra · normativa foral'],
['IVA predeterminado','IVA predeterminat','BEZ lehenetsia','IVE predeterminado'],
['Serie factura ordinaria','Sèrie factura ordinària','Faktura arruntaren seriea','Serie factura ordinaria'],
['Serie factura simplificada','Sèrie factura simplificada','Faktura sinplifikatuaren seriea','Serie factura simplificada'],
['Serie rectificativa','Sèrie rectificativa','Faktura zuzentzailearen seriea','Serie rectificativa'],
['Series protegidas','Sèries protegides','Serie babestuak','Series protexidas'],
['Emisión fiscal protegida','Emissió fiscal protegida','Faktura fiskalaren jaulkipena babestuta','Emisión fiscal protexida'],
['Qué puedes seguir usando','Què pots continuar utilitzant','Erabiltzen jarrai dezakezuna','Que podes seguir usando'],
['Facturas ya registradas','Factures ja registrades','Dagoeneko erregistratutako fakturak','Facturas xa rexistradas'],
['Facturación fiscal','Facturació fiscal','Fakturazio fiskala','Facturación fiscal'],
['Guardar cambios','Desar canvis','Aldaketak gorde','Gardar cambios'],
['Cancelar','Cancel·lar','Utzi','Cancelar'],
];

const family=locale==='eu-ES'?'eu':locale==='gl-ES'?'gl':'ca';
const index=family==='ca'?1:family==='eu'?2:3;
const dict=new Map(rows.map(row=>[row[0],row[index]]));
if(locale==='ca-ES-valencia'){
 const valencian=new Map([
  ['HOY EN TU TALLER','HUI AL TEU TALLER'],
  ['Hoy','Hui'],
  ['HOY','HUI'],
  ['Prendas con entrega hoy','Peces amb entrega hui'],
  ['Entrega hoy','Entrega hui'],
  ['Esta semana:','Esta setmana:'],
  ['Este mes','Este mes'],
  ['Esta semana','Esta setmana'],
  ['Este año','Este any'],
  ['Sin ubicación','Sense ubicació'],
  ['Entrega','Entrega'],
  ['Fecha de entrega','Data d’entrega'],
  ['Ver prendas','Vore peces'],
  ['Ver todas','Vore totes']
 ]);
 for(const [k,v] of valencian)dict.set(k,v);
}

const patterns={
 ca:[
  [/^Pedido #(\d+) · (.+)$/,'Comanda #$1 · $2'],
  [/^Pedido #(\d+)$/,'Comanda #$1'],
  [/^Entrega (.+)$/,'Lliurament $1']
 ],
 eu:[
  [/^Pedido #(\d+) · (.+)$/,'Eskaera #$1 · $2'],
  [/^Pedido #(\d+)$/,'Eskaera #$1'],
  [/^Entrega (.+)$/,'Entrega $1']
 ],
 gl:[
  [/^Pedido #(\d+) · (.+)$/,'Pedido #$1 · $2'],
  [/^Pedido #(\d+)$/,'Pedido #$1'],
  [/^Entrega (.+)$/,'Entrega $1']
 ]
};

const translate=value=>{
 if(typeof value!=='string'||!value)return value;
 const key=value.trim();
 if(!key)return value;
 let next=dict.get(key)||key;
 if(next===key){
  for(const [pattern,replacement] of patterns[family]){
   if(pattern.test(key)){next=key.replace(pattern,replacement);break;}
  }
 }
 if(next===key)return value;
 const start=value.match(/^\s*/)?.[0]||'';
 const end=value.match(/\s*$/)?.[0]||'';
 return start+next+end;
};
const formatLocale=locale==='ca-ES-valencia'?'ca-ES':locale;
const money=(minor,currency='EUR')=>{
 try{return new Intl.NumberFormat(formatLocale,{style:'currency',currency}).format(Number(minor||0)/100);}
 catch{return String(Number(minor||0)/100)+' '+currency;}
};
const number=value=>Number.isFinite(Number(value))?Number(value).toLocaleString(formatLocale):'—';
const date=value=>value?new Date(String(value).slice(0,10)+'T12:00:00')
 .toLocaleDateString(formatLocale,{day:'2-digit',month:'short',year:'numeric'}):translate('Sin fecha');

window.RimmaLocale=Object.freeze({...base,locale,country:'ES',isPt:false,isIntl:true,currency:'EUR',
 translate,t:(es)=>translate(es),money,number,date});

const translateElement=element=>{
 if(!(element instanceof Element))return;
 for(const attr of ['placeholder','aria-label','title']){
  if(element.hasAttribute(attr))element.setAttribute(attr,translate(element.getAttribute(attr)));
 }
 if(element.matches('a[href^="/app/"]')&&base.withLocale){
  element.setAttribute('href',base.withLocale(element.getAttribute('href')));
 }
};
const apply=root=>{
 if(root.nodeType===Node.TEXT_NODE){
  const parent=root.parentElement;
  if(parent&&!['SCRIPT','STYLE','TEXTAREA'].includes(parent.tagName)){
   const next=translate(root.nodeValue);
   if(next!==root.nodeValue)root.nodeValue=next;
  }
  return;
 }
 if(root instanceof Element)translateElement(root);
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
 let node;
 while((node=walker.nextNode())){
  const parent=node.parentElement;
  if(parent&&!['SCRIPT','STYLE','TEXTAREA'].includes(parent.tagName)){
   const next=translate(node.nodeValue);
   if(next!==node.nodeValue)node.nodeValue=next;
  }
 }
 root.querySelectorAll?.('*').forEach(translateElement);
};
const start=()=>{
 document.title=translate(document.title);
 apply(document.documentElement);
 const observer=new MutationObserver(records=>{
  for(const record of records){
   if(record.type==='characterData')apply(record.target);
   else record.addedNodes.forEach(apply);
  }
 });
 observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true});
};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();