// Pure parsing and geometry helpers for the Inkscape-authored button face SVG.
// Kept free of Vite/JSON imports so Node tests can load it directly.

export interface SvgNode {
  tag: string
  attrs: Record<string, string>
  children: SvgNode[]
  text: string
}

export type Matrix = readonly [number, number, number, number, number, number]

export interface Box {
  x: number
  y: number
  width: number
  height: number
}

export interface Point {
  x: number
  y: number
}

export const IDENTITY_MATRIX: Matrix = [1, 0, 0, 1, 0, 0]

// Standard SVG composition: multiplyMatrix(parent, child) applies `child` first.
export function multiplyMatrix(m: Matrix, n: Matrix): Matrix {
  const [a1, b1, c1, d1, e1, f1] = m
  const [a2, b2, c2, d2, e2, f2] = n
  return [
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1,
    b1 * e2 + d1 * f2 + f1,
  ]
}

export function applyMatrix(m: Matrix, p: Point): Point {
  return { x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] }
}

function transformFunction(name: string, args: number[]): Matrix {
  const deg = Math.PI / 180
  switch (name) {
    case 'matrix':
      if (args.length !== 6) throw new Error(`matrix() needs 6 values, got ${args.length}`)
      return [args[0], args[1], args[2], args[3], args[4], args[5]]
    case 'translate':
      return [1, 0, 0, 1, args[0] ?? 0, args[1] ?? 0]
    case 'scale':
      return [args[0], 0, 0, args[1] ?? args[0], 0, 0]
    case 'rotate': {
      const rad = (args[0] ?? 0) * deg
      const r: Matrix = [Math.cos(rad), Math.sin(rad), -Math.sin(rad), Math.cos(rad), 0, 0]
      if (args.length < 3) return r
      const [cx, cy] = [args[1], args[2]]
      return multiplyMatrix(multiplyMatrix([1, 0, 0, 1, cx, cy], r), [1, 0, 0, 1, -cx, -cy])
    }
    case 'skewX':
      return [1, 0, Math.tan((args[0] ?? 0) * deg), 1, 0, 0]
    case 'skewY':
      return [1, Math.tan((args[0] ?? 0) * deg), 0, 1, 0, 0]
    default:
      throw new Error(`Unsupported SVG transform: ${name}()`)
  }
}

// Parses an SVG transform attribute into a single matrix. Missing input is the identity.
export function parseTransform(value: string | undefined): Matrix {
  if (!value || !value.trim()) return IDENTITY_MATRIX
  let result: Matrix = IDENTITY_MATRIX
  const pattern = /([a-zA-Z]+)\s*\(([^)]*)\)/g
  let consumed = ''
  for (const match of value.matchAll(pattern)) {
    consumed += match[0]
    const args = match[2].split(/[\s,]+/).filter(Boolean).map(Number)
    if (args.some((n) => Number.isNaN(n))) throw new Error(`Invalid number in transform: ${value}`)
    result = multiplyMatrix(result, transformFunction(match[1], args))
  }
  if (consumed.replace(/\s|,/g, '') !== value.replace(/\s|,/g, '')) {
    throw new Error(`Could not parse transform: ${value}`)
  }
  return result
}

// Inkscape stores `fill:...` in style="..."; flatten it so lookups see one attribute map.
export function flattenAttrs(node: SvgNode): Record<string, string> {
  const attrs: Record<string, string> = { ...node.attrs }
  delete attrs.style
  const style = node.attrs.style
  if (style) {
    for (const declaration of style.split(';')) {
      const colon = declaration.indexOf(':')
      if (colon < 0) continue
      const key = declaration.slice(0, colon).trim()
      const value = declaration.slice(colon + 1).trim()
      if (key) attrs[key] = value
    }
  }
  return attrs
}

export interface LocatedNode {
  node: SvgNode
  // Root-to-node chain, including the node itself as the last entry.
  chain: SvgNode[]
}

export function walkNodes(root: SvgNode): LocatedNode[] {
  const out: LocatedNode[] = []
  const visit = (node: SvgNode, ancestors: SvgNode[]) => {
    const chain = [...ancestors, node]
    out.push({ node, chain })
    for (const child of node.children) visit(child, chain)
  }
  visit(root, [])
  return out
}

