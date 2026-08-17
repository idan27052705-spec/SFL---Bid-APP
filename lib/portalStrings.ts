/**
 * Sub portal copy, English and Spanish.
 * Wording taken from the design file — plain, short, no jargon.
 */

export const LANGS = ["en", "es"] as const;
export type Lang = (typeof LANGS)[number];

export const STR = {
  en: {
    portal: "Sub Portal",
    signIn: "Sign in",
    email: "Email or phone",
    code: "Access code",
    codeHint: "The 6-digit code from your invitation",
    badLogin:
      "That email and code don't match. Check the code in your invitation, or call the office.",
    tooMany: "Too many tries. Wait a minute and try again.",
    signOut: "Sign out",

    myInfo: "My info",
    profile: "Profile",
    waiting: "Bids waiting",
    submitted: "Submitted",
    past: "Past / closed",
    nothing: "Nothing here yet.",
    nothingWaiting: "No bids waiting. We'll email you when there's one.",

    due: "Due",
    overdue: "overdue",
    today: "due today",
    tomorrow: "due tomorrow",
    inDays: "days left",
    scope: "Scope of work",
    files: "Drawings & specs",
    photos: "Photos & video",
    download: "Open",
    back: "Back",

    submitQuote: "Send my price",
    cantBid: "I can't bid this one",
    total: "Your total price",
    totalHint: "One number for the whole package.",
    lead: "Lead time",
    leadHint: "e.g. 6 weeks",
    excl: "Anything not included",
    exclHint: "So there are no surprises later.",
    notes: "Notes",
    attach: "Attach your own quote (optional)",
    attached: "Attached",
    send: "Send quote",
    sending: "Sending…",
    why: "Why can't you bid this one?",
    whyHint: "One line is enough. It helps us send you better work.",
    sendDecline: "Send",
    cancel: "Cancel",

    sentOk: "Sent. SFL Builders has your price.",
    declinedOk: "Thanks — we've told SFL Builders.",
    yourPrice: "Your price",
    youSaid: "You said",
    priceRequired: "Enter your price.",
    reasonRequired: "Tell us why, even briefly.",

    askChange: "Ask for a change",
    changeHint: "Send an update to SFL Builders. It applies once they approve it.",
    whatField: "What needs updating?",
    newValue: "New value",
    sendRequest: "Send request",
    requestSent: "Request sent. SFL Builders will review it.",
    pendingTitle: "Waiting for SFL approval",
    statusSent: "New",
    statusViewed: "Opened",
    statusReceived: "Price sent",
    statusDenied: "You passed",
    awarded: "You won this one",
    notAwarded: "Closed",
  },

  es: {
    portal: "Portal de Subcontratistas",
    signIn: "Entrar",
    email: "Correo o teléfono",
    code: "Código de acceso",
    codeHint: "El código de 6 dígitos de su invitación",
    badLogin:
      "El correo y el código no coinciden. Revise el código de su invitación o llame a la oficina.",
    tooMany: "Demasiados intentos. Espere un minuto e intente de nuevo.",
    signOut: "Salir",

    myInfo: "Mis datos",
    profile: "Perfil",
    waiting: "Licitaciones pendientes",
    submitted: "Enviadas",
    past: "Cerradas",
    nothing: "Nada por ahora.",
    nothingWaiting: "No hay licitaciones pendientes. Le avisaremos por correo.",

    due: "Vence",
    overdue: "vencida",
    today: "vence hoy",
    tomorrow: "vence mañana",
    inDays: "días restantes",
    scope: "Alcance del trabajo",
    files: "Planos y especificaciones",
    photos: "Fotos y video",
    download: "Abrir",
    back: "Atrás",

    submitQuote: "Enviar mi precio",
    cantBid: "No puedo cotizar esta",
    total: "Su precio total",
    totalHint: "Un solo número por todo el paquete.",
    lead: "Tiempo de entrega",
    leadHint: "ej. 6 semanas",
    excl: "Lo que no está incluido",
    exclHint: "Para que no haya sorpresas después.",
    notes: "Notas",
    attach: "Adjuntar su cotización (opcional)",
    attached: "Adjuntado",
    send: "Enviar cotización",
    sending: "Enviando…",
    why: "¿Por qué no puede cotizar esta?",
    whyHint: "Una línea es suficiente. Nos ayuda a enviarle mejor trabajo.",
    sendDecline: "Enviar",
    cancel: "Cancelar",

    sentOk: "Enviado. SFL Builders tiene su precio.",
    declinedOk: "Gracias — avisamos a SFL Builders.",
    yourPrice: "Su precio",
    youSaid: "Usted dijo",
    priceRequired: "Escriba su precio.",
    reasonRequired: "Díganos por qué, aunque sea breve.",

    askChange: "Solicitar un cambio",
    changeHint: "Envíe una actualización a SFL Builders. Se aplica cuando la aprueben.",
    whatField: "¿Qué desea actualizar?",
    newValue: "Nuevo valor",
    sendRequest: "Enviar solicitud",
    requestSent: "Solicitud enviada. SFL Builders la revisará.",
    pendingTitle: "Esperando aprobación de SFL",
    statusSent: "Nueva",
    statusViewed: "Abierta",
    statusReceived: "Precio enviado",
    statusDenied: "No cotizó",
    awarded: "Ganó esta",
    notAwarded: "Cerrada",
  },
} as const;

export type Strings = (typeof STR)["en"];

export const pickLang = (value: string | undefined | null): Lang =>
  value === "es" ? "es" : "en";
