import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  applyMatrix,
  buildBodyNodes,
  buildChannelArt,
  buildEngravingNode,
  buildShapeNode,
  flattenAttrs,
  multiplyMatrix,
  parseTransform,
  walkNodes,
  type Matrix,
  type SvgNode,
} from '../src/config/buttonFaceSvg.ts'
import { parseSvgXml } from './helpers/svgXml.ts'

const DESIGN_PATH = fileURLToPath(new URL('../design/button-face.svg', import.meta.url))
const CHANNELS = Array.from({ length: 16 }, (_, index) => `ch${index}`)
const INKSCAPE_NS = 'xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"'

function near(actual: number, expected: number, tolerance = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${actual} to be within ${tolerance} of ${expected}`)
}

function assertMatrix(actual: Matrix, expected: number[]) {
  assert.equal(actual.length, 6)
  expected.forEach((value, index) => near(actual[index], value))
}

describe('transform math', () => {
  it('treats a missing or blank transform as identity', () => {
    assertMatrix(parseTransform(undefined), [1, 0, 0, 1, 0, 0])
    assertMatrix(parseTransform('   '), [1, 0, 0, 1, 0, 0])
  })

  it('parses translate with one or two arguments', () => {
    assert.deepEqual(applyMatrix(parseTransform('translate(10,20)'), { x: 1, y: 2 }), { x: 11, y: 22 })
    assert.deepEqual(applyMatrix(parseTransform('translate(7)'), { x: 1, y: 2 }), { x: 8, y: 2 })
  })

  it('parses scale with one or two arguments', () => {
    assert.deepEqual(applyMatrix(parseTransform('scale(2)'), { x: 1, y: 2 }), { x: 2, y: 4 })
    assert.deepEqual(applyMatrix(parseTransform('scale(2 3)'), { x: 1, y: 2 }), { x: 2, y: 6 })
  })

  it('parses matrix()', () => {
    assert.deepEqual(applyMatrix(parseTransform('matrix(1 0 0 1 5 6)'), { x: 1, y: 1 }), { x: 6, y: 7 })
  })

  it('rotates around the origin, and around a center when given one', () => {
    const quarter = applyMatrix(parseTransform('rotate(90)'), { x: 1, y: 0 })
    near(quarter.x, 0)
    near(quarter.y, 1)
    const about = applyMatrix(parseTransform('rotate(90 10 10)'), { x: 11, y: 10 })
    near(about.x, 10)
    near(about.y, 11)
  })

  it('applies chained functions right to left, as SVG does', () => {
    // scale first, then translate: (1,0) -> (2,0) -> (12,0)
    assert.deepEqual(applyMatrix(parseTransform('translate(10,0) scale(2)'), { x: 1, y: 0 }), { x: 12, y: 0 })
  })

  it('rejects unknown functions, bad numbers, and trailing junk', () => {
    assert.throws(() => parseTransform('skewZ(3)'), /Unsupported SVG transform/)
    assert.throws(() => parseTransform('translate(a)'), /Invalid number/)
    assert.throws(() => parseTransform('translate(1) junk'), /Could not parse transform/)
  })

  it('multiplies matrices in parent-then-child order', () => {
    const parentChild = multiplyMatrix(parseTransform('translate(10,0)'), parseTransform('scale(2)'))
    assert.deepEqual(applyMatrix(parentChild, { x: 1, y: 0 }), { x: 12, y: 0 })
  })
})

describe('attribute flattening', () => {
  it('lets style declarations override presentation attributes and drops style', () => {
    const node: SvgNode = {
      tag: 'path',
      attrs: { fill: 'red', style: 'fill:#123456; stroke: none;' },
      children: [],
      text: '',
    }
    assert.deepEqual(flattenAttrs(node), { fill: '#123456', stroke: 'none' })
  })
})

describe('channel art from a layer', () => {
  const layer = parseSvgXml(`<svg ${INKSCAPE_NS} viewBox="0 0 100 100">
    <g id="ch3" inkscape:groupmode="layer" transform="translate(5 5)">
      <circle id="ch3-shape" cx="50" cy="50" r="20"/>
      <g id="ch3-engraving" transform="translate(1 2)" opacity="0.5">
        <text x="1" y="2" style="fill:#123;font-size:20px">B</text>
      </g>
      <circle id="ch3-label-anchor" cx="3" cy="4" r="1"/>
    </g>
  </svg>`)

  it('places the shape, engraving, and label anchor through the layer transform', () => {
    const art = buildChannelArt(layer, 'ch3')
    assert.equal(art.shape.attrs.transform, 'matrix(1 0 0 1 5 5)')
    assert.equal(art.shape.children[0].attrs.class, 'controller-key-shape')
    assert.equal(art.shape.children[0].attrs.cx, '50')
    assert.ok(art.engraving)
    assert.equal(art.engraving.attrs.transform, 'matrix(1 0 0 1 6 7)')
    assert.deepEqual(art.labelAnchor, { x: 8, y: 9 })
  })

  it('returns a null engraving when the channel has no engraving part', () => {
    const noMark = parseSvgXml(`<svg><g id="ch4">
      <circle id="ch4-shape" cx="0" cy="0" r="10"/>
      <circle id="ch4-label-anchor" cx="0" cy="0" r="1"/>
    </g></svg>`)
    assert.equal(buildChannelArt(noMark, 'ch4').engraving, null)
  })

  it('finds layers and parts by Inkscape label when the id is absent', () => {
    const byLabel = parseSvgXml(`<svg ${INKSCAPE_NS}>
      <g inkscape:label="ch4">
        <circle inkscape:label="ch4-shape" cx="0" cy="0" r="10" id="ch4-shape"/>
        <circle id="ch4-label-anchor" cx="2" cy="3" r="1"/>
      </g>
    </svg>`)
    assert.deepEqual(buildChannelArt(byLabel, 'ch4').labelAnchor, { x: 2, y: 3 })
  })

  it('throws a clear error when the layer or a required part is missing', () => {
    assert.throws(() => buildChannelArt(parseSvgXml('<svg/>'), 'ch9'), /layer ch9 not found/)
    assert.throws(
      () => buildChannelArt(parseSvgXml('<svg><g id="ch9"><circle id="ch9-label-anchor" cx="0" cy="0" r="1"/></g></svg>'), 'ch9'),
      /ch9-shape not found/,
    )
  })

  it('rejects shapes that are not rect, circle, or ellipse', () => {
    const path = parseSvgXml('<svg><g id="ch5"><path id="ch5-shape" d="M0 0"/><circle id="ch5-label-anchor" cx="0" cy="0" r="1"/></g></svg>')
    assert.throws(() => buildChannelArt(path, 'ch5'), /button shape must be a rect, circle, or ellipse/)
  })

  it('computes label anchors for rect, circle, and text, and rejects unsupported tags', () => {
    const anchorIn = (anchor: string) =>
      parseSvgXml(`<svg><g id="ch5"><circle id="ch5-shape" cx="0" cy="0" r="1"/>${anchor}</g></svg>`)
    assert.deepEqual(buildChannelArt(anchorIn('<rect id="ch5-label-anchor" x="0" y="0" width="10" height="4"/>'), 'ch5').labelAnchor, { x: 5, y: 2 })
    assert.deepEqual(buildChannelArt(anchorIn('<text id="ch5-label-anchor" x="3" y="4">A</text>'), 'ch5').labelAnchor, { x: 3, y: 4 })
    assert.throws(
      () => buildChannelArt(anchorIn('<path id="ch5-label-anchor" d="M0 0"/>'), 'ch5'),
      /label-anchor must be a rect, circle, ellipse, or text/,
    )
  })

  it('keeps a rotated capsule shape rotated around its own center', () => {
    const capsule = parseSvgXml(`<svg><g id="ch6">
      <rect id="ch6-shape" x="0" y="0" width="10" height="4" rx="2" transform="rotate(90 5 2)"/>
      <circle id="ch6-label-anchor" cx="5" cy="2" r="1"/>
    </g></svg>`)
    const art = buildChannelArt(capsule, 'ch6')
    assert.equal(art.shape.children[0].tag, 'rect')
    assert.equal(art.shape.attrs.transform, 'matrix(0 1 -1 0 7 -3)')
    assert.deepEqual(art.labelAnchor, { x: 5, y: 2 })
  })
})

describe('engraving and shape node construction', () => {
  it('moves the placement onto a wrapper, strips Inkscape metadata, and normalizes paint', () => {
    const art = buildChannelArt(
      parseSvgXml(`<svg ${INKSCAPE_NS}>
        <g id="ch3" inkscape:groupmode="layer" transform="translate(5 5)">
          <circle id="ch3-shape" cx="0" cy="0" r="1"/>
          <g id="ch3-engraving" transform="translate(1 2)" opacity="0.5">
            <text inkscape:label="x" x="1" y="2" style="fill:#123;font-size:20px">B</text>
          </g>
          <circle id="ch3-label-anchor" cx="0" cy="0" r="1"/>
        </g>
      </svg>`),
      'ch3',
    )
    const wrapper = art.engraving
    assert.ok(wrapper)
    assert.equal(wrapper.tag, 'g')
    assert.equal(wrapper.attrs.transform, 'matrix(1 0 0 1 6 7)')
    assert.equal(wrapper.attrs.opacity, '0.5')
    assert.equal(wrapper.attrs.fill, 'currentColor')
    assert.equal(wrapper.attrs.stroke, 'none')
    const [scale] = wrapper.children
    assert.equal(scale.attrs.class, 'button-face-scale')
    const [engraving] = scale.children
    assert.equal(engraving.attrs.id, undefined)
    assert.equal(engraving.attrs.transform, undefined)
    assert.equal(engraving.attrs.opacity, undefined)
    const [text] = engraving.children
    assert.equal(text.tag, 'text')
    assert.equal(text.text, 'B')
    assert.equal(text.attrs.fill, 'currentColor')
    assert.equal(text.attrs['font-size'], '20px')
    assert.equal(text.attrs.style, undefined)
    assert.equal(text.attrs['inkscape:label'], undefined)
  })

  it('keeps an engraving that has its own transform placed in the same spot', () => {
    const root = parseSvgXml(`<svg>
      <g id="ch6"><path id="ch6-engraving" transform="rotate(90)" d="M1 0 L2 0" fill="none" stroke="#000"/></g>
    </svg>`)
    const [located] = walkNodes(root).filter(({ node }) => flattenAttrs(node).id === 'ch6-engraving')
    const wrapper = buildEngravingNode(located.chain)
    assert.equal(wrapper.attrs.transform, 'matrix(0 1 -1 0 0 0)')
    assert.equal(wrapper.children[0].children[0].attrs.transform, undefined)
    assert.equal(wrapper.children[0].children[0].attrs.stroke, 'currentColor')
    assert.equal(wrapper.children[0].children[0].attrs.fill, 'none')
  })

  it('strips the paint from button shapes so CSS state classes control them', () => {
    const root = parseSvgXml(`<svg><g id="ch0"><circle id="ch0-shape" cx="1" cy="1" r="2" fill="red" stroke="#000"/></g></svg>`)
    const [located] = walkNodes(root).filter(({ node }) => flattenAttrs(node).id === 'ch0-shape')
    const shape = buildShapeNode(located.chain).children[0]
    assert.equal(shape.attrs.fill, undefined)
    assert.equal(shape.attrs.stroke, undefined)
    assert.equal(shape.attrs.class, 'controller-key-shape')
  })

  it('keeps body artwork classes and drops its paint attributes', () => {
    const root = parseSvgXml(`<svg ${INKSCAPE_NS}>
      <g inkscape:groupmode="layer" inkscape:label="body">
        <rect id="controller-body" class="controller-body" x="1" y="1" width="10" height="10" fill="#fff"/>
        <text id="controller-brand" class="controller-brand" x="2" y="3">RAPID</text>
      </g>
    </svg>`)
    const [rect, text] = buildBodyNodes(root)
    assert.equal(rect.tag, 'rect')
    assert.equal(rect.attrs.class, 'controller-body')
    assert.equal(rect.attrs.fill, undefined)
    assert.equal(text.tag, 'text')
    assert.equal(text.text, 'RAPID')
  })
})

describe('design/button-face.svg', () => {
  const root = parseSvgXml(readFileSync(DESIGN_PATH, 'utf8'))

  it('provides a shape and a label anchor for every channel', () => {
    for (const channel of CHANNELS) {
      const art = buildChannelArt(root, channel)
      assert.ok(['circle', 'rect'].includes(art.shape.children[0].tag), `${channel} shape tag`)
      assert.ok(Number.isFinite(art.labelAnchor.x) && Number.isFinite(art.labelAnchor.y), `${channel} anchor`)
    }
  })

  it('draws an engraving for every channel except ch13, which has no mark', () => {
    for (const channel of CHANNELS) {
      const art = buildChannelArt(root, channel)
      assert.equal(art.engraving === null, channel === 'ch13', `${channel} engraving presence`)
    }
  })

  it('keeps each engraving inside its own channel, including ch0 which the old lookup missed', () => {
    const ch0 = buildChannelArt(root, 'ch0')
    assert.equal(ch0.engraving?.attrs.transform, 'matrix(1 0 0 1 0 -19.566722)')
    near(ch0.labelAnchor.x, 334.365, 0.01)
    near(ch0.labelAnchor.y, 163.917, 0.01)
  })

  it('draws the LB and LT capsules as rotated rects', () => {
    for (const channel of ['ch2', 'ch6']) {
      const art = buildChannelArt(root, channel)
      assert.equal(art.shape.children[0].tag, 'rect', `${channel} is a rect`)
      assert.notEqual(art.shape.attrs.transform, 'matrix(1 0 0 1 0 0)', `${channel} is rotated`)
    }
  })

  it('provides the body rect and both brand text lines', () => {
    assert.deepEqual(
      buildBodyNodes(root).map((node) => node.tag),
      ['rect', 'text', 'text'],
    )
  })
})