export function accumulatedMatrix(chain: SvgNode[]): Matrix {
  return chain.reduce<Matrix>((m, n) => multiplyMatrix(m, parseTransform(n.attrs.transform)), IDENTITY_MATRIX)
}

// Layers are matched by id or Inkscape label, e.g. `ch0` or `body`.
function findLayer(root: SvgNode, name: string): LocatedNode | undefined {
  return walkNodes(root).find(({ node }) => {
    if (node.tag !== 'g') return false
    const attrs = flattenAttrs(node)
    return attrs.id === name || attrs['inkscape:label'] === name
  })
}

// Parts are matched by exact id (`chN-shape`, `chN-engraving`, `chN-label-anchor`) inside their
// own layer. A part that Inkscape places elsewhere is not picked up by another channel.
function findPart(layer: LocatedNode, id: string): LocatedNode | undefined {
  const found = walkNodes(layer.node).find(({ node }) => flattenAttrs(node).id === id)
  if (!found) return undefined
  return { node: found.node, chain: [...layer.chain, ...found.chain.slice(1)] }
}

export function parseViewBox(root: SvgNode): Box {
  const parts = (root.attrs.viewBox ?? '').split(/[\s,]+/).filter(Boolean).map(Number)
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) throw new Error('root <svg> needs a numeric viewBox')
  const [x, y, width, height] = parts
  return { x, y, width, height }
}

export function round(value: number): number {
  return Number(value.toFixed(6))
}

export function matrixAttribute(m: Matrix): string {
  return `matrix(${m.map(round).join(' ')})`
}

export function viewBoxAttribute(box: Box): string {
  return [box.x, box.y, box.width, box.height].map(round).join(' ')
}

const SKIPPED_TAGS = new Set(['metadata', 'title', 'desc', 'defs', 'style', 'script'])
const PAINT_PROPS = ['fill', 'stroke', 'stroke-width']
// Presentation properties that a `<g>` wrapper must carry down to the engraving, because the
// wrapper replaces the layer and ancestor context the element would otherwise inherit from.
const INHERITED_PRESENTATION = [
  'fill',
  'stroke',
  'stroke-width',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'letter-spacing',
  'text-anchor',
  'dominant-baseline',
  'fill-rule',
  'stroke-linecap',
  'stroke-linejoin',
]

// Engravings always take the CSS `color` of the button, so any explicit paint becomes currentColor.
function normalizePaint(key: string, value: string): string {
  return (key === 'fill' || key === 'stroke') && value !== 'none' ? 'currentColor' : value
}

interface SanitizeOptions {
  // Drops the element's own transform and opacity, because a wrapper <g> carries them.
  dropOwnTransform: boolean
  keepClass: boolean
  // Shapes and the body take their paint from CSS classes, not from the SVG file.
  stripPaint: boolean
}

// Drops Inkscape/sodipodi metadata and ids.
function sanitizeNode(node: SvgNode, options: SanitizeOptions): SvgNode | null {
  if (node.tag.includes(':') || SKIPPED_TAGS.has(node.tag)) return null
  const attrs: Record<string, string> = {}
  for (const [key, value] of Object.entries(flattenAttrs(node))) {
    if (key.includes(':') || key === 'xmlns' || key === 'id') continue
    if (key === 'class' && !options.keepClass) continue
    if (options.dropOwnTransform && (key === 'transform' || key === 'opacity')) continue
    if (options.stripPaint && PAINT_PROPS.includes(key)) continue
    attrs[key] = normalizePaint(key, value)
  }
  const children = node.children
    .map((child) => sanitizeNode(child, { ...options, dropOwnTransform: false }))
    .filter((child): child is SvgNode => child !== null)
  return { tag: node.tag, attrs, children, text: node.text.trim() ? node.text : '' }
}

function inheritedPresentation(chain: SvgNode[]): Record<string, string> {
  const flats = chain.map(flattenAttrs)
  const result: Record<string, string> = {}
  for (const prop of INHERITED_PRESENTATION) {
    for (let i = flats.length - 1; i >= 0; i--) {
      const value = flats[i][prop]
      if (value !== undefined) {
        result[prop] = normalizePaint(prop, value)
        break
      }
    }
  }
  result.fill ??= 'currentColor'
  result.stroke ??= 'none'
  return result
}

