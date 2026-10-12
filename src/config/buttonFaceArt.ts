import svgSource from '../../design/button-face.svg?raw'
import type { HallChannel } from '../device'
import { buildBodyNodes, buildChannelArt, parseViewBox, type Box, type ChannelArt, type SvgNode } from './buttonFaceSvg'

export interface ButtonFaceDocument {
  viewBox: Box
  body: SvgNode[]
  channels: Map<HallChannel, ChannelArt>
}

function toSvgNode(element: Element): SvgNode {
  const attrs: Record<string, string> = {}
  for (const attr of Array.from(element.attributes)) attrs[attr.name] = attr.value
  const children: SvgNode[] = []
  let text = ''
  for (const child of Array.from(element.childNodes)) {
    if (child.nodeType === Node.ELEMENT_NODE) children.push(toSvgNode(child as Element))
    else if (child.nodeType === Node.TEXT_NODE) text += child.textContent ?? ''
  }
  return { tag: element.tagName, attrs, children, text }
}

function parseButtonFaceSource(source: string): SvgNode {
  const doc = new DOMParser().parseFromString(source, 'image/svg+xml')
  if (doc.querySelector('parsererror')) throw new Error('design/button-face.svg is not well-formed XML')
  return toSvgNode(doc.documentElement)
}

const CHANNELS = Array.from({ length: 16 }, (_, index) => `ch${index}` as HallChannel)

// Parsed once per module load. Vite HMR re-evaluates this module when the SVG is saved in Inkscape.
let loaded: ButtonFaceDocument | null = null
try {
  const root = parseButtonFaceSource(svgSource)
  const channels = new Map<HallChannel, ChannelArt>()
  for (const channel of CHANNELS) {
    try {
      channels.set(channel, buildChannelArt(root, channel))
    } catch (error) {
      console.error(`button-face.svg: ${channel} could not be used`, error)
    }
  }
  loaded = { viewBox: parseViewBox(root), body: buildBodyNodes(root), channels }
} catch (error) {
  console.error('button-face.svg could not be parsed', error)
}

export function getButtonFaceDocument(): ButtonFaceDocument | null {
  return loaded
}

export function getButtonFaceArt(channel: HallChannel): ChannelArt | null {
  return loaded?.channels.get(channel) ?? null
}
