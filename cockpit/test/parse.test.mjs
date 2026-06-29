// Smoke tests for the most fragile parser logic — image-to-row assignment.
// No framework / deps: run with `npm test`. Guards against the two bugs we hit:
//   1) the +1 row offset (range starting below A1)
//   2) the cascade where a variant row without its own anchor steals the next
//      row's photo, shifting every image down by one.
import assert from 'node:assert/strict'
import { assignImages } from '../src/lib/parseXlsx.js'

let passed = 0
const t = (name, fn) => { fn(); passed++; console.log('  ✓', name) }
const anchor = (from, to, url) => ({ from, to: to ?? from, url })
const prods = (...rowIdxs) => rowIdxs.map((rowIdx) => ({ rowIdx, image: null }))

// 1) exact 1:1 — every product gets its own anchor, no shift
t('exact rows map 1:1', () => {
  const p = prods(10, 11, 12)
  assignImages(p, [anchor(10, 10, 'a'), anchor(11, 11, 'b'), anchor(12, 12, 'c')])
  assert.deepEqual(p.map((x) => x.image), ['a', 'b', 'c'])
})

// 2) absolute-row offset (range starts at A2 → rowIdx already absolute) still 1:1
t('absolute offset rows map 1:1', () => {
  const p = prods(71, 72, 73)
  assignImages(p, [anchor(71, 71, 'x'), anchor(72, 72, 'y'), anchor(73, 73, 'z')])
  assert.deepEqual(p.map((x) => x.image), ['x', 'y', 'z'])
})

// 3) CASCADE GUARD: a product without its own anchor must NOT steal a later
//    row's exact anchor. Two-pass locks exacts first.
t('variant without anchor does not steal the next exact', () => {
  // row 60 has exact 'A'; row 61 has NO exact; row 62 has exact 'B'
  const p = prods(60, 61, 62)
  assignImages(p, [anchor(60, 60, 'A'), anchor(62, 62, 'B'), anchor(63, 64, 'spare')])
  assert.equal(p[0].image, 'A', 'row 60 keeps its exact')
  assert.equal(p[2].image, 'B', 'row 62 keeps its exact (not stolen by row 61)')
  assert.ok(p[1].image === 'spare' || p[1].image === null, 'row 61 falls back to a leftover')
})

// 4) span/nearby fallback for a twoCellAnchor that sits a row off
t('fallback by span when no exact', () => {
  const p = prods(20)
  assignImages(p, [anchor(19, 21, 'span')]) // span covers row 20
  assert.equal(p[0].image, 'span')
})

// 5) header/decoration image above the first product matches nothing
t('decoration above first row is ignored', () => {
  const p = prods(10)
  assignImages(p, [anchor(2, 2, 'logo'), anchor(10, 10, 'real')])
  assert.equal(p[0].image, 'real')
})

console.log(`\nparseXlsx: ${passed} tests passed`)