function cumulativeOpacity(chain: SvgNode[]): number {
  return chain.reduce((opacity, node) => opacity * Number(flattenAttrs(node).opacity ?? 1), 1)
}

// Engraving: a wrapper <g> carries the placement matrix, then a `button-face-scale` group
// that CSS can scale about its own center.
export function buildEngravingNode(chain: SvgNode[]): SvgNode {
  const clone = sanitizeNode(chain[chain.length - 1], { dropOwnTransform: true, keepClass: false, stripPaint: false })
  if (!clone) throw new Error('engraving element cannot be drawn')
  const opacity = cumulativeOpacity(chain)
  const attrs: Record<string, string> = {
    ...inheritedPresentation(chain),
    transform: matrixAttribute(accumulatedMatrix(chain)),
  }
  if (opacity !== 1) attrs.opacity = String(round(opacity))
  const scale: SvgNode = { tag: 'g', attrs: { class: 'button-face-scale' }, children: [clone], text: '' }
  return { tag: 'g', attrs, children: [scale], text: '' }
}

const SHAPE_TAGS = new Set(['rect', 'circle', 'ellipse'])

// Clickable button shape. Its fill and stroke come from CSS state classes.
export function buildShapeNode(chain: SvgNode[]): SvgNode {
  const element = chain[chain.length - 1]
  if (!SHAPE_TAGS.has(element.tag)) throw new Error(`button shape must be a rect, circle, or ellipse, got <${element.tag}>`)
  const clone = sanitizeNode(element, { dropOwnTransform: true, keepClass: false, stripPaint: true })
  if (!clone) throw new Error('button shape cannot be drawn')
  clone.attrs.class = 'controller-key-shape'
  return { tag: 'g', attrs: { transform: matrixAttribute(accumulatedMatrix(chain)) }, children: [clone], text: '' }
}

// Non-interactive body artwork (outline, brand text). Paint comes from CSS classes.
export function buildBodyNodes(root: SvgNode): SvgNode[] {
  const body = findLayer(root, 'body')
  if (!body) throw new Error('body layer not found')
  return body.node.children
    .map((child) => sanitizeNode(child, { dropOwnTransform: false, keepClass: true, stripPaint: true }))
    .filter((child): child is SvgNode => child !== null)
}

function anchorCenter(anchor: LocatedNode): Point {
  const attrs = flattenAttrs(anchor.node)
  const num = (value: string | undefined) => Number(value ?? 0)
  let local: Point
  switch (anchor.node.tag) {
    case 'rect':
      local = { x: num(attrs.x) + num(attrs.width) / 2, y: num(attrs.y) + num(attrs.height) / 2 }
      break
    case 'circle':
    case 'ellipse':
      local = { x: num(attrs.cx), y: num(attrs.cy) }
      break
    case 'text':
      local = { x: num(attrs.x), y: num(attrs.y) }
      break
    default:
      throw new Error(`label-anchor must be a rect, circle, ellipse, or text, got <${anchor.node.tag}>`)
  }
  return applyMatrix(accumulatedMatrix(anchor.chain), local)
}

export interface ChannelArt {
  shape: SvgNode
  engraving: SvgNode | null
  // Label center in SVG root user units.
  labelAnchor: Point
}

export function buildChannelArt(root: SvgNode, channel: string): ChannelArt {
  const layer = findLayer(root, channel)
  if (!layer) throw new Error(`layer ${channel} not found`)
  const shape = findPart(layer, `${channel}-shape`)
  if (!shape) throw new Error(`${channel}-shape not found`)
  const engraving = findPart(layer, `${channel}-engraving`)
  const anchor = findPart(layer, `${channel}-label-anchor`)
  if (!anchor) throw new Error(`${channel}-label-anchor not found`)
  return {
    shape: buildShapeNode(shape.chain),
    engraving: engraving ? buildEngravingNode(engraving.chain) : null,
    labelAnchor: anchorCenter(anchor),
  }
}
