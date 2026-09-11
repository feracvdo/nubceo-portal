// lib/autoimp/contenido.js
//
// Todo el texto de la guía vive acá. Para cambiar el contenido no hace falta
// tocar el componente: se edita este archivo y listo.
//
// Campos de cada paso:
//   nav      — nombre corto para la barra lateral
//   kicker   — "Paso N de 7"
//   title    — título de la pantalla
//   lead     — por qué existe el paso y qué se rompe si sale mal
//   videos   — [{ t: título, d: duración }]. Provisorio: el recorte final lo
//              define marketing al grabar. Cuando haya video real se suma `url`.
//   path     — ruta dentro de Nubceo
//   todo     — checklist de lo que hace el cliente
//   verify   — cómo darse cuenta de que salió bien (admite <b>)
//   fork     — solo el paso 4: bifurcación CSV / API
//   _pend    — pendientes internos. NO se renderiza al cliente.

// Versión del autoimplementador. Subila al publicar un cambio:
//   0.1  guía navegable, sin persistencia
//   0.2  acceso por código y guardado de progreso
//   0.3  bitácora, correo en vez de nombre, sesión de 1 hora
//   0.4  habilitación por cliente desde el panel y link para compartir
//   0.4.1 portada con el logo al entrar
export const VERSION = "0.4.1";

export const CLIENTE_DEMO = {
  empresa: "—",
  cuit: "—",
  procesadoras: "—",
  referente: "—",
  alcance: "Conciliador transaccional",
};

export const NIVELES = [
  { k: "facil", l: "Fácil", c: "" },
  { k: "normal", l: "Normal", c: "" },
  { k: "costo", l: "Me costó un poco", c: "warn" },
  { k: "trabe", l: "Me trabé", c: "bad" },
];

