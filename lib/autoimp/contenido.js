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
//   0.9.3 el panel interno queda restringido a Implementaciones
export const VERSION = "0.9.4";

// Video de apertura, en la pantalla de bienvenida.
export const VIDEO_BIENVENIDA = {
  t: "Qué vas a configurar",
  d: "2:00",
  id: "19369e457bed408bad814347611f21c2",
};

export const NIVELES = [
  { k: "facil", l: "Fácil", c: "" },
  { k: "normal", l: "Normal", c: "" },
  { k: "costo", l: "Tuve algunas dificultades", c: "warn" },
  { k: "trabe", l: "Necesité asistencia", c: "bad" },
];

export const STEPS = [
  {
    nav: "Tu equipo",
    title: "Incorporá a las personas que van a participar en la configuración",
    lead:
      "Esta configuración rara vez la realiza una sola persona. El archivo de ventas suele estar a cargo del área de sistemas, los números de comercio \u2139\uFE0F (el identificador que cada procesadora de pagos le asigna a tu local) los gestiona quien maneja la relación con las procesadoras de pagos \u2139\uFE0F (las empresas que procesan tus cobros con tarjeta: Visa, Mastercard, Mercado Pago, etc.), y las liquidaciones las revisa administración. Antes de comenzar, creá los roles necesarios para tu equipo e invitá a esas personas: cada una ingresa con su propio usuario y se encarga de la parte que le corresponde, sin necesidad de reenviar enlaces ni compartir contraseñas.",
    videos: [
      { t: "Creación de roles", d: "1:00", id: "0017159026d44c07acc69cf6a9d17bb4", ruta: "Workspace \u2139\uFE0F (sección de administración de tu cuenta en Nubceo) → Roles" },
      { t: "Creación de usuarios", d: "1:00", id: "f9b5786baeb249d9aba19f73116e7039", ruta: "Workspace \u2139\uFE0F → Usuarios" },
    ],
    path: "Workspace \u2139\uFE0F (administración de tu cuenta) → Usuarios",
    todo: [
      "Ingresá a la sección Workspace de tu cuenta en Nubceo.",
      "Creá los roles necesarios para tu equipo.",
      "Creá los usuarios de las personas que van a participar en la configuración.",
      "Asigná a cada usuario el rol que le corresponda.",
    ],
    verify:
      "Solicitá a cada persona invitada que ingrese y confirme que puede acceder a la plataforma. <b>Verificá que cada una tenga su rol correctamente asignado</b>: un usuario sin rol asignado podrá iniciar sesión pero no tendrá acceso a ninguna funcionalidad, lo cual genera confusión. Si alguna persona no logró ingresar, verificá que el correo de invitación no haya llegado a la carpeta de spam.",
    fork: null,
    _pend: [],
  },
  {
    nav: "Sucursales y comercios",
    title: "Cargá tus sucursales y sus números de comercio \u2139\uFE0F",
    lead:
      "Cada procesadora de pagos identifica tus locales con su propio número de comercio \u2139\uFE0F (el identificador que la procesadora le asigna a tu local), que no tiene relación con el nombre que vos les asignás internamente. Este paso conecta ambas cosas: al cargar el Excel de mapeo, Nubceo genera automáticamente las sucursales cabecera \u2139\uFE0F (la entidad dentro de Nubceo que agrupa los números de comercio de un mismo local) con el código y el nombre de punto de venta \u2139\uFE0F (tu local comercial) que indiques, y les asocia sus números de comercio. Es el paso más importante de toda la configuración y el único donde un error pasa inadvertido: si un número queda asociado a la sucursal cabecera incorrecta, el sistema no emite ninguna advertencia — las ventas simplemente se concilian contra el local equivocado y todos los reportes reflejan información incorrecta.",
    videos: [
      { t: "Qué es el mapeo de comercios", d: "1:00", id: "29b38c7d2e3b428da9c3956834fa91a4" },
      { t: "Dónde encontrar tus números de comercio", d: "0:36", id: "02a7d864ab1c434589bf77dedfa83a7f" },
      { t: "Cargar todo de una vez con el Excel", d: "3:00", id: "40fb0788d07d44ac99aeaa98346ae65c", ruta: "Mi Negocio → Sucursales Cabecera" },
      { t: "Crear una sucursal cabecera a mano", d: "1:00", id: "17a4cc04518e4a4e849728314228910d", ruta: "Mi Negocio → Sucursales Cabecera" },
      { t: "Asociar un comercio a mano", d: "1:00", id: "4749e915c71645d18e18d2dced5dc159", ruta: "Mi Negocio → Sucursales Cabecera" },
    ],
    path: "Mi Negocio → Sucursales Cabecera",
    todo: [
      "Elaborá un listado de todos tus locales activos, incluyendo los que se incorporaron recientemente.",
      "Solicitá a cada procesadora de pagos el listado de comercios activos, o descargalo desde su portal.",
      "Completá el Excel con una fila por cada número de comercio, incluyendo el código y el nombre del punto de venta \u2139\uFE0F (tu local comercial) correspondiente.",
      "Subí el archivo: las sucursales cabecera \u2139\uFE0F se generan automáticamente con esos datos.",
      "Si la cantidad es reducida, también podés cargarlas manualmente en lugar de utilizar el Excel.",
    ],
    ejemplo: {
      titulo: "Ejemplo práctico: cómo completar el Excel de sucursales",
      filas: [
        ["Local Centro", "SUC-001", "Visa", "12345678"],
        ["Local Centro", "SUC-001", "Mastercard", "87654321"],
        ["Local Palermo", "SUC-002", "Visa", "11223344"],
        ["Local Palermo", "SUC-002", "Mercado Pago", "MP-9876"],
      ],
      columnas: ["Nombre de PDV", "Código PDV", "Procesadora", "Nro. de Comercio"],
      nota: "Cada fila representa un <b>número de comercio</b> \u2139\uFE0F (el identificador que la procesadora asigna), no un local. Un mismo local puede tener varios números (uno por cada procesadora o terminal). Completá todos y Nubceo los agrupa automáticamente.",
    },
    casoEspecial: {
      titulo: "¿Todas tus sucursales operan bajo un mismo número de comercio?",
      texto: "Es un caso completamente válido: si la procesadora de pagos te asignó un solo número y todas tus ventas se liquidan a través de él, cargá <b>una sola sucursal cabecera</b> con ese número. No es necesario crear sucursales separadas. El mapeo funciona de la misma manera: una fila en el Excel, un número de comercio, una sucursal cabecera.",
    },
    verify:
      "Tomá el listado de comercios proporcionado por la procesadora de pagos y verificalo línea por línea contra lo que quedó cargado en Nubceo: deben coincidir tanto en cantidad como en las asociaciones. Lleva tiempo, pero es un paso fundamental dado que es la única verificación disponible. Después, comprobá que la cantidad de sucursales cabecera creadas <b>coincida con tu lista de locales</b>. Dos situaciones son habituales y no requieren intervención: un mismo local puede tener más de un número de comercio si cuenta con varias terminales, y un mismo número puede abarcar dos locales si la procesadora los registró de manera conjunta.",
    fork: null,
    _pend: [],
  },
  {
    nav: "Origen de las ventas",
    title: "Configurá cómo llegan tus ventas a Nubceo",
    lead:
      "Para realizar la conciliación, Nubceo necesita recibir tus ventas tal como las registró tu sistema de gestión \u2139\uFE0F (tu software de punto de venta). Existen dos caminos posibles, con distintos niveles de esfuerzo: seleccioná el que mejor se adapte a tu operación antes de continuar.",
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
      "Confirmá desde qué fecha tenés liquidaciones cargadas en Nubceo y seleccioná un período posterior.",
      "Descargá la planilla oficial y exportá desde tu sistema de gestión las ventas correspondientes a ese período.",
      "Trasladá los datos a la planilla respetando el nombre y el orden de las columnas.",
      "Validá el archivo con el verificador disponible más abajo antes de subirlo a la plataforma.",
      "Subí el archivo desde Conciliaciones → Ventas (PDV) y corregí los registros que resulten rechazados.",
    ],
    verify:
      "El resumen indica cuántos registros se procesaron correctamente y cuántos fueron rechazados: <b>el objetivo es llegar a cero rechazados</b> antes de continuar. Luego, realizá una segunda verificación que no es automática: ingresá al listado de ventas, filtrá por una sucursal y un día, y cotejá las cantidades contra tu sistema de gestión. Si el archivo se importó completo pero con las columnas desplazadas, la importación no arroja errores y la inconsistencia solo se detecta al revisar los datos.",
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
        d: "Exportás las ventas de tu sistema de gestión, las transferís a la planilla oficial de Nubceo y subís el archivo. Es el camino más rápido: no requiere desarrollo técnico y podés completarlo íntegramente con esta guía.",
      },
      api: {
        b: "Requiere desarrollo",
        t: "Mi sistema se integra por API",
        d: "Tu sistema de gestión se integra directamente con Nubceo y las ventas ingresan de forma automática. Requiere desarrollo técnico y pruebas conjuntas, por lo que se trabaja con un implementador de Nubceo.",
      },
      ambos: {
        b: "Mixto",
        t: "Parte por API y parte por CSV",
        d: "Una parte de tus puntos de venta \u2139\uFE0F (tus locales o sistemas de gestión) se integra por API y otra envía las ventas por archivo. Realizás ambos caminos: seleccioná con cuál preferís comenzar.",
      },
    },
    _pend: [],
  },
  {
    nav: "Reglas y secuencias",
    title: "Configurá cómo Nubceo realiza el cruce de información",
    lead:
      "Una regla define qué campos deben coincidir entre tu venta y el pago de la procesadora de pagos para considerarlos la misma operación. Una secuencia de conciliación \u2139\uFE0F (un conjunto de reglas que se ejecutan en orden, de la más exigente a la más flexible) aplica esas reglas de manera escalonada: lo que no se cruza con la primera regla se intenta con la segunda, y así sucesivamente.",
    videos: [
      { t: "Reglas y secuencias, y cómo configurarlas", d: "2:59", id: "2fbac7ddcdb4485091cca32a4a1d625a", ruta: "Conciliaciones → Configuración → Reglas y Secuencias" },
    ],
    path: "Conciliaciones → Configuración → Reglas y Secuencias",
    todo: [
      "Regla 1 (la más exigente): fecha, monto, número de comercio, lote \u2139\uFE0F (el cierre diario de operaciones que envía tu terminal) y cupón \u2139\uFE0F (el identificador de cada operación individual).",
      "Regla 2: idéntica a la anterior, sin el lote.",
      "Regla 3: idéntica a la anterior, con una tolerancia de un día en la fecha.",
      "Regla 4: idéntica a la anterior, con tolerancia de un día en la fecha y de centavos en el monto.",
      "Creá una secuencia de conciliación e incorporá las cuatro reglas en ese orden.",
    ],
    verify:
      "Abrí la secuencia de conciliación y verificá el orden: deben estar dispuestas de la más exigente a la más flexible. <b>El orden es el factor determinante en esta configuración.</b> Si una regla flexible se ejecuta primero, va a cruzar operaciones similares antes de que la más exigente identifique la coincidencia correcta, y el resultado será incorrecto sin que el sistema muestre ninguna advertencia.",
    fork: null,
    _pend: [
      "Validar la cascada con implementación y definir la tolerancia de monto recomendada.",
    ],
  },
  {
    nav: "Primera conciliación",
    title: "Ejecutá tu primera conciliación y aprendé a interpretar el resultado",
    lead:
      "Es el momento clave: ejecutá la secuencia de conciliación sobre tus datos y aprendé a interpretar los resultados. Este es el paso más relevante para tu operación diaria, ya que la lectura e interpretación de los resultados de conciliación es una tarea que realizarás de forma semanal.",
    videos: [
      { t: "Ejecutar y programar una secuencia", d: "1:01", id: "7c4cca3e293e41a9b032242b8fe33af0", ruta: "Conciliaciones → Ejecuciones → Programar / Ejecutar" },
      { t: "Leer el detalle de una ejecución", d: "1:42", id: "b49b2e18f3d141c882caf7a1e29358ab", ruta: "Conciliaciones → Ejecuciones → Historial de ejecuciones" },
      { t: "Conciliación manual", d: "2:52", id: "835a0dc9b31e46f98f7b4a1064a4a65a", ruta: "Conciliaciones → Conciliación Manual" },
    ],
    path: "Conciliaciones → Ejecuciones",
    todo: [
      "Seleccioná el período de ventas que cargaste en el paso anterior.",
      "Ejecutá la secuencia de conciliación y aguardá a que finalice el procesamiento.",
      "Revisá el porcentaje conciliado y el detalle desglosado por regla.",
      "Analizá una muestra de las operaciones que no se cruzaron e identificá qué tienen en común.",
      "Resolvé manualmente los casos puntuales que ninguna regla haya cubierto.",
    ],
    verify:
      "Un resultado satisfactorio se ubica en <b>90% o más</b>. Si el porcentaje obtenido es inferior, no modifiques la configuración todavía: en la mayoría de los casos se debe a alguna de las situaciones que se detallan a continuación, y cada una tiene una solución específica.",
    triage: {
      titulo: "Si el resultado fue inferior al esperado, revisá estas causas en orden",
      items: [
        [
          "Facturás el total pero te pagan cuota a cuota",
          "Si vendés en cuotas y tu sistema de gestión registra el monto total de la venta mientras la procesadora de pagos te liquida una cuota por mes, los montos nunca van a coincidir y el porcentaje disminuye significativamente. Es la causa más frecuente de un resultado muy bajo y no se resuelve mediante reglas de conciliación: contactanos y lo analizamos en conjunto.",
        ],
        [
          "El período no tiene liquidaciones completas",
          "Si cargaste ventas de días que la procesadora de pagos todavía no liquidó, no existe contraparte contra la cual cruzarlas. Probá con un período anterior o aguardá unos días y volvé a ejecutar la conciliación.",
        ],
        [
          "Hay números de comercio sin mapear o cruzados",
          "Si una sucursal cabecera quedó sin su número de comercio asociado, sus ventas no se van a cruzar. Si un número quedó asociado a la sucursal cabecera incorrecta, el cruce se realiza contra el local equivocado. Volvé al paso 2 y cotejá contra el listado de la procesadora de pagos.",
        ],
        [
          "Parte de tus ventas no se cobra con tarjeta",
          "Nubceo concilia exclusivamente pagos realizados a través de medios procesados electrónicamente. El efectivo, las gift cards y los vales no tienen contraparte en el sistema, por lo que una venta abonada parcialmente en efectivo y parcialmente con tarjeta figura como parcialmente conciliada. Este comportamiento es esperable y no representa un error.",
        ],
        [
          "Las fechas se corren por el cierre de lote",
          "Una venta registrada el día 31 puede figurar en la procesadora de pagos con fecha del 1 del mes siguiente. Para contemplar este desfasaje existe la regla con tolerancia de un día: si no la configuraste, volvé al paso anterior.",
        ],
      ],
      cierre:
        "Si revisaste las cinco causas y el porcentaje continúa siendo bajo, no continúes ajustando la configuración sin asesoramiento. Contactanos indicando el porcentaje obtenido y lo analizamos junto con vos.",
    },
    fork: null,
    _pend: [
      "Confirmar los nombres exactos de los estados que muestra el resultado.",
    ],
  },
  {
    nav: "Tu rutina",
    title: "Establecé tu rutina de conciliación periódica",
    lead:
      "Realizar una sola conciliación no es suficiente: si este proceso no se incorpora como una rutina periódica, en pocas semanas el módulo quedará desactualizado. Este paso define quién se encarga de cada tarea, con qué frecuencia, y deja configurados los avisos automáticos para que nadie deba recordar ingresar a la plataforma manualmente.",
    videos: [
      { t: "Activar los avisos por mail", d: "1:23", id: "fbcf2c0bf94b411596c98da287074d9b", ruta: "Configuración" },
    ],
    path: "Configuración",
    todo: [
      "Definí la periodicidad de la conciliación: lo más habitual es de forma semanal.",
      "Designá a la persona responsable de cargar el archivo de ventas e incorporá esta tarea en su agenda.",
      "Activá los avisos por correo electrónico para la persona que quedó a cargo del seguimiento.",
    ],
    verify:
      "La próxima semana deberías recibir el aviso por correo electrónico sin necesidad de ingresar a buscarlo. <b>Si el aviso llega correctamente, la rutina está funcionando.</b> Si no lo recibís, revisá la configuración antes de que transcurra otra semana.",
    nota: {
      csv:
        "Tené en cuenta un aspecto importante si operás con carga por archivo: si nadie sube las ventas de la semana, no habrá datos nuevos para conciliar. El recordatorio de la carga es tan relevante como los avisos de conciliación: asegurate de que una persona del equipo tenga esta tarea incorporada en su agenda.",
      api:
        "Dado que tus ventas ingresan automáticamente a través de la integración por API, con los avisos activados es suficiente: no hay ninguna carga manual que requiera seguimiento.",
    },
    fork: null,
    _pend: [],
  },
  {
    nav: "Conocé más",
    title: "Descubrí las funcionalidades adicionales de Nubceo",
    lead:
      "Completaste la configuración del Conciliador transaccional, que constituye el núcleo de la plataforma. Sin embargo, existen otros módulos que probablemente resulten de utilidad para tu operación y que no requieren una implementación adicional: se activan sobre la misma cuenta y con los datos que ya cargaste. Este último paso tiene como objetivo presentarte las funcionalidades disponibles para que puedas solicitarlas cuando las necesites.",
    videos: [],
    path: "Inicio",
    todo: [
      "Conciliación bancaria: cruzar los movimientos de tus cuentas bancarias contra las liquidaciones de las procesadoras de pagos.",
      "Contabilidad: generar los asientos contables de ventas, cobros y comisiones para tu sistema contable.",
      "Promociones: verificar que los acuerdos y descuentos financiados se estén liquidando correctamente.",
      "Analíticos: monitorear la evolución de tu cobranza, los costos por procesadora y los planes de cuotas.",
    ],
    verify:
      "No hay ninguna verificación necesaria en este paso. Si alguno de estos módulos resulta de tu interés, contactanos y te informamos cómo se activa y qué implica para tu operación.",
    fork: null,
    _pend: [
      "Grabar el video de cierre con el recorrido por los otros módulos.",
    ],
  },
];
