import { expect, test } from 'claude-code/testing'

import { busiestLimit, categoryLine, limitLabel, meterBar, meterColor, statusMeter, tokenDetail } from './meter'

test('la barra è proporzionale alla percentuale', () => {
  expect(meterBar(0, 10)).toBe('░░░░░░░░░░')
  expect(meterBar(50, 10)).toBe('█████░░░░░')
  expect(meterBar(100, 10)).toBe('██████████')
  expect(meterBar(130, 10)).toBe('██████████')
  // sopra l'1% almeno una cella piena
  expect(meterBar(2, 10)).toBe('█░░░░░░░░░')
  expect(meterBar(42, 10, 'ascii')).toBe('####------')
})

test('colore per livello', () => {
  expect(meterColor(0)).toBe('success')
  expect(meterColor(1)).toBe('warning')
  expect(meterColor(2)).toBe('error')
})

test('riga di stato con la barra', () => {
  expect(statusMeter(42, 84000, 200000, 0)).toBe('Contesto ▕████░░░░░░▏ 42% 84k/200k')
  expect(statusMeter(85, 170000, 200000, 2, 'ascii')).toBe('Contesto [#########-] 85% 170k/200k - meglio una nuova sessione')
})

test('token usati e liberi', () => {
  expect(tokenDetail(84000, 200000)).toBe('84k/200k · liberi 116k')
  expect(tokenDetail(undefined, 200000)).toBe('finestra 200k')
})

test('limite del piano più vicino al tetto', () => {
  const limit = busiestLimit([{ kind: 'seven_day', percentUsed: 20 }, { kind: 'five_hour', percentUsed: 61 }])

  expect(limit?.kind).toBe('five_hour')
  expect(limitLabel('five_hour')).toBe('piano 5h')
  expect(limitLabel('seven_day')).toBe('piano settimana')
  expect(busiestLimit([])).toBeUndefined()
})

test('riga del pannello allineata', () => {
  const line = categoryLine('Messages', 50000, 200000, 12)

  expect(line.startsWith('Messages     ████')).toBe(true)
  expect(line).toContain('50k')
  expect(line).toContain('25.0%')
})