export const STEPS = [
  {
    nav: "Tu equipo",
    kicker: "Paso 1 de 7",
    title: "Sumá a las personas que van a configurar con vos",
    lead:
      "Esta configuración casi nunca la hace una sola persona. El archivo de ventas suele estar del lado de sistemas, los números de comercio los tiene quien maneja la relación con las procesadoras, y las liquidaciones las mira administración. Antes de arrancar, invitá a esas personas: cada una entra con su propio usuario y hace la parte que le toca, sin reenviar links ni compartir contraseñas.",
    videos: [{ t: "Invitar a tu equipo y elegir el rol de cada uno", d: "1:50" }],
    path: "Configuración → Usuarios",
    todo: [
      "Identificá quién tiene el archivo de ventas de tu sistema.",
      "Identificá quién tiene acceso a los portales de tus procesadoras.",
      "Invitá a esas personas desde Configuración → Usuarios.",
      "Asignale a cada una el rol que corresponda a lo que va a hacer.",
    ],
    verify:
      "Pedile a cada persona que invitaste que entre y te confirme que puede ver la plataforma. Con eso alcanza por ahora: si alguien no llegó a entrar, revisá que el mail no haya caído en correo no deseado antes de reenviar la invitación.",
    fork: null,
    _pend: [
      "Nombres exactos y alcance real de los roles disponibles en Nubceo.",
      "¿El cliente autoimplementado puede invitar usuarios desde el arranque o CX habilita algo antes?",
    ],
  },
  {
    nav: "Sucursales cabecera",
    kicker: "Paso 2 de 7",
    title: "Dá de alta tus sucursales cabecera",
    lead:
      "Una sucursal cabecera es la ficha de cada uno de tus locales dentro de Nubceo: bajo qué empresa y CUIT factura, y cómo lo llamás vos. Es lo primero que hay que crear, porque todo lo demás se cuelga de acá: en el paso siguiente vas a asociarle los números de comercio, y más adelante cada venta y cada liquidación va a quedar referida a una de estas fichas. Si un local falta acá, sus ventas después no tienen dónde caer.",
    videos: [
      { t: "Dónde se dan de alta las sucursales cabecera", d: "1:30" },
      { t: "Dar de alta una cabecera paso a paso", d: "2:10" },
      { t: "Crear muchas de una vez con la planilla", d: "1:40" },
    ],
    path: "Mi negocio → Sucursales cabecera",
    todo: [
      "Hacé la lista de todos tus locales activos, incluso los que abrieron hace poco.",
      "Al lado de cada uno, anotá bajo qué empresa y CUIT factura.",
      "Definí con qué nombre lo vas a identificar y usá el mismo que usás en tu sistema de ventas.",
      "Si son pocos, dalos de alta uno por uno; si son muchos, usá la carga masiva.",
    ],
    verify:
      "En el listado de sucursales cabecera tenés que ver todos tus locales activos, cada uno con su empresa y CUIT. <b>Contá cuántos son y comparalo con tu lista: el número tiene que dar exacto.</b> Si te falta uno, sus ventas no van a conciliar y el problema recién se ve al final, cuando el resultado da bajo y no se entiende por qué.",
    fork: null,
    _pend: [
      "Confirmar la ruta exacta y los campos del alta individual.",
      "Confirmar las columnas de la planilla de carga masiva de cabeceras.",
      "¿Qué pasa al subir dos veces la misma planilla: duplica, actualiza o rechaza?",
    ],
  },
  {
    nav: "Mapeo de comercios",
    kicker: "Paso 3 de 7",
    title: "Relacioná cada número de comercio con su cabecera",
    lead:
      "Cada procesadora identifica tus locales con su propio número de comercio, que no tiene nada que ver con el nombre que vos les ponés. Este paso es el que le permite a Nubceo saber que el comercio 1099384 de Mercado Pago es tu sucursal de Castelar. Es el paso más importante de toda la configuración y el único donde un error no se ve: si un número queda asociado a la cabecera equivocada, no aparece ningún aviso, las ventas simplemente concilian contra el local equivocado y todos tus reportes quedan mal.",
    videos: [
      { t: "Qué es el número de comercio y dónde encontrarlo", d: "1:35" },
      { t: "Asociarlo a su cabecera desde Nubceo, uno por uno", d: "2:00" },
      { t: "Cargar todo el mapeo de una vez con la planilla de Excel", d: "2:10" },
    ],
    path: "Mi negocio → Sucursales",
    todo: [
      "Pedile a cada procesadora el listado de comercios activos, o descargalo de su portal.",
      "Asociá cada número de comercio a la cabecera que le corresponde.",
      "Si trabajás con varias procesadoras, terminá una antes de pasar a la siguiente.",
      "Anotá aparte los comercios que no puedas asociar a ningún local.",
    ],
    verify:
      "Tomá el listado de comercios que te dio la procesadora y recorrelo línea por línea contra lo que cargaste: tienen que dar la misma cantidad y las mismas asociaciones. Es tedioso y vale la pena, porque es el único chequeo que existe. Dos situaciones que son normales y no hay que forzar: <b>un mismo local puede tener más de un número</b> si tiene varias terminales dadas de alta por separado, y <b>un mismo número puede cubrir dos locales</b> si la procesadora los dio de alta juntos. Si te sobran comercios en el listado de la procesadora, puede haber locales cerrados o terminales que no sabías que estaban activas.",
    fork: null,
    _pend: [
      "Ruta exacta de la pantalla donde se asocia el número de comercio a la cabecera.",
      "Confirmar las columnas de la planilla de mapeo y si es la misma que la de cabeceras.",
      "¿Qué hace el sistema si dos cabeceras comparten un mismo número de comercio?",
    ],
  },
  {
    nav: "Origen de las ventas",
    kicker: "Paso 4 de 7",
    title: "Hacé que tus ventas lleguen a Nubceo",
    lead:
      "Para conciliar, Nubceo necesita tus ventas tal como las registró tu sistema. Hay dos caminos posibles y no dan el mismo trabajo: elegí el tuyo antes de seguir.",
    videos: [
      { t: "Qué período de ventas subir para tu primera prueba", d: "1:20" },
      { t: "Descargar la plantilla y entender cada columna", d: "2:10" },
      { t: "Exportar de tu sistema y armar el archivo", d: "3:05" },
      { t: "Subir el archivo y leer el resultado de la importación", d: "1:50" },
    ],
    path: "Ventas → Importar archivo",
    todo: [
      "Confirmá desde qué fecha tenés liquidaciones en Nubceo y elegí un período posterior.",
      "Descargá la plantilla oficial y exportá de tu sistema las ventas de ese período.",
      "Pasá los datos a la plantilla respetando nombre y orden de las columnas.",
      "Revisá formato de fecha, separador de decimales y ventas con más de un medio de pago.",
      "Subí el archivo desde Ventas → Importar archivo y corregí lo rechazado.",
    ],
    verify:
      "El resumen te dice cuántos registros entraron y cuántos fueron rechazados: <b>apuntá a cero rechazados</b> antes de seguir. Después hacé un segundo chequeo que no es automático: entrá al listado de ventas, filtrá por una sucursal y un día, y contá contra tu sistema. Si el archivo entró completo pero con las columnas corridas, la importación no da error y solo se nota mirando los datos.",
    fork: {
      q: "¿Cómo va a recibir Nubceo tus ventas?",
      csv: {
        b: "Autoservicio",
        t: "Subo un archivo de ventas",
        d: "Exporto las ventas de mi sistema, las paso a la plantilla de Nubceo y subo el archivo. Es el camino más rápido, no necesita desarrollo y lo podés hacer entero con esta guía.",
      },
      api: {
        b: "Requiere desarrollo",
        t: "Mi sistema se integra por API",
        d: "Mi sistema de gestión se conecta directo con Nubceo y las ventas entran solas. Necesita desarrollo y pruebas conjuntas, así que lo trabajamos con un implementador.",
      },
    },
    _pend: [
      "Confirmar que no hay historial de liquidaciones previo a la vinculación (supuesto actual).",
      "Nombre y ubicación exactos de la plantilla oficial de ventas.",
      "A quién llega el pedido de reunión técnica y de cotización, y por qué vía.",
    ],
  },
  {
    nav: "Reglas y secuencias",
    kicker: "Paso 5 de 7",
    title: "Configurá cómo Nubceo cruza la información",
    lead:
      "Una regla define qué campos tienen que coincidir entre tu venta y el pago de la procesadora para considerarlos la misma operación. Una secuencia es un conjunto de reglas que se ejecutan en orden, de la más exigente a la más flexible: lo que no cruzó con la primera lo intenta la segunda, y así. No las armes desde cero — abajo está la cascada que usamos como punto de partida.",
    videos: [
      { t: "Qué es una regla y qué es una secuencia", d: "1:25" },
      { t: "Crear la cascada de reglas recomendada", d: "2:40" },
      { t: "Armar la secuencia y ordenar las reglas", d: "1:20" },
    ],
    path: "Configuración → Reglas y Secuencias",
    todo: [
      "Regla 1, la más exigente: fecha, monto, número de comercio, lote y cupón.",
      "Regla 2: la misma, sin el lote.",
      "Regla 3: la misma, con tolerancia de un día en la fecha.",
      "Regla 4: la misma, con tolerancia de un día y de unos centavos en el monto.",
      "Creá una secuencia y agregá las cuatro reglas en ese orden.",
    ],
    verify:
      "Abrí la secuencia y mirá el orden: tienen que estar de la más exigente a la más flexible. <b>El orden es lo único que importa acá.</b> Si una regla flexible corre primero, va a cruzar operaciones parecidas antes de que la exigente encuentre la correcta, y el resultado va a estar mal sin que nada dé error.",
    fork: null,
    _pend: [
      "Validar la cascada con implementación: son las 4 que más rinden, pero conviene confirmarlas contra los clientes ya productivos.",
      "Definir la tolerancia de monto recomendada (¿centavos fijos o porcentaje?).",
      "Evaluar un PDF descargable con los valores campo por campo para seguir mientras se mira el video.",
    ],
  },
  {
    nav: "Primera conciliación",
    kicker: "Paso 6 de 7",
    title: "Ejecutá tu primera conciliación y leé el resultado",
    lead:
      "Es el momento de la verdad: corré la secuencia sobre tus datos y aprendé a leer lo que sale. Este es el paso que más te va a servir en el día a día, porque interpretar el resultado es lo que vas a hacer todas las semanas.",
    videos: [
      { t: "Ejecutar la secuencia por primera vez", d: "1:15" },
      { t: "Leer el resultado: conciliado, intentado y no conciliado", d: "3:20" },
      { t: "Qué hacer con lo que no conció", d: "2:45" },
    ],
    path: "Conciliación → Ejecutar secuencia",
    todo: [
      "Elegí el período de ventas que cargaste en el paso 4.",
      "Ejecutá la secuencia y esperá a que termine.",
      "Mirá el porcentaje conciliado y el detalle por regla.",
      "Abrí una muestra de lo que no cruzó y buscá qué tienen en común.",
    ],
    verify:
      "Un buen resultado está en <b>90% o más</b>. Si te dio menos, no rehagas la configuración todavía: casi siempre es una de las causas de abajo, y se resuelven de forma distinta.",
    triage: {
      titulo: "Si el resultado te dio bajo, mirá esto en orden",
      items: [
        [
          "Facturás el total pero te pagan cuota a cuota",
          "Si vendés en cuotas y tu sistema registra el total de la venta mientras la procesadora te va pagando una cuota por mes, los montos nunca van a coincidir y el porcentaje se desploma. Es la causa más frecuente de un resultado muy bajo y no se arregla con reglas: escribinos y lo vemos juntos.",
        ],
        [
          "El período no tiene liquidaciones completas",
          "Si subiste ventas de días que la procesadora todavía no liquidó, no hay contra qué cruzarlas. Probá con un período anterior o esperá unos días y volvé a ejecutar.",
        ],
        [
          "Hay códigos de comercio sin mapear o cruzados",
          "Si una sucursal quedó sin código, sus ventas no cruzan nunca. Si un código quedó en la sucursal equivocada, cruzan mal. Volvé al paso 3 y revisá contra el listado de la procesadora.",
        ],
        [
          "Parte de tus ventas no se cobra con tarjeta",
          "Nubceo concilia pagos con medios procesados. El efectivo, las giftcards y los vales no tienen contraparte, así que una venta pagada mitad en efectivo y mitad con tarjeta aparece como parcialmente conciliada. Es esperable, no es un error.",
        ],
        [
          "Las fechas se corren por el cierre de lote",
          "Una venta del 31 puede aparecer en la procesadora con fecha del 1. Para eso está la regla con tolerancia de un día: si no la creaste, volvé al paso 5.",
        ],
      ],
      cierre:
        "Si revisaste las cinco y el número sigue bajo, no sigas configurando a ciegas. Escribinos con el porcentaje que te dio y lo miramos con vos.",
    },
    fork: null,
    _pend: [
      "Confirmar los nombres exactos de los estados que muestra el resultado.",
      "Definir si el pedido de ayuda de este paso abre un canal distinto al del resto.",
    ],
  },
  {
    nav: "Tu rutina",
    kicker: "Paso 7 de 7",
    title: "Dejá la conciliación andando sola",
    lead:
      "Conciliar una vez no alcanza: si esto no se convierte en una rutina, en dos semanas el módulo queda desactualizado y vas a estar igual que antes. Este último paso define quién hace qué, cada cuánto, y deja programado todo lo que puede correr sin que nadie se acuerde.",
    videos: [
      { t: "Programar la secuencia para que corra sola", d: "1:30" },
      { t: "Activar los avisos por mail", d: "1:10" },
    ],
    path: "Configuración → Reglas y Secuencias",
    todo: [
      "Definí cada cuánto vas a conciliar: semanal es lo más común.",
      "Definí quién carga el archivo de ventas y ponelo en su calendario.",
      "Programá la secuencia con esa misma frecuencia.",
      "Activá los avisos para la persona que quedó a cargo.",
    ],
    verify:
      "La semana que viene entrá a Nubceo sin tocar nada más que la carga del archivo: <b>tenés que encontrar una ejecución nueva ya hecha.</b> Si aparece, la rutina quedó andando. Si no aparece, revisá la programación de la secuencia antes de que pase otra semana.",
    nota: {
      csv:
        "Ojo con un detalle si cargás por archivo: la secuencia programada corre igual aunque nadie haya subido las ventas de la semana, y en ese caso no va a encontrar nada que conciliar. El recordatorio de la carga importa más que la programación. Primero asegurate de que alguien tenga la carga agendada; la secuencia programada viene después.",
      api:
        "Como tus ventas entran solas por la integración, con programar la secuencia alcanza: no hay ninguna carga manual de la que acordarse.",
    },
    fork: null,
    _pend: [
      "Confirmar las opciones reales de frecuencia y el uso de rango y desfase, para que el video muestre valores concretos.",
      "Confirmar qué avisos automáticos existen hoy y cuáles se configuran desde dónde.",
    ],
  },
];
