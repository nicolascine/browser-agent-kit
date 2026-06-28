/**
 * Intent grounding: map a natural-language description and each element's label
 * onto a small, bounded vocabulary of common web actions, then match by intent.
 *
 * The web's actions are a near-closed set (login, register, search, help, cart,
 * submit, …), so a KB-sized lexicon — no model, no download — grounds most
 * descriptions and, crucially, DISAMBIGUATES (login ≠ register) where a small
 * general embedding model cannot. Grow the lexicon as needed.
 */
const STOP = new Set('de la el los las un una y o a al con para en por my me the to of and or your you i'.split(' '))

export const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ]+/g, ' ').trim()
const toks = (s: string) => norm(s).split(' ').filter((t) => t.length > 1 && !STOP.has(t))

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
  menu: ['menu', 'opciones', 'navegacion', 'navigation', 'options'],
  download: ['descargar', 'bajar', 'exportar', 'download', 'export'],
  payment: ['pago', 'pagar', 'acreditacion', 'facturacion', 'payment', 'pay', 'billing', 'checkout'],
  suppliers: ['proveedores', 'proveedor', 'vendedores', 'suppliers', 'vendor'],
  buyers: ['compradores', 'comprador', 'organismos compradores', 'buyers'],
}

export function intentsOf(text: string): string[] {
  const t = new Set(toks(text))
  const found: string[] = []
  for (const [intent, phrases] of Object.entries(LEXICON)) {
    for (const p of phrases) {
      const pt = toks(p)
      if (pt.length && pt.every((x) => t.has(x))) { found.push(intent); break }
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

function labelOf(el: Element): string {
  const labelFor = el.id ? el.ownerDocument.querySelector(`label[for="${el.id}"]`)?.textContent : ''
  return (
    el.getAttribute('aria-label') ||
    (el as HTMLInputElement).placeholder ||
    labelFor ||
    el.textContent ||
    el.getAttribute('title') ||
    el.getAttribute('name') ||
    ''
  ).replace(/\s+/g, ' ').trim()
}

export interface IntentMatch { element: Element; score: number; intents: string[]; label: string }

/** ground a description to the best interactive element by shared intent */
export function groundByIntent(description: string, root: Element = document.body): IntentMatch | null {
  const qi = new Set(intentsOf(description))
  const qt = new Set(toks(description))
  const els = root.querySelectorAll('a, button, input, textarea, select, [role="button"]')

  let best: IntentMatch | null = null
  for (const el of Array.from(els)) {
    if (el instanceof HTMLInputElement && el.type === 'hidden') continue
    const label = labelOf(el)
    if (!label || label.length > 80) continue
    const ci = intentsOf(label)
    const intentHit = ci.some((i) => qi.has(i)) ? 1 : 0
    const score = intentHit + 0.05 * jaccard(qt, new Set(toks(label)))
    if (!best || score > best.score) best = { element: el, score, intents: ci, label }
  }
  // only trust it when an intent actually matched
  return best && best.score >= 1 ? best : null
}
