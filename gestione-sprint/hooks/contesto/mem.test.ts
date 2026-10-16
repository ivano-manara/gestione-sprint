import { expect, test } from 'claude-code/testing'

import { formatTokens } from './logic'
import {
  NO_MEM,
  findMemTools,
  isOutlineable,
  memGuide,
  memHandoffPrompt,
  memWeightLines,
  observationsHint,
  outlineRemedy,
  parseMemSettings,
  type MemInfo,
} from './mem'

const NAMES = [
  'Read',
  'Bash',
  'mcp__plugin_claude-mem_mcp-search__search',
  'mcp__plugin_claude-mem_mcp-search__timeline',
  'mcp__plugin_claude-mem_mcp-search__get_observations',
  'mcp__plugin_claude-mem_mcp-search__smart_outline',
  'mcp__plugin_claude-mem_mcp-search__smart_unfold',
  'mcp__plugin_claude-mem_mcp-search__save_memory',
  'mcp__altro__search',
]

const MEM: MemInfo = { isActive: true, tools: findMemTools(NAMES), settings: {} }

test('trova gli strumenti di claude-mem con il nome esatto, non quelli di altri server', () => {
  expect(MEM.tools.search).toBe('mcp__plugin_claude-mem_mcp-search__search')
  expect(MEM.tools.smart_outline).toBe('mcp__plugin_claude-mem_mcp-search__smart_outline')
  expect(findMemTools(['mcp__altro__search', 'Read'])).toEqual({})
})

test('legge solo le impostazioni che contano', () => {
  const settings = parseMemSettings('{"CLAUDE_MEM_CONTEXT_OBSERVATIONS":"50","CLAUDE_MEM_FILE_READ_GATE_ENABLED":"false","CLAUDE_MEM_GEMINI_API_KEY":"segreto"}')

  expect(settings).toEqual({ contextObservations: 50, isReadGateOn: false })
  expect(parseMemSettings('non è json')).toEqual({})
})

test('guida con i nomi esatti e il flusso a tre livelli', () => {
  const guide = memGuide(MEM)

  expect(guide).toContain('mcp__plugin_claude-mem_mcp-search__search')
  expect(guide).toContain('get_observations solo sugli id')
  expect(guide).toContain('smart_outline')
  expect(memGuide({ ...NO_MEM, isActive: true })).toContain('search di claude-mem (indice breve)')
})

test('/passaggio con claude-mem salva in memoria', () => {
  expect(memHandoffPrompt(MEM)).toContain('mcp__plugin_claude-mem_mcp-search__save_memory')
})

test('file di codice grandi: smart_outline se claude-mem c\'è', () => {
  expect(isOutlineable('app/Models/Cliente.php')).toBe(true)
  expect(isOutlineable('agente/grafo.py')).toBe(true)
  expect(isOutlineable('docs/manuale.md')).toBe(false)
  expect(outlineRemedy(MEM, 'app/Services/Big.php')).toContain('smart_unfold')
  expect(outlineRemedy(NO_MEM, 'app/Services/Big.php')).toBeUndefined()
  expect(outlineRemedy(MEM, 'dati.json')).toBeUndefined()
})

test('troppe osservazioni in una volta ricevono un suggerimento', () => {
  expect(observationsHint({ ids: Array.from({ length: 20 }, (_, n) => n) })).toContain('20 osservazioni')
  expect(observationsHint({ ids: [1, 2, 3] })).toBeUndefined()
  expect(observationsHint({})).toBeUndefined()
})

test('/peso: peso di claude-mem e consigli sulle impostazioni', () => {
  const lines = memWeightLines({ ...MEM, settings: { contextObservations: 50, isReadGateOn: false } }, 4200, formatTokens)

  expect(lines[0]).toBe('claude-mem: attivo, strumenti MCP 4k.')
  expect(lines.join('\n')).toContain('CLAUDE_MEM_CONTEXT_OBSERVATIONS')
  expect(lines.join('\n')).toContain('CLAUDE_MEM_FILE_READ_GATE_ENABLED=true')
  expect(memWeightLines(NO_MEM, 0, formatTokens)).toEqual([])
})
