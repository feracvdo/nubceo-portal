// lib/vinculacion.js
// Cómo vincular cada procesadora, según la "Guía de puesta en marcha de Nubceo".
// Cada entrada se muestra al cliente en el paso de Procesadoras y descarga su manual:
// /public/manuales/vinculacion-<code>.pdf (introducción + requisitos + la sección de esa
// procesadora + contacto). Para actualizar un manual, reemplazá su PDF con el mismo nombre.
//
// video: id de YouTube del tutorial (lo que va después de youtu.be/). En null no se muestra.

export const REQUISITOS_GENERALES = [
  "Acceso a Nubceo con permisos para operar en Mi negocio.",
  "Acceso administrador al portal de cada procesadora que vayas a vincular.",
  "El contacto de tu ejecutivo comercial en cada procesadora: varias altas las gestiona él.",
  "El listado de CUIT y de números de comercio o establecimiento de cada plataforma.",
];

export const VINCULACION = {
  mercadopago_ar: {
    metodo: "Desde Nubceo", demora: "En el momento", quien: "Lo hacés vos desde Nubceo",
    pre: ["La cuenta administradora de Mercado Libre asociada a tu cuenta de Mercado Pago: es con la que se autoriza la conexión."],
    pasos: [
      ["Tené a mano la cuenta administradora", "Necesitás el usuario administrador de Mercado Libre asociado a tu cuenta de Mercado Pago."],
      ["Entrá a la integración en Nubceo", "En Nubceo, abrí Mi negocio › Empresas › Mercado Pago."],
      ["Autorizá el acceso", "Seguí el asistente y autorizá la conexión con la cuenta administradora."],
    ],
    video: "pRNwcf7dKx8",
  },
  prisma_ar: {
    metodo: "SFTP con clave pública", demora: null, quien: "Vos, en el portal de Payway",
    pre: ["Perfil con permisos de configuración en el portal de Payway.", "La empresa creada en Nubceo con la plataforma Payway agregada."],
    pasos: [
      ["Copiá la clave pública desde Nubceo", "Al agregar la plataforma Payway en tu empresa, Nubceo genera una clave pública. Copiala tal cual aparece."],
      ["Cargá la clave en Payway", "En el portal de Payway, abrí Configuraciones › Credenciales y accesos, generá un nuevo acceso SFTP y pegá la clave."],
      ["Verificá que el acceso se creó", "Volvé a Credenciales y accesos y confirmá que el acceso SFTP figura creado con la clave cargada."],
      ["Generá los cinco reportes", "En Reportes, generá Movimientos en línea, Presentados, Liquidados, Contracargos y devoluciones, y Pagos y Transferencias inmediatas. En todos: frecuencia Diaria, envío Copia SFTP y formato Separado por columnas."],
    ],
    video: "BcyFzwI9Clg",
  },
  firstdata_ar: {
    metodo: "Ticket en el Merchant Portal", demora: null, quien: "Vos, en el Merchant Portal de Fiserv",
    pre: ["Acceso al Merchant Portal de Fiserv."],
    pasos: [
      ["Abrí un ticket nuevo", "En el Merchant Portal, abajo a la izquierda, elegí Ayuda › Nuevo ticket."],
      ["Pedí el Alta SFG", "Seleccioná la opción Alta SFG, completá los campos requeridos y tocá Enviar."],
      ["Compartinos lo que te mande Fiserv", "Fiserv te envía las credenciales y un archivo .ppk. Pasáselos al equipo de Nubceo."],
    ],
    video: "XfhItcojZBg",
  },
  gocuotas_ar: {
    metodo: "API key", demora: "En el momento", quien: "Vos copiás la clave y la cargamos juntos en la reunión",
    pre: ["Acceso con la cuenta administradora al panel de GoCuotas."],
    pasos: [
      ["Abrí tu perfil", "En el Panel de Administrador, verificá que veas Liquidaciones en el menú y abrí el ícono de perfil (arriba a la derecha) › Perfil."],
      ["Abrí las claves del comercio", "Bajá hasta el final del perfil y desplegá Ver Apikeys del comercio."],
      ["Copiá la Production API key", "Copiá la clave de producción (no la de sandbox). Con ese dato hacemos la vinculación juntos en la reunión."],
    ],
    video: "0o9cLE7TGLQ",
  },
  getnet_ar: {
    metodo: "Reportes GMR por SFTP", demora: null, quien: "Vos, con tu ejecutivo de Getnet",
    pre: ["Que el producto GMR (Global Merchant Payout Reports) esté incluido en tu contrato con Getnet.", "El código de tu representante de Getnet (seller code)."],
    pasos: [
      ["Pedí el alta de los reportes GMR", "Escribile a tu ejecutivo de Getnet para pedir el alta de GMR."],
      ["Completá el formulario de Getnet", "Getnet te manda un formulario. Completá nombre, CUIT, seller code y representante comercial; la clave pública, el correo técnico y las IP te las pasa tu implementador/a."],
      ["Reenvianos la confirmación", "Cuando Getnet configure el servidor, te llega un mail de confirmación. Reenviáselo al equipo de Nubceo."],
    ],
    video: null,
  },
  naranja_ar: {
    metodo: "Alta al SFTP de Nubceo", demora: "10 a 15 días", quien: "Tu ejecutivo de Naranja X",
    pre: ["El contacto de tu ejecutivo de Naranja X."],
    pasos: [
      ["Pedí el alta por mail", "Escribile a tu ejecutivo pidiendo que cargue un ticket interno al área de Producto para dar de alta tu comercio en el SFTP de Nubceo. Sumá a team.cx@nubceo.com en copia."],
      ["Pedí los archivos PAG", "Aclará que necesitamos los archivos PAG (Día o Dif), que detallan las liquidaciones. Los archivos CAD no sirven para conciliar."],
    ],
    video: null,
  },
  cabal_ar: {
    metodo: "Credenciales por mail", demora: null, quien: "Vos, por mail con Cabal",
    pre: [],
    pasos: [
      ["Pedí las credenciales", "Escribí a transmisiones@cabal.coop pidiendo las credenciales de acceso."],
      ["Cambialas en el primer ingreso", "Cabal te manda un enlace con credenciales iniciales. Al entrar, cambialas, cerrá sesión y volvé a ingresar."],
      ["Compartinos las definitivas", "Pasale las credenciales nuevas al equipo de Nubceo y hacemos la vinculación."],
    ],
    video: "-5atJBGrCVE",
  },
  amex_ar: {
    metodo: "SFTP por cada CUIT", demora: "Unos 15 días", quien: "Vos, con Amex o tu ejecutivo de cuenta",
    pre: ["El detalle de tus números de establecimiento de Amex, por CUIT."],
    pasos: [
      ["Pedí el alta del SFTP por cada CUIT", "En el portal de atención al cliente de Amex o con tu ejecutivo de cuenta, hacé una solicitud por cada CUIT."],
      ["Usá estos datos en la solicitud", "Adjuntá el detalle de números de establecimiento. Empresa conciliadora: NUBCEO. Formato de archivos: TAB. Protocolo: SFTP."],
      ["Reenvianos los dos mails", "Amex manda dos correos por CUIT, uno con el usuario y otro con la contraseña. Reenviáselos al equipo de Nubceo apenas lleguen."],
    ],
    video: "R1uwq-4OIN4",
  },
  rappi_ar: {
    metodo: "Usuario en el portal de Rappi", demora: null, quien: "Vos, en el portal de Rappi",
    pre: ["El correo que te pasa tu implementador/a para crear el usuario."],
    pasos: [
      ["Creá un usuario nuevo", "En el portal de Rappi, creá un usuario con el correo que te pasamos."],
      ["Asignale el rol", "Elegí el rol Administrador de tareas."],
      ["Avisanos", "Cuando esté creado, avisale a tu implementador/a para seguir."],
    ],
    video: "veQgsFZILcg",
  },
  pedidosya_ar: {
    metodo: "Un usuario por CUIT", demora: null, quien: "Vos, en el portal de PedidosYa",
    pre: ["Los correos que te pasa tu implementador/a, uno por CUIT (con el formato pec_xxxx@asistente.nubceo.com)."],
    pasos: [
      ["Creá un usuario por cada CUIT", "Por la doble autenticación de PedidosYa, generá un usuario y contraseña por cada CUIT, con los correos indicados."],
      ["Elegí el rol Finanzas", "Cuando te pida el rol del usuario, seleccioná Finanzas."],
      ["Avisanos", "Cuando estén creados, avisale al equipo de Nubceo para seguir."],
    ],
    video: "4JM-uHnT7Tw",
  },
  unicobros_ar: {
    metodo: "API Key y Token", demora: null, quien: "Tu ejecutivo de Unicobros te los da y los cargamos nosotros",
    pre: ["El contacto de tu ejecutivo de Unicobros."],
    pasos: [
      ["Pedí la API Key y el Token", "Solicitáselos a tu ejecutivo de Unicobros."],
      ["Compartilos con Nubceo", "Pasáselos solo a tu contacto de Nubceo: son credenciales sensibles."],
      ["Los cargamos en tu empresa", "Los cargamos en Empresa › Agregar plataforma › Unicobros y la plataforma queda vinculada."],
    ],
    video: null,
  },
  tuya_ar: {
    metodo: "Credenciales SFTP", demora: null, quien: "Tu ejecutivo de Tuya",
    pre: ["El contacto de tu ejecutivo de cuenta de Tuya."],
    pasos: [
      ["Pedí las credenciales del SFTP", "Solicitáselas a tu ejecutivo de cuenta de Tuya."],
      ["Compartilas con Nubceo", "Pasáselas solo a tu contacto de Nubceo: son sensibles."],
      ["Las cargamos en tu empresa", "Con las credenciales hacemos la vinculación."],
    ],
    video: null,
  },
};

export const manualDe = (code) => (VINCULACION[code] ? "/manuales/vinculacion-" + code + ".pdf" : null);
