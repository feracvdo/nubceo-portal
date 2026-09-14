// lib/autoimp/contenido.js
//
// Todo el texto y los videos de la guía viven acá. Para cambiar contenido no
// hace falta tocar el componente.
//
// Campos de cada paso:
//   nav      — nombre corto para la barra lateral
//   title    — título de la pantalla
//   lead     — por qué existe el paso y qué se rompe si sale mal
//   videos   — [{ t, d, id, ruta }]. `id` es el identificador de Loom: se saca
//              de la URL para compartir, https://www.loom.com/share/<id>.
//              `ruta` es dónde se hace eso puntual dentro de Nubceo.
//   path     — ruta por defecto del paso, si un video no trae la suya
//   todo     — checklist de lo que hace el cliente
//   verify   — cómo darse cuenta de que salió bien (admite <b>)
//   descargas— [{ t, url }] material para bajar; url null = todavía no está
//   fork     — solo el paso de ventas: bifurcación CSV / API
//   herramienta — "csv" activa el validador de archivo
//   _pend    — pendientes internos. NO se renderiza al cliente.
//
// El número de paso se calcula solo a partir del orden de este arreglo.

//   0.1  guía navegable, sin persistencia
//   0.2  acceso por código y guardado de progreso
//   0.3  bitácora, correo en vez de nombre, sesión de 1 hora
//   0.4  habilitación por cliente desde el panel y link para compartir
//   0.5  cupo de consultas al implementador
//   0.6  avisos al cliente desde el panel
//   0.7  validador de archivo de ventas
//   0.8  solapa de mediciones en el panel
//   0.9  videos reales, pasos 2 y 3 unificados, paso nuevo de cierre
//   0.9.1 plantilla de ventas y especificación de la API descargables
//   0.9.2 cada descarga se muestra solo en su camino
export const VERSION = "0.9.2";

