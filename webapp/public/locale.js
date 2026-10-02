(() => {
  'use strict';
  const LOCALE_KEY='rimma_locale_v1';
  const COUNTRY_KEY='rimma_country_v1';
  const params=new URLSearchParams(location.search);
  const paramLocale=(params.get('locale')||'').trim();
  const paramCountry=(params.get('country')||'').trim().toUpperCase();
  let storedLocale='',storedCountry='';
  try{storedLocale=localStorage.getItem(LOCALE_KEY)||'';storedCountry=localStorage.getItem(COUNTRY_KEY)||'';}catch{}
  const browserLocale=(navigator.languages?.[0]||navigator.language||'').toLowerCase();
  const explicit=Boolean(paramLocale||paramCountry);
  const isPt=explicit
    ? (paramLocale.toLowerCase()==='pt-br'||paramCountry==='BR')
    : (storedLocale.toLowerCase()==='pt-br'||storedCountry==='BR'||
       (!storedLocale&&!storedCountry&&browserLocale==='pt-br'));
  const locale=isPt?'pt-BR':'es-ES';
  const country=isPt?'BR':(paramCountry||storedCountry||'ES');
  if(paramLocale||paramCountry){try{localStorage.setItem(LOCALE_KEY,locale);localStorage.setItem(COUNTRY_KEY,country);}catch{}}
  document.documentElement.lang=isPt?'pt-BR':'es';
  const t=(es,pt)=>isPt?pt:es;
  const money=(minor,currency='EUR')=>{
    try{return new Intl.NumberFormat(locale,{style:'currency',currency}).format(Number(minor||0)/100);}
    catch{return String(Number(minor||0)/100)+' '+currency;}
  };
  const number=value=>Number.isFinite(Number(value))?Number(value).toLocaleString(locale):'—';
  const date=value=>value?new Date(String(value).slice(0,10)+'T12:00:00')
    .toLocaleDateString(locale,{day:'2-digit',month:'short',year:'numeric'}):t('Sin fecha','Sem data');
  const pairs=new Map([
    ['Mi taller — RIMMA','Meu ateliê — RIMMA'],
    ['Crea tu taller — RIMMA','Crie seu ateliê — RIMMA'],
    ['Ir al contenido','Ir para o conteúdo'],
    ['TU TALLER, A TU RITMO','SEU ATELIÊ, NO SEU RITMO'],
    ['Un lugar\npara crear\ncon calma.','Um lugar\npara criar\ncom tranquilidade.'],
    ['Las prendas, los clientes y las cuentas de tu taller, en orden desde cualquier pantalla.','Peças, clientes e contas do seu ateliê organizados em qualquer tela.'],
    ['COSTURA Y ARREGLOS','COSTURA E AJUSTES'],
    ['ACCEDE A TU ESPACIO','ACESSE SEU ESPAÇO'],
    ['Qué bueno\ntenerte aquí.','Que bom\nter você aqui.'],
    ['Inicia sesión con la misma cuenta que utilizas en la aplicación Android.','Entre com a mesma conta que você usa no aplicativo Android.'],
    ['Correo electrónico','E-mail'],
    ['Sitio web','Site'],
    ['Contraseña','Senha'],
    ['Tu contraseña','Sua senha'],
    ['Entrar a mi taller','Entrar no meu ateliê'],
    ['¿Aún no tienes cuenta?','Ainda não tem uma conta?'],
    ['Empieza 5 días gratis','Comece com 5 dias grátis'],
    ['¿Necesitas ayuda?','Precisa de ajuda?'],
    ['Escribe a soporte','Fale com o suporte'],
    ['Privacidad','Privacidade'],
    ['Términos','Termos'],
    ['Abriendo tu taller…','Abrindo seu ateliê…'],
    ['MI ESPACIO DE TRABAJO','MEU ESPAÇO DE TRABALHO'],
    ['Mi taller','Meu ateliê'],
    ['TU TALLER','SEU ATELIÊ'],
    ['Inicio','Início'],
    ['Pedidos','Pedidos'],
    ['Clientes','Clientes'],
    ['Servicios','Serviços'],
    ['Informes','Relatórios'],
    ['TU CUENTA','SUA CONTA'],
    ['Cuenta y suscripción','Conta e assinatura'],
    ['Suscripción','Assinatura'],
    ['Configuración','Configurações'],
    ['Guía rápida','Guia rápido'],
    ['Ayuda','Ajuda'],
    ['Cerrar sesión','Sair'],
    ['MI TALLER','MEU ATELIÊ'],
    ['Tu espacio privado','Seu espaço privado'],
    ['HOY EN TU TALLER','HOJE NO SEU ATELIÊ'],
    ['Tu taller,\nal día.','Seu ateliê,\nem dia.'],
    ['Un lugar para cuidar cada detalle y no perder de vista la siguiente entrega.','Um lugar para cuidar de cada detalhe e acompanhar a próxima entrega.'],
    ['+ Nuevo pedido','+ Novo pedido'],
    ['PRENDAS PARA HOY','PEÇAS PARA HOJE'],
    ['El ritmo de tu taller','O ritmo do seu ateliê'],
    ['LISTOS PARA RECOGER','PRONTOS PARA RETIRADA'],
    ['Encargos que ya esperan','Pedidos que já estão prontos'],
    ['PRÓXIMOS 7 DÍAS','PRÓXIMOS 7 DIAS'],
    ['Prendas programadas','Peças programadas'],
    ['Pedidos recientes','Pedidos recentes'],
    ['Ver todos','Ver todos'],
    ['Cargando pedidos…','Carregando pedidos…'],
    ['SEGUIMIENTO DE ENCARGOS','ACOMPANHAMENTO DE PEDIDOS'],
    ['Cada prenda, en su momento.','Cada peça, no seu momento.'],
    ['Buscar pedidos','Buscar pedidos'],
    ['Buscar pedido o cliente','Buscar pedido ou cliente'],
    ['Filtrar estado','Filtrar status'],
    ['Todos los estados','Todos os status'],
    ['Recibidos','Recebidos'],
    ['En proceso','Em andamento'],
    ['Listos','Prontos'],
    ['Entregados','Entregues'],
    ['← Anterior','← Anterior'],
    ['Siguiente →','Próxima →'],
    ['LAS PERSONAS DETRÁS DE CADA PRENDA','AS PESSOAS POR TRÁS DE CADA PEÇA'],
    ['El detalle que hace volver.','O cuidado que faz o cliente voltar.'],
    ['+ Nuevo cliente','+ Novo cliente'],
    ['Buscar clientes','Buscar clientes'],
    ['Buscar nombre, teléfono o correo','Buscar nome, telefone ou e-mail'],
    ['EL OFICIO, BIEN ORGANIZADO','SEU OFÍCIO, BEM ORGANIZADO'],
    ['Organiza categorías, precios y trabajos de tu taller.','Organize categorias, preços e serviços do seu ateliê.'],
    ['+ Categoría','+ Categoria'],
    ['+ Servicio','+ Serviço'],
    ['UNA VISIÓN MÁS CLARA','UMA VISÃO MAIS CLARA'],
    ['Una mirada a los resultados de tu taller.','Uma visão dos resultados do seu ateliê.'],
    ['Periodo del informe','Período do relatório'],
    ['Este mes','Este mês'],
    ['Esta semana','Esta semana'],
    ['Hoy','Hoje'],
    ['Este año','Este ano'],
    ['Selecciona un periodo.','Selecione um período.'],
    ['TU PLAN RIMMA','SEU PLANO RIMMA'],
    ['Elige 5 días gratis o activa la suscripción de pago cuando quieras.','Use 5 dias grátis ou ative a assinatura paga quando quiser.'],
    ['Cargando suscripción…','Carregando assinatura…'],
    ['Puedes suscribirte desde la web con cobro inmediato o gestionar una compra realizada en Android. El estado siempre se verifica en el servidor de RIMMA.','Você pode assinar pela web com cobrança imediata ou gerenciar uma compra feita no Android. O status é sempre verificado no servidor da RIMMA.'],
    ['TU ESPACIO PERSONAL','SEU ESPAÇO PESSOAL'],
    ['Mi cuenta','Minha conta'],
    ['Los datos que te acompañan, en tu taller y en el móvil.','Seus dados com você, no ateliê e no celular.'],
    ['Datos de la cuenta','Dados da conta'],
    ['Cambiar contraseña','Alterar senha'],
    ['Ayuda y privacidad','Ajuda e privacidade'],
    ['Centro de ayuda ↗','Central de ajuda ↗'],
    ['Política de privacidad ↗','Política de privacidade ↗'],
    ['Solicitar eliminación de cuenta ↗','Solicitar exclusão da conta ↗'],
    ['Descargar mis datos','Baixar meus dados'],
    ['Descargar archivo ZIP ↗','Baixar arquivo ZIP ↗'],
    ['Eliminar mi cuenta','Excluir minha conta'],
    ['Nuevo registro','Novo cadastro'],
    ['Cerrar','Fechar'],
    ['Cancelar','Cancelar'],
    ['Guardar','Salvar'],
    ['ELIGE CÓMO EMPEZAR','ESCOLHA COMO COMEÇAR'],
    ['Tu taller,\ntu espacio.','Seu ateliê,\nseu espaço.'],
    ['Prueba RIMMA 5 días gratis sin tarjeta o activa tu suscripción ahora con cobro inmediato.','Teste a RIMMA por 5 dias grátis sem cartão ou ative sua assinatura agora com cobrança imediata.'],
    ['VERIFICA TU CORREO','VERIFIQUE SEU E-MAIL'],
    ['Bienvenido\na RIMMA.','Bem-vindo\nà RIMMA.'],
    ['Nombre y apellidos','Nome completo'],
    ['Nombre del taller','Nome do ateliê'],
    ['Contraseña (8 caracteres como mínimo)','Senha (mínimo de 8 caracteres)'],
    ['Repetir contraseña','Repetir senha'],
    ['País','País'],
    ['¿Cómo quieres empezar?','Como você quer começar?'],
    ['Probar 5 días gratis','Testar 5 dias grátis'],
    ['Acceso completo durante 5 días. Sin tarjeta y sin cobro automático.','Acesso completo por 5 dias. Sem cartão e sem cobrança automática.'],
    ['Suscribirme ahora','Assinar agora'],
    ['Cobro inmediato. Plan mensual; verás el precio final antes de confirmar el pago.','Cobrança imediata. Plano mensal; você verá o preço final antes de confirmar o pagamento.'],
    ['Enviarme un código por correo','Enviar um código por e-mail'],
    ['Código de seis cifras','Código de seis dígitos'],
    ['Correo verificado','E-mail verificado'],
    ['Antes de continuar','Antes de continuar'],
    ['Lee las condiciones que regulan el uso de RIMMA y cómo tratamos tus datos.','Leia as condições de uso da RIMMA e como tratamos seus dados.'],
    ['Leer Términos de uso →','Ler Termos de uso →'],
    ['Leer Política de privacidad →','Ler Política de privacidade →'],
    ['Ver Aviso legal →','Ver Aviso legal →'],
    ['He leído y acepto los Términos de uso y confirmo que he leído la Política de privacidad.','Li e aceito os Termos de uso e confirmo que li a Política de privacidade.'],
    ['Crear mi taller · 5 días gratis','Criar meu ateliê · 5 dias grátis'],
    ['Crear mi taller y suscribirme ahora','Criar meu ateliê e assinar agora'],
    ['← Volver al inicio de sesión','← Voltar ao login'],
    ['Volver al inicio de sesión','Voltar ao login'],
    ['Las contraseñas no coinciden.','As senhas não coincidem.'],
    ['El registro web aún no está disponible. Solicita una invitación a soporte@rimmaapp.com.','O cadastro web ainda não está disponível. Solicite um convite em suporte@rimmaapp.com.'],
    ['Error de conexión. Inténtalo de nuevo.','Erro de conexão. Tente novamente.'],
    ['Código enviado. Revisa tu correo y, si es necesario, la carpeta de spam.','Código enviado. Verifique seu e-mail e, se necessário, a pasta de spam.'],
    ['Verificando código…','Verificando código…'],
    ['Correo verificado. Ya puedes crear tu taller.','E-mail verificado. Agora você pode criar seu ateliê.'],
    ['Código incorrecto. Compruébalo e inténtalo de nuevo.','Código incorreto. Confira e tente novamente.'],
    ['Primero verifica este correo electrónico.','Primeiro verifique este e-mail.'],
    ['Selecciona un país válido.','Selecione um país válido.'],
    ['¡Cuenta creada! Estamos abriendo tu taller…','Conta criada! Estamos abrindo seu ateliê…'],
    ['Cuenta creada correctamente. Ya puedes iniciar sesión desde la página de acceso.','Conta criada com sucesso. Agora você pode entrar pela página de login.'],
    ['Accediendo…','Entrando…'],
    ['No se pudo completar la solicitud.','Não foi possível concluir a solicitação.'],
    ['Tu periodo de prueba ha terminado. Suscríbete para continuar trabajando con tu taller.','Seu período de teste terminou. Assine para continuar trabalhando com seu ateliê.'],
    ['Tu prueba ha terminado. Suscríbete para continuar.','Seu teste terminou. Assine para continuar.'],
    ['Recibido','Recebido'],
    ['En proceso','Em andamento'],
    ['Listo','Pronto'],
    ['Entregado','Entregue'],
    ['Cancelado','Cancelado'],
    ['Sin estado','Sem status'],
    ['Sin fecha','Sem data'],
    ['Cliente','Cliente'],
    ['Trabajo','Serviço'],
    ['Entrega','Entrega'],
    ['Estado','Status'],
    ['Importe','Valor'],
    ['Acciones','Ações'],
    ['Nombre','Nome'],
    ['Teléfono','Telefone'],
    ['Correo','E-mail'],
    ['No hay encargos con esos filtros.','Não há pedidos com esses filtros.'],
    ['No hay clientes con esos filtros.','Não há clientes com esses filtros.'],
    ['No se pudieron consultar los pedidos.','Não foi possível consultar os pedidos.'],
    ['No se pudieron consultar los clientes.','Não foi possível consultar os clientes.'],
    ['Cargando clientes…','Carregando clientes…'],
    ['Cargando catálogo…','Carregando catálogo…'],
    ['No se pudo cargar el catálogo.','Não foi possível carregar o catálogo.'],
    ['Cargando datos reales…','Carregando dados reais…'],
    ['El informe no está disponible.','O relatório não está disponível.'],
    ['Cargando cuenta…','Carregando conta…'],
    ['No indicado','Não informado'],
    ['Taller','Ateliê'],
    ['Rol','Função'],
    ['Propietario','Proprietário'],
    ['Miembro','Membro'],
    ['La información de tu cuenta no está disponible.','As informações da sua conta não estão disponíveis.'],
    ['TUS CLIENTES','SEUS CLIENTES'],
    ['Nuevo cliente','Novo cliente'],
    ['Nombre y apellidos *','Nome completo *'],
    ['Notas','Observações'],
    ['TUS ENCARGOS','SEUS PEDIDOS'],
    ['Nuevo pedido','Novo pedido'],
    ['Consultando clientes y servicios…','Consultando clientes e serviços…'],
    ['Cliente *','Cliente *'],
    ['Selecciona un cliente','Selecione um cliente'],
    ['Añade primero un cliente en la sección Clientes.','Primeiro adicione um cliente na seção Clientes.'],
    ['Servicio','Serviço'],
    ['Trabajo manual','Serviço manual'],
    ['Trabajo *','Serviço *'],
    ['Precio *','Preço *'],
    ['Moneda *','Moeda *'],
    ['Fecha de entrega','Data de entrega'],
    ['Fotografía de la prenda','Foto da peça'],
    ['Opcional. JPEG, PNG o WebP, hasta 150 KB. Se asociará a la primera prenda al crear el pedido.','Opcional. JPEG, PNG ou WebP, até 150 KB. Será associada à primeira peça ao criar o pedido.'],
    ['+ Añadir otra prenda','+ Adicionar outra peça'],
    ['Editar cliente','Editar cliente'],
    ['Cargando cliente…','Carregando cliente…'],
    ['Editar pedido','Editar pedido'],
    ['Cargando pedido…','Carregando pedido…'],
    ['Seguimiento pendiente','Acompanhamento pendente'],
    ['No','Não'],
    ['Sí','Sim'],
    ['Estado de las prendas','Status das peças'],
    ['Cambiar estado','Alterar status'],
    ['Entregada','Entregue'],
    ['Fotografías','Fotos'],
    ['ESTADO DEL ENCARGO','STATUS DO PEDIDO'],
    ['Cargando prenda…','Carregando peça…'],
    ['Nuevo estado','Novo status'],
    ['Pedido creado correctamente.','Pedido criado com sucesso.'],
    ['Pedido y fotografías guardados correctamente.','Pedido e fotos salvos com sucesso.'],
    ['Cliente actualizado correctamente.','Cliente atualizado com sucesso.'],
    ['Pedido actualizado correctamente.','Pedido atualizado com sucesso.'],
    ['Estado actualizado correctamente.','Status atualizado com sucesso.'],
    ['Otra prenda','Outra peça'],
    ['Cantidad','Quantidade'],
    ['Fotografía','Foto'],
    ['Quitar','Remover'],
    ['Eliminar','Excluir'],
    ['Descargar','Baixar'],
    ['Pedido descargado.','Pedido baixado.'],
    ['Periodo de prueba','Período de teste'],
    ['Acceso no activo','Acesso inativo'],
    ['Tu periodo de prueba termina hoy.','Seu período de teste termina hoje.'],
    ['Queda aproximadamente 1 día de prueba.','Resta aproximadamente 1 dia de teste.'],
    ['Suscripción mensual activa.','Assinatura mensal ativa.'],
    ['Acceso pagado vigente; la renovación no está activada.','Acesso pago vigente; a renovação não está ativada.'],
    ['Tu prueba gratuita ha terminado. Tu cuenta y los datos de tu taller se conservan.','Seu teste gratuito terminou. Sua conta e os dados do ateliê continuam salvos.'],
    ['Finaliza la prueba','Fim do teste'],
    ['Acceso pagado hasta','Acesso pago até'],
    ['Acceso','Acesso'],
    ['Consulta el estado con soporte','Consulte o status com o suporte'],
    ['Fecha no disponible','Data indisponível'],
    ['Suscripción necesaria para continuar','Assinatura necessária para continuar'],
    ['Suscribirme ahora · pago inmediato ↗','Assinar agora · pagamento imediato ↗'],
    ['Prueba gratuita','Teste gratuito'],
    ['Activa','Ativa'],
    ['Sin acceso','Sem acesso'],
    ['Renovación','Renovação'],
    ['Automática','Automática'],
    ['No activada','Não ativada'],
    ['Actualizar estado','Atualizar status'],
    ['Gestionar en Google Play ↗','Gerenciar no Google Play ↗'],
    ['Verificar compra','Verificar compra'],
    ['Estado actualizado.','Status atualizado.'],
    ['La verificación está temporalmente indisponible. Tu acceso actual no ha cambiado; inténtalo más tarde.','A verificação está temporariamente indisponível. Seu acesso atual não mudou; tente novamente mais tarde.'],
    ['Solo el propietario del taller puede contratar o verificar una suscripción. Pide ayuda al propietario.','Somente o proprietário do ateliê pode contratar ou verificar uma assinatura. Peça ajuda ao proprietário.'],
    ['La compra directa con tarjeta en esta web todavía no está habilitada.','A compra direta com cartão nesta web ainda não está habilitada.'],
    ['La verificación de pagos no está disponible temporalmente. Contacta con soporte antes de realizar una compra.','A verificação de pagamentos está temporariamente indisponível. Fale com o suporte antes de realizar uma compra.'],
    ['Existe una compra de prueba (sandbox). No activa una suscripción real.','Existe uma compra de teste (sandbox). Ela não ativa uma assinatura real.'],
    ['Tu suscripción','Sua assinatura'],
    ['Plan mensual en España: 4,99 €/mes. En la compra web verás el importe final, moneda e impuestos antes de confirmar; en otros países el precio puede ser diferente.','No Brasil, o preço final em reais e os impostos aplicáveis são mostrados antes da confirmação da compra.'],
    ['Cerrar aviso de error','Fechar aviso de erro'],
    ['Cerrar aviso','Fechar aviso'],
    ['Abrir menú','Abrir menu'],
    ['Cerrar menú','Fechar menu'],
    ['Ver pedidos y próximas entregas','Ver pedidos e próximas entregas'],
    ['Ir a configuración de mi cuenta','Ir para as configurações da minha conta'],
    ['Abrir configuración de mi cuenta','Abrir configurações da minha conta'],
    ['Ver la fotografía completa de RIMMA','Ver a foto completa da RIMMA'],
    ['Ampliar imagen de RIMMA','Ampliar imagem da RIMMA'],
    ['Cerrar imagen','Fechar imagem'],
    ['Preparar mi archivo ZIP antes de eliminar','Preparar meu arquivo ZIP antes de excluir'],
    ['Contraseña actual','Senha atual'],
    ['Escribe ELIMINAR para confirmar','Digite ELIMINAR para confirmar'],
    ['Bloquear mi cuenta y solicitar la eliminación','Bloquear minha conta e solicitar a exclusão'],
    ['Verificando y bloqueando la cuenta:','Verificando e bloqueando a conta:'],
    ['Tu acceso se ha bloqueado. La eliminación de los datos activos está pendiente.','Seu acesso foi bloqueado. A exclusão dos dados ativos está pendente.'],
    ['Copiar mi código privado','Copiar meu código privado'],
    ['Consultar estado de eliminación','Consultar status da exclusão'],
    ['Programada','Programada'],
    ['Verificación final','Verificação final'],
    ['Requiere revisión manual','Requer revisão manual'],
    ['Datos activos eliminados','Dados ativos excluídos'],
    ['Estado no disponible','Status indisponível'],
    ['DATOS DEL PERÍODO','DADOS DO PERÍODO'],
    ['PEDIDOS DEL PERÍODO','PEDIDOS DO PERÍODO'],
    ['NUEVOS CLIENTES','NOVOS CLIENTES'],
    ['PERÍODO CONSULTADO','PERÍODO CONSULTADO'],
    ['Importe de los pedidos','Valor dos pedidos'],
    ['Estado de los pedidos','Status dos pedidos'],
    ['Datos del período seleccionado','Dados do período selecionado'],
    ['Período anterior','Período anterior'],
    ['Sin importes registrados en este período.','Sem valores registrados neste período.'],
    ['Todavía no hay pedidos en este período.','Ainda não há pedidos neste período.'],
    ['Fechas según la zona horaria de tu taller.','Datas conforme o fuso horário do seu ateliê.'],
    ['Un lugar','Um lugar'],
    ['para','para'],
    ['crear','criar'],
    ['con calma.','com tranquilidade.'],
    ['Qué bueno','Que bom'],
    ['tenerte aquí.','ter você aqui.'],
    ['Tu taller,','Seu ateliê,'],
    ['al día.','em dia.'],
    ['tu','seu'],
    ['espacio.','espaço.'],
    ['Bienvenido','Bem-vindo'],
    ['a RIMMA.','à RIMMA.'],
    ['RIMMA página principal','Página principal da RIMMA'],
    ['RIMMA — Gestión para talleres de costura','RIMMA — Gestão para ateliês de costura'],
    ['No se pudo leer la fotografía.','Não foi possível ler a foto.'],
    ['Fotografía subida correctamente.','Foto enviada com sucesso.'],
    ['Fotografía archivada.','Foto arquivada.'],
    ['Archivar','Arquivar'],
    ['Confirmar cobro','Confirmar pagamento'],
    ['Cancelar cobro','Cancelar pagamento'],
    ['Confirmar cobro pendiente','Confirmar pagamento pendente'],
    ['Cancelar cobro pendiente','Cancelar pagamento pendente'],
    ['Cobro registrado como pendiente. Confírmalo solo tras recibir el dinero.','Pagamento registrado como pendente. Confirme somente após receber o dinheiro.'],
    ['La suscripción de Google Play se cancela por separado.','A assinatura do Google Play é cancelada separadamente.'],
  ]);
  const canonical=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[.…:]+$/,'').trim();
  const canonicalPairs=new Map([...pairs].map(([key,value])=>[canonical(key),value]));
  const patterns=[
    [/^Quedan aproximadamente (\d+) días de prueba\.$/,(_,n)=>`Restam aproximadamente ${n} dias de teste.`],
    [/^Página (\d+)$/i,(_,n)=>`Página ${n}`],
    [/^No se ha podido completar la comprobación: (.+)$/i,(_,m)=>`Não foi possível concluir a verificação: ${m}`],
    [/^No se ha eliminado: (.+)$/i,(_,m)=>`Não foi excluído: ${m}`],
    [/^No se ha podido eliminar: (.+)$/i,(_,m)=>`Não foi possível excluir: ${m}`],
    [/^No se pudo cargar el cliente: (.+)$/i,(_,m)=>`Não foi possível carregar o cliente: ${m}`],
    [/^No se pudo cargar el pedido: (.+)$/i,(_,m)=>`Não foi possível carregar o pedido: ${m}`],
    [/^Distribución real de los (\d+) pedidos creados en este período\.$/i,(_,n)=>`Distribuição real dos ${n} pedidos criados neste período.`],
    [/^(\d+)% del período$/i,(_,n)=>`${n}% do período`],
    [/^Entiendo que (\d+) colaboradores perderán acceso al taller (.+)\.$/i,(_,n,name)=>`Entendo que ${n} colaboradores perderão o acesso ao ateliê ${name}.`],
    [/^Comprobación completada: /i,'Verificação concluída: '],
    [/^Código copiado\./i,'Código copiado.'],
    [/^Copia el código seleccionado/i,'Copie o código selecionado'],
    [/^Pedido #(.*)$/i,'Pedido #$1'],
  ];
  const translatedLong=new Map([
    ['Para cambiar tus datos o ejercer tus derechos puedes consultar nuestra información de soporte y privacidad.','Para alterar seus dados ou exercer seus direitos, consulte nossas informações de suporte e privacidade.'],
    ['Antes de cerrar tu cuenta puedes guardar tus clientes, pedidos, pagos, medidas y fotografías en un archivo ZIP. Solo el propietario del taller puede descargarlo.','Antes de encerrar sua conta, você pode salvar clientes, pedidos, pagamentos, medidas e fotos em um arquivo ZIP. Somente o proprietário do ateliê pode baixá-lo.'],
    ['La descarga directa tiene un límite de 12 MB. Si tu taller lo supera, solicita una exportación completa a soporte@rimmaapp.com. Guarda el archivo de forma segura: contiene datos personales de tus clientes.','O download direto tem limite de 12 MB. Se o seu ateliê ultrapassar esse limite, solicite uma exportação completa em suporte@rimmaapp.com. Guarde o arquivo com segurança: ele contém dados pessoais dos seus clientes.'],
    ['Primero descarga tu archivo ZIP. RIMMA comprobará automáticamente si tu cuenta puede cerrarse sin revisión manual. Los datos activos del taller se eliminan; cuando existe una compra verificada, se conserva únicamente la evidencia mínima exigible de la transacción de forma separada y pseudonimizada. La suscripción de Google Play se cancela por separado.','Primeiro baixe seu arquivo ZIP. A RIMMA verificará automaticamente se sua conta pode ser encerrada sem revisão manual. Os dados ativos do ateliê são excluídos; quando existe uma compra verificada, somente a evidência mínima exigível da transação é mantida de forma separada e pseudonimizada. A assinatura do Google Play é cancelada separadamente.'],
    ['Consultando disponibilidad…','Consultando disponibilidade…'],
    ['La prueba de RIMMA no genera cobros automáticos. Puedes suscribirte ahora mismo sin esperar a que termine.','O teste da RIMMA não gera cobranças automáticas. Você pode assinar agora sem esperar o término do teste.'],
    ['Tu cuenta permanece guardada. Para volver a clientes, pedidos, servicios e informes, activa una suscripción. No eliminamos tu taller automáticamente al terminar la prueba.','Sua conta continua salva. Para voltar a clientes, pedidos, serviços e relatórios, ative uma assinatura. Não excluímos seu ateliê automaticamente quando o teste termina.'],
    ['Puedes elegir: mantener tus 5 días gratis sin tarjeta o suscribirte ahora. Si eliges la suscripción web, el cobro se realiza inmediatamente al confirmar el pago.','Você pode escolher: manter seus 5 dias grátis sem cartão ou assinar agora. Se escolher a assinatura web, a cobrança é feita imediatamente ao confirmar o pagamento.'],
    ['Valor de los pedidos no cancelados; no equivale al dinero cobrado.','Valor dos pedidos não cancelados; não equivale ao dinheiro recebido.'],
    ['Solo pagos confirmados durante el período; por moneda.','Somente pagamentos confirmados durante o período; por moeda.'],
  ]);
  const translate=(value)=>{
    if(!isPt||typeof value!=='string'||!value)return value;
    const key=value.trim();
    if(!key)return value;
    let next=pairs.get(key)||translatedLong.get(key)||canonicalPairs.get(canonical(key))||key;
    if(next===key){
      for(const [pattern,replacement] of patterns){
        if(pattern.test(key)){next=key.replace(pattern,replacement);break;}
      }
    }
    if(next===key)return value;
    const start=value.match(/^\s*/)?.[0]||'';
    const end=value.match(/\s*$/)?.[0]||'';
    return start+next+end;
  };
  const rewriteHref=(element)=>{
    if(!isPt||!element?.getAttribute)return;
    const href=element.getAttribute('href');
    if(!href)return;
    const publicMap=new Map([
      ['https://rimmaapp.com','https://rimmaapp.com/br/'],
      ['https://rimmaapp.com/','https://rimmaapp.com/br/'],
      ['https://rimmaapp.com/privacy/','https://rimmaapp.com/br/legal/privacy/'],
      ['https://rimmaapp.com/terms/','https://rimmaapp.com/br/legal/terms/'],
      ['https://rimmaapp.com/support/','https://rimmaapp.com/br/legal/support/'],
      ['https://rimmaapp.com/delete-account/','https://rimmaapp.com/br/legal/delete-account/'],
      ['https://rimmaapp.com/legal/privacy/?from=signup','https://rimmaapp.com/br/legal/privacy/?from=signup'],
      ['https://rimmaapp.com/legal/terms/?from=signup','https://rimmaapp.com/br/legal/terms/?from=signup'],
      ['https://rimmaapp.com/legal/aviso-legal/?from=signup','https://rimmaapp.com/br/legal/aviso-legal/?from=signup'],
    ]);
    if(publicMap.has(href)){element.setAttribute('href',publicMap.get(href));return;}
    if(href==='/app/register.html')element.setAttribute('href','/app/register.html?locale=pt-BR&country=BR');
  };
  const translateElement=(element)=>{
    if(!isPt||!(element instanceof Element))return;
    for(const attr of ['placeholder','aria-label','title']){
      if(element.hasAttribute(attr))element.setAttribute(attr,translate(element.getAttribute(attr)));
    }
    rewriteHref(element);
  };
  const translateRoot=(root=document)=>{
    if(!isPt)return;
    if(root.nodeType===Node.TEXT_NODE){
      const parent=root.parentElement;
      if(parent&&!['SCRIPT','STYLE','TEXTAREA'].includes(parent.tagName))root.nodeValue=translate(root.nodeValue);
      return;
    }
    if(root instanceof Element)translateElement(root);
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    let node;
    while((node=walker.nextNode())){
      const parent=node.parentElement;
      if(parent&&!['SCRIPT','STYLE','TEXTAREA'].includes(parent.tagName))node.nodeValue=translate(node.nodeValue);
    }
    if(root.querySelectorAll)root.querySelectorAll('*').forEach(translateElement);
  };
  const startObserver=()=>{
    if(!isPt)return;
    document.title=translate(document.title);
    translateRoot(document.documentElement);
    const observer=new MutationObserver(records=>{
      for(const record of records){
        if(record.type==='characterData')translateRoot(record.target);
        else record.addedNodes.forEach(translateRoot);
      }
    });
    observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true});
  };
  const withLocale=(url)=>{
    if(!isPt)return url;
    try{
      const target=new URL(url,location.origin);
      if(target.origin===location.origin){
        target.searchParams.set('locale','pt-BR');
        target.searchParams.set('country','BR');
        return target.pathname+target.search+target.hash;
      }
    }catch{}
    return url;
  };
  window.RimmaLocale=Object.freeze({
    locale,country,isPt,
    t,translate,money,number,date,withLocale,
    currency:isPt?'BRL':'EUR'
  });
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',startObserver,{once:true});
  else startObserver();
})();// country display names for pt-BR
;(()=>{
  if(!window.RimmaLocale?.isPt)return;
  const names=new Map([
    ['España','Espanha'],['México','México'],['Argentina','Argentina'],['Chile','Chile'],
    ['Colombia','Colômbia'],['Perú','Peru'],['Ecuador','Equador'],['Uruguay','Uruguai'],
    ['Paraguay','Paraguai'],['Bolivia','Bolívia'],['Venezuela','Venezuela'],['Costa Rica','Costa Rica'],
    ['Panamá','Panamá'],['Guatemala','Guatemala'],['Honduras','Honduras'],['Nicaragua','Nicarágua'],
    ['El Salvador','El Salvador'],['República Dominicana','República Dominicana'],['Cuba','Cuba'],
    ['Puerto Rico','Porto Rico'],['Estados Unidos','Estados Unidos'],['Guinea Ecuatorial','Guiné Equatorial']
  ]);
  const observer=new MutationObserver(records=>{
    for(const record of records)for(const node of record.addedNodes){
      if(node.nodeType===Node.ELEMENT_NODE&&node.tagName==='OPTION'){
        const value=node.textContent.trim();if(names.has(value))node.textContent=names.get(value);
      }
    }
  });
  observer.observe(document.documentElement,{subtree:true,childList:true});
})();
// server-side messages surfaced by the web client
;(()=>{
  if(!window.RimmaLocale?.isPt)return;
  const extra=new Map([
    ['Inicia sesion para continuar.','Entre para continuar.'],
    ['Solicitud no autorizada. Actualiza la pagina e intentalo de nuevo.','Solicitação não autorizada. Atualize a página e tente novamente.'],
    ['Pagina no encontrada.','Página não encontrada.'],
    ['Registro no disponible.','Cadastro indisponível.'],
    ['Comprueba los datos del formulario.','Confira os dados do formulário.'],
    ['Usa un correo electrónico permanente para crear tu cuenta.','Use um e-mail permanente para criar sua conta.'],
    ['Demasiados intentos. Inténtalo más tarde.','Muitas tentativas. Tente novamente mais tarde.'],
    ['Esta cuenta ya existe. Inicia sesión.','Esta conta já existe. Entre com sua conta.'],
    ['El servicio no está disponible. Inténtalo más tarde.','O serviço não está disponível. Tente novamente mais tarde.'],
    ['Verifica los datos y vuelve a intentarlo.','Verifique os dados e tente novamente.'],
  ]);
  const original=window.RimmaLocale.translate;
  const enhanced=value=>extra.get(String(value||'').trim())||original(value);
  window.RimmaLocale=Object.freeze({...window.RimmaLocale,translate:enhanced});
})();