// Minimal XML-to-SvgNode parser for Node tests. The runtime uses DOMParser instead; Node has none.
// Handles the constructs Inkscape writes: declarations, comments, DOCTYPE, quoted attributes, and entities.
import type { SvgNode } from '../../src/config/buttonFaceSvg.ts'

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (match, body: string) => {
    if (body.startsWith('#x')) return String.fromCodePoint(parseInt(body.slice(2), 16))
    if (body.startsWith('#')) return String.fromCodePoint(Number(body.slice(1)))
    return ENTITIES[body] ?? match
  })
}

const ATTRIBUTE = /([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g

function parseAttributes(source: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  for (const match of source.matchAll(ATTRIBUTE)) {
    attrs[match[1]] = decodeEntities(match[2] ?? match[3] ?? '')
  }
  return attrs
}

// Groups: 1 closing tag name, 2 opening tag name, 3 attribute text, 4 self-closing slash, 5 text.
const TOKEN = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!DOCTYPE[^>]*>|<\/([^\s>]+)\s*>|<([^\s/>]+)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>|([^<]+)/g

export function parseSvgXml(source: string): SvgNode {
  const stack: SvgNode[] = []
  let root: SvgNode | null = null
  for (const match of source.matchAll(TOKEN)) {
    const [, closing, opening, attrText, selfClosing, text] = match
    if (closing !== undefined) {
      const open = stack.pop()
      if (!open || open.tag !== closing) throw new Error(`Mismatched closing tag </${closing}>`)
      continue
    }
    if (opening !== undefined) {
      const node: SvgNode = { tag: opening, attrs: parseAttributes(attrText), children: [], text: '' }
      const parent = stack[stack.length - 1]
      if (parent) parent.children.push(node)
      else if (root) throw new Error('SVG document has more than one root element')
      else root = node
      if (!selfClosing) stack.push(node)
      continue
    }
    if (text !== undefined && text.trim() && stack.length > 0) {
      stack[stack.length - 1].text += decodeEntities(text)
    }
  }
  if (stack.length > 0) throw new Error(`Unclosed tag <${stack[stack.length - 1].tag}>`)
  if (!root) throw new Error('No root element')
  return root
}