// Video de apertura, en la pantalla de bienvenida.
export const VIDEO_BIENVENIDA = {
  t: "Qué vas a configurar",
  d: "2:00",
  id: "19369e457bed408bad814347611f21c2",
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
    title: "Sumá a las personas que van a configurar con vos",
    lead:
      "Esta configuración casi nunca la hace una sola persona. El archivo de ventas suele estar del lado de sistemas, los números de comercio los tiene quien maneja la relación con las procesadoras, y las liquidaciones las mira administración. Antes de arrancar, creá los roles que vas a necesitar e invitá a esas personas: cada una entra con su propio usuario y hace la parte que le toca, sin reenviar links ni compartir contraseñas.",
    videos: [
      { t: "Creación de roles", d: "1:00", id: "0017159026d44c07acc69cf6a9d17bb4", ruta: "Workspace → Roles" },
      { t: "Creación de usuarios", d: "1:00", id: "f9b5786baeb249d9aba19f73116e7039", ruta: "Workspace → Usuarios" },
    ],
    path: "Workspace → Usuarios",
    todo: [
      "Accedé a Workspace.",
      "Creá los roles que vas a necesitar.",
      "Creá los usuarios de las personas que van a participar.",
      "Asignale a cada usuario el rol que le corresponde.",
    ],
    verify:
      "Pedile a cada persona que invitaste que entre y te confirme que puede ver la plataforma. <b>Revisá que cada una tenga su rol asignado</b>: un usuario sin rol entra pero no puede hacer nada, y eso confunde. Si alguien no llegó a entrar, fijate que el mail no haya caído en correo no deseado.",
    fork: null,
    _pend: [],
  },
  {
    nav: "Sucursales y comercios",
    title: "Cargá tus sucursales y sus números de comercio",
    lead:
      "Cada procesadora identifica tus locales con su propio número de comercio, que no tiene nada que ver con el nombre que vos les ponés. Este paso conecta las dos cosas: al cargar el Excel de mapeo, Nubceo crea solas las sucursales cabecera con el código y el nombre de PDV que pongas, y les asocia sus números de comercio. Es el paso más importante de toda la configuración y el único donde un error no se ve: si un número queda en la cabecera equivocada, no aparece ningún aviso, las ventas simplemente concilian contra el local equivocado y todos tus reportes quedan mal.",
    videos: [
      { t: "Qué es el mapeo de comercios", d: "1:00", id: "29b38c7d2e3b428da9c3956834fa91a4" },
      { t: "Dónde encontrar tus números de comercio", d: "0:36", id: "02a7d864ab1c434589bf77dedfa83a7f" },
      { t: "Cargar todo de una vez con el Excel", d: "3:00", id: "40fb0788d07d44ac99aeaa98346ae65c", ruta: "Mi Negocio → Sucursales Cabecera" },
      { t: "Crear una sucursal cabecera a mano", d: "1:00", id: "17a4cc04518e4a4e849728314228910d", ruta: "Mi Negocio → Sucursales Cabecera" },
      { t: "Asociar un comercio a mano", d: "1:00", id: "4749e915c71645d18e18d2dced5dc159", ruta: "Mi Negocio → Sucursales Cabecera" },
    ],
    path: "Mi Negocio → Sucursales Cabecera",
    todo: [
      "Hacé la lista de todos tus locales activos, incluso los que abrieron hace poco.",
      "Pedile a cada procesadora el listado de comercios activos, o descargalo de su portal.",
      "Completá el Excel con una fila por comercio, incluyendo el código y el nombre de PDV de su local.",
      "Subilo: las sucursales cabecera se crean solas con esos datos.",
      "Si son pocos, podés hacerlo a mano en vez de usar el Excel.",
    ],
    verify:
      "Tomá el listado de comercios que te dio la procesadora y recorrelo línea por línea contra lo que quedó cargado: tienen que dar la misma cantidad y las mismas asociaciones. Es tedioso y vale la pena, porque es el único chequeo que existe. Después contá las sucursales cabecera que se crearon: <b>el número tiene que coincidir con tu lista de locales</b>. Dos situaciones son normales y no hay que forzarlas: un mismo local puede tener más de un número si tiene varias terminales, y un mismo número puede cubrir dos locales si la procesadora los dio de alta juntos.",
    fork: null,
    _pend: [],
  },
  {
    nav: "Origen de las ventas",
    title: "Hacé que tus ventas lleguen a Nubceo",
    lead:
      "Para conciliar, Nubceo necesita tus ventas tal como las registró tu sistema. Hay dos caminos posibles y no dan el mismo trabajo: elegí el tuyo antes de seguir.",
    videos: [
      { t: "Cómo llegan tus ventas a Nubceo", d: "0:53", id: "800844ba81ab4cd59bb8f2669e04ffce" },
      { t: "Elegir cómo vas a enviarlas", d: "1:51", id: "db6c1dae765345c883ad438fff5ec0c7" },
      { t: "Por archivo: período y planilla", d: "3:00", id: "96f469f984b043ee9a38d31378cbd06d", ruta: "Conciliaciones → Ventas (PDV)" },
      { t: "Por archivo: usar el validador", d: "2:02", id: "98d8d21f698b454f88d6f12df1313b80", ruta: "Conciliaciones → Ventas (PDV)" },
    ],
    videosApi: [
      { t: "Por API: la desarrolla Nubceo", d: "1:39", id: "6d9d1c6605be474699b2371ce8749860" },
      { t: "Por API: la desarrolla tu equipo", d: "0:49", id: "97a4809ad55b48fc983c21533747d573" },
    ],
    path: "Conciliaciones → Ventas (PDV)",
    todo: [
      "Confirmá desde qué fecha tenés liquidaciones en Nubceo y elegí un período posterior.",
      "Descargá la planilla oficial y exportá de tu sistema las ventas de ese período.",
      "Pasá los datos a la planilla respetando nombre y orden de las columnas.",
      "Probá el archivo en el validador de acá abajo antes de subirlo.",
      "Subilo desde Conciliaciones → Ventas (PDV) y corregí lo rechazado.",
    ],
    verify:
      "El resumen te dice cuántos registros entraron y cuántos fueron rechazados: <b>apuntá a cero rechazados</b> antes de seguir. Después hacé un segundo chequeo que no es automático: entrá al listado de ventas, filtrá por una sucursal y un día, y contá contra tu sistema. Si el archivo entró completo pero con las columnas corridas, la importación no da error y solo se nota mirando los datos.",
    // `via` decide en qué camino se muestra cada descarga: csv o api.
    descargas: [
      { t: "Plantilla de carga de ventas (Excel)", url: "/descargas/plantilla-ventas-nubceo.xlsx", via: "csv" },
      { t: "Especificación de la API de ventas (PDF)", url: "/descargas/especificacion-api-ventas-nubceo.pdf", via: "api" },
    ],
    herramienta: "csv",
    fork: {
      q: "¿Cómo va a recibir Nubceo tus ventas?",
      csv: {
        b: "Autoservicio",
        t: "Subo un archivo de ventas",
        d: "Exporto las ventas de mi sistema, las paso a la planilla de Nubceo y subo el archivo. Es el camino más rápido, no necesita desarrollo y lo podés hacer entero con esta guía.",
      },
      api: {
        b: "Requiere desarrollo",
        t: "Mi sistema se integra por API",
        d: "Mi sistema de gestión se conecta directo con Nubceo y las ventas entran solas. Necesita desarrollo y pruebas conjuntas, así que lo trabajamos con un implementador.",
      },
    },
    _pend: [],
  },
  {
    nav: "Reglas y secuencias",
    title: "Configurá cómo Nubceo cruza la información",
    lead:
      "Una regla define qué campos tienen que coincidir entre tu venta y el pago de la procesadora para considerarlos la misma operación. Una secuencia es un conjunto de reglas que se ejecutan en orden, de la más exigente a la más flexible: lo que no cruzó con la primera lo intenta la segunda, y así.",
    videos: [
      { t: "Reglas y secuencias, y cómo configurarlas", d: "2:59", id: "2fbac7ddcdb4485091cca32a4a1d625a", ruta: "Conciliaciones → Configuración → Reglas y Secuencias" },
    ],
    path: "Conciliaciones → Configuración → Reglas y Secuencias",
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
      "Validar la cascada con implementación y definir la tolerancia de monto recomendada.",
    ],
  },
  {
    nav: "Primera conciliación",
    title: "Ejecutá tu primera conciliación y leé el resultado",
    lead:
      "Es el momento de la verdad: corré la secuencia sobre tus datos y aprendé a leer lo que sale. Este es el paso que más te va a servir en el día a día, porque interpretar el resultado es lo que vas a hacer todas las semanas.",
    videos: [
      { t: "Ejecutar y programar una secuencia", d: "1:01", id: "7c4cca3e293e41a9b032242b8fe33af0", ruta: "Conciliaciones → Ejecuciones → Programar / Ejecutar" },
      { t: "Leer el detalle de una ejecución", d: "1:42", id: "b49b2e18f3d141c882caf7a1e29358ab", ruta: "Conciliaciones → Ejecuciones → Historial de ejecuciones" },
      { t: "Conciliación manual", d: "2:52", id: "835a0dc9b31e46f98f7b4a1064a4a65a", ruta: "Conciliaciones → Conciliación Manual" },
    ],
    path: "Conciliaciones → Ejecuciones",
    todo: [
      "Elegí el período de ventas que cargaste en el paso anterior.",
      "Ejecutá la secuencia y esperá a que termine.",
      "Mirá el porcentaje conciliado y el detalle por regla.",
      "Abrí una muestra de lo que no cruzó y buscá qué tienen en común.",
      "Resolvé a mano los casos sueltos que no cubra ninguna regla.",
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
          "Hay números de comercio sin mapear o cruzados",
          "Si una sucursal quedó sin su número, sus ventas no cruzan nunca. Si un número quedó en la cabecera equivocada, cruzan mal. Volvé al paso 2 y revisá contra el listado de la procesadora.",
        ],
        [
          "Parte de tus ventas no se cobra con tarjeta",
          "Nubceo concilia pagos con medios procesados. El efectivo, las giftcards y los vales no tienen contraparte, así que una venta pagada mitad en efectivo y mitad con tarjeta aparece como parcialmente conciliada. Es esperable, no es un error.",
        ],
        [
          "Las fechas se corren por el cierre de lote",
          "Una venta del 31 puede aparecer en la procesadora con fecha del 1. Para eso está la regla con tolerancia de un día: si no la creaste, volvé al paso anterior.",
        ],
      ],
      cierre:
        "Si revisaste las cinco y el número sigue bajo, no sigas configurando a ciegas. Escribinos con el porcentaje que te dio y lo miramos con vos.",
    },
    fork: null,
    _pend: [
      "Confirmar los nombres exactos de los estados que muestra el resultado.",
    ],
  },
  {
    nav: "Tu rutina",
    title: "Dejá la conciliación andando sola",
    lead:
      "Conciliar una vez no alcanza: si esto no se convierte en una rutina, en dos semanas el módulo queda desactualizado y vas a estar igual que antes. Este paso define quién hace qué y cada cuánto, y deja activados los avisos para que nadie tenga que acordarse de entrar a mirar.",
    videos: [
      { t: "Activar los avisos por mail", d: "1:23", id: "fbcf2c0bf94b411596c98da287074d9b", ruta: "Configuración" },
    ],
    path: "Configuración",
    todo: [
      "Definí cada cuánto vas a conciliar: semanal es lo más común.",
      "Definí quién carga el archivo de ventas y ponelo en su calendario.",
      "Activá los avisos por mail para la persona que quedó a cargo.",
    ],
    verify:
      "La semana que viene tenés que recibir el aviso por mail sin haber entrado a buscarlo. <b>Si el aviso llega, la rutina quedó andando.</b> Si no llega, revisá la configuración antes de que pase otra semana.",
    nota: {
      csv:
        "Ojo con un detalle si cargás por archivo: si nadie sube las ventas de la semana, no hay nada nuevo que conciliar. El recordatorio de la carga importa tanto como los avisos: asegurate de que alguien la tenga agendada.",
      api:
        "Como tus ventas entran solas por la integración, con los avisos activados alcanza: no hay ninguna carga manual de la que acordarse.",
    },
    fork: null,
    _pend: [],
  },
  {
    nav: "Conocé más",
    title: "Nubceo hace más cosas de las que configuraste",
    lead:
      "Terminaste tu Conciliador transaccional, que es el corazón de la plataforma. Pero hay otros módulos que probablemente te sirvan y que no necesitan una implementación aparte: se activan sobre la misma cuenta y con los mismos datos que ya cargaste. Este último paso es para que sepas qué existe y puedas pedirlo cuando lo necesites.",
    videos: [],
    path: "Inicio",
    todo: [
      "Conciliación bancaria: cruzar los movimientos de tus cuentas contra las liquidaciones.",
      "Contabilidad: generar los asientos de ventas, cobros y comisiones para tu sistema contable.",
      "Promociones: controlar que los acuerdos y descuentos financiados se estén liquidando como corresponde.",
      "Analíticos: ver cómo evoluciona tu cobranza, tus costos por procesadora y tus planes de cuotas.",
    ],
    verify:
      "No hay nada que verificar acá. Si alguno de estos módulos te interesa, escribinos y te contamos cómo se activa y qué implica en tu caso.",
    fork: null,
    _pend: [
      "Grabar el video de cierre con el recorrido por los otros módulos.",
    ],
  },
];
