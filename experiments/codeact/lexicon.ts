/**
 * Intent grounding with a tiny, bounded lexicon — no model, no download.
 *
 * The web's actions are a near-closed set (login, register, search, help, cart,
 * submit, …). We map BOTH the user's description and each element's label onto a
 * shared intent vocabulary, then match by intent. Deterministic, auditable, KB-sized.
 *
 * This is a general starter lexicon (es/en), NOT tuned to any one page. Grow it.
 */
export interface Candidate { text: string; path: string }

const STOP = new Set('de la el los las un una y o a al con para en por my me the to of and or your you i'.split(' '))

export const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ]+/g, ' ').trim()
const toks = (s: string) => norm(s).split(' ').filter((t) => t.length > 1 && !STOP.has(t))

// intent -> synonym phrases (es + en). Phrases match when all their tokens appear.
const LEXICON: Record<string, string[]> = {
  login: ['iniciar sesion', 'ingresar', 'entrar', 'acceder', 'acceso', 'loguear', 'loguearme', 'login', 'log in', 'sign in', 'mi cuenta', 'autenticar'],
  register: ['registrarse', 'registrate', 'registro', 'crear cuenta', 'crear una cuenta', 'darse de alta', 'darme de alta', 'inscribirse', 'sign up', 'register', 'nuevo usuario', 'unirme'],
  search: ['buscar', 'busqueda', 'buscador', 'encontrar', 'search', 'find'],
  help: ['ayuda', 'soporte', 'asistencia', 'centro de ayuda', 'help', 'support', 'faq', 'preguntas frecuentes', 'contacto', 'contactar'],
  training: ['capacitacion', 'cursos', 'curso', 'aprender', 'formacion', 'tutorial', 'training', 'learn', 'guia', 'ensenar'],
  sustainability: ['economia circular', 'reciclaje', 'reciclar', 'medio ambiente', 'sustentabilidad', 'sostenibilidad', 'ecologico', 'verde', 'sustainability', 'recycling'],
  catalog: ['catalogo', 'tienda', 'convenio marco', 'productos', 'precios negociados', 'comprar', 'catalog', 'store', 'shop', 'products'],
  cart: ['carrito', 'cesta', 'canasta', 'cart', 'basket', 'orden de compra', 'ordenes de compra'],
  submit: ['enviar', 'confirmar', 'aceptar', 'guardar', 'continuar', 'submit', 'send', 'confirm', 'save', 'next'],
  cancel: ['cancelar', 'cerrar', 'volver', 'atras', 'cancel', 'close', 'back', 'dismiss'],
  menu: ['menu', 'opciones', 'mas', 'navegacion', 'navigation', 'options'],
  download: ['descargar', 'bajar', 'exportar', 'download', 'export'],
  payment: ['pago', 'pagar', 'acreditacion', 'facturacion', 'payment', 'pay', 'billing', 'checkout'],
  suppliers: ['proveedores', 'proveedor', 'vendedores', 'suppliers', 'vendor'],
  buyers: ['compradores', 'comprador', 'organismos compradores', 'buyers'],
}

function intentsOf(text: string): Set<string> {
  const t = new Set(toks(text))
  const found = new Set<string>()
  for (const [intent, phrases] of Object.entries(LEXICON)) {
    for (const p of phrases) {
      const pt = toks(p)
      if (pt.length && pt.every((x) => t.has(x))) { found.add(intent); break }
    }
  }
  return found
}

const jaccard = (a: Set<string>, b: Set<string>) => {
  if (!a.size || !b.size) return 0
  let inter = 0
  for (const x of a) if (b.has(x)) inter++
  return inter / (a.size + b.size - inter)
}

/** rank candidates: intent overlap dominates, normalized-token overlap breaks ties */
export function ground(description: string, candidates: Candidate[]) {
  const qi = intentsOf(description)
  const qt = new Set(toks(description))
  return candidates
    .map((c) => {
      const ci = intentsOf(c.text)
      const intentHit = [...qi].some((i) => ci.has(i)) ? 1 : 0
      const lex = jaccard(qt, new Set(toks(c.text)))
      return { ...c, intents: [...ci], score: intentHit + 0.05 * lex }
    })
    .sort((a, b) => b.score - a.score)
}
