// Bina database ke chalne wala test: itemized entry ka hisaab.
const test = require('node:test')
const assert = require('node:assert/strict')
const { parseLines, toRow } = require('../src/items')

test('items: total server nikaalta hai', () => {
  const r = parseLines([{ name: 'दूध', qty: 2.5, rate: 56, unit: 'litre' }, { name: 'ब्रेड', qty: 1, rate: 40.5, unit: 'packet' }])
  assert.equal(r.total, 180.5)
  assert.deepEqual(toRow(r.items[0]), { name: 'दूध', qty: 2.5, rate: 56, unit: 'litre', amount: 140 })
})
test('items: galat input mana', () => {
  for (const bad of [[], null, [{ name: '', qty: 1, rate: 1 }], [{ name: 'a', qty: 0, rate: 1 }], [{ name: 'a', qty: 1, rate: -1 }], [{ name: 'a', qty: 1, rate: 1, unit: 'bad' }], Array(21).fill({ name: 'a', qty: 1, rate: 1 })])
    assert.equal(parseLines(bad).error, 'bad_items')
})
