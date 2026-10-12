import { createElement, Fragment, type ReactNode } from 'react'
import type { HallChannel } from '../device'
import { getButtonFaceArt, getButtonFaceDocument } from '../config/buttonFaceArt'
import type { SvgNode } from '../config/buttonFaceSvg'

// React needs camelCase for hyphenated SVG attributes (stroke-width -> strokeWidth) and `className`
// for `class`. data-/aria- names pass through unchanged.
function toReactProp(name: string): string {
  if (name === 'class') return 'className'
  if (name.startsWith('data-') || name.startsWith('aria-')) return name
  return name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())
}

export function renderSvgNode(node: SvgNode, key: number): ReactNode {
  const props: Record<string, string | number> = { key }
  for (const [name, value] of Object.entries(node.attrs)) props[toReactProp(name)] = value
  const children: ReactNode[] = node.children.map(renderSvgNode)
  if (node.text) children.unshift(node.text)
  return createElement(node.tag, props, ...children)
}

export function ControllerBody() {
  const doc = getButtonFaceDocument()
  if (!doc) return null
  return <g className="controller-body-art" aria-hidden="true" focusable="false">
    {doc.body.map((node, index) => renderSvgNode(node, index))}
  </g>
}

interface ButtonFaceProps {
  channel: HallChannel
}

// The clickable shape and the engraving for one channel. The shape comes first so the engraving draws on top.
export function ButtonFace({ channel }: ButtonFaceProps) {
  const art = getButtonFaceArt(channel)
  if (!art) return null
  return <Fragment>
    {renderSvgNode(art.shape, 0)}
    {art.engraving && <g className="button-face-offset" aria-hidden="true" focusable="false">
      <g className="button-face">{renderSvgNode(art.engraving, 0)}</g>
    </g>}
  </Fragment>
}
