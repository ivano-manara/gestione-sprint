import { expect, test } from 'claude-code/testing'

import {
  adviceFor,
  blockedDirIn,
  blockedDirInCommand,
  compactSummary,
  formatTokens,
  isSizeChecked,
  levelOf,
  parseList,
  searchedPaths,
  shouldAutoCompact,
  statusText,
  topRows,
} from './logic'

const DIRS = parseList('node_modules, dist, .git, build, bin')

test('riconosce una cartella esclusa nel percorso', () => {
  expect(blockedDirIn('/app/node_modules/react/index.js', DIRS)).toBe('node_modules')
  expect(blockedDirIn('C:\\progetto\\dist\\main.js', DIRS)).toBe('dist')
  expect(blockedDirIn('/app/src/distribuzione.ts', DIRS)).toBe(undefined)
  expect(blockedDirIn('/app/.github/workflows/ci.yml', DIRS)).toBe(undefined)
})

test("un'esclusione (!...) non è un accesso", () => {
  expect(blockedDirIn('!**/node_modules/**', DIRS)).toBe(undefined)
})

test('blocca letture e ricerche nelle cartelle escluse', () => {
  expect(blockedDirInCommand('grep -r foo node_modules/', DIRS)).toBe('node_modules')
  expect(blockedDirInCommand('ls ./build', DIRS)).toBe('build')
  expect(blockedDirInCommand('ls dist', DIRS)).toBe('dist')
  expect(blockedDirInCommand('find node_modules -name "*.d.ts"', DIRS)).toBe('node_modules')
  expect(blockedDirInCommand('npm test && cat dist/main.js | head -5', DIRS)).toBe('dist')
  expect(blockedDirInCommand('sudo du -sh node_modules', DIRS)).toBe('node_modules')
  expect(blockedDirInCommand('/usr/bin/grep foo build/out.log', DIRS)).toBe('build')
})

test('non blocca comandi che non leggono le cartelle escluse', () => {
  expect(blockedDirInCommand('rm -rf node_modules', DIRS)).toBe(undefined)
  expect(blockedDirInCommand('npm run build', DIRS)).toBe(undefined)
  expect(blockedDirInCommand('git commit -m "more fixes in build"', DIRS)).toBe(undefined)
  expect(blockedDirInCommand('npm run type-check && echo dist', DIRS)).toBe(undefined)
  expect(blockedDirInCommand('echo "look at the dist folder" | head -1', DIRS)).toBe(undefined)
  expect(blockedDirInCommand('grep -r build src', DIRS)).toBe(undefined)
  expect(blockedDirInCommand('find . -name build', DIRS)).toBe(undefined)
})

test('rispetta le esclusioni esplicite', () => {
  expect(blockedDirInCommand('grep -r foo . --exclude-dir=node_modules', DIRS)).toBe(undefined)
  expect(blockedDirInCommand('find . -name node_modules -prune -o -print', DIRS)).toBe(undefined)
})

test('estrae i percorsi giusti per ogni comando', () => {
  expect(searchedPaths('rg -n TODO src lib')).toEqual(['src', 'lib'])
  expect(searchedPaths('cat a.txt b.txt')).toEqual(['a.txt', 'b.txt'])
  expect(searchedPaths('find src test -type f')).toEqual(['src', 'test'])
  expect(searchedPaths('git status')).toEqual([])
})

test('livelli e testo della barra di stato', () => {
  expect(levelOf(30, 60, 80)).toBe(0)
  expect(levelOf(65, 60, 80)).toBe(1)
  expect(levelOf(85, 60, 80)).toBe(2)
  expect(formatTokens(84000)).toBe('84k')
  expect(statusText(42, 84000, 200000, 0)).toBe('Contesto 42% (84k/200k)')
})

test('non limita immagini e pdf per dimensione', () => {
  expect(isSizeChecked('/x/foto.PNG')).toBe(false)
  expect(isSizeChecked('/x/dati.csv')).toBe(true)
})

test('ordina le voci più pesanti e scarta quelle vuote', () => {
  const rows = [
    { name: 'a', tokens: 10 },
    { name: 'b', tokens: 500 },
    { name: 'c', tokens: 0 },
    { name: 'd', tokens: 200 },
  ]

  expect(topRows(rows, 2).map(row => row.name)).toEqual(['b', 'd'])
})

test('dà un consiglio per le categorie su cui si può agire', () => {
  expect(adviceFor('Messages')).toContain('/alleggerisci')
  expect(adviceFor('MCP tools')).toContain('MCP')
  expect(adviceFor('System prompt')).toBe(undefined)
  expect(adviceFor('Colore sconosciuto')).toBe(undefined)
})

test('la compattazione automatica è spenta a zero e scatta una volta', () => {
  expect(shouldAutoCompact(95, 0, false)).toBe(false)
  expect(shouldAutoCompact(85, 90, false)).toBe(false)
  expect(shouldAutoCompact(92, 90, false)).toBe(true)
  expect(shouldAutoCompact(92, 90, true)).toBe(false)
})

test('riassume il risultato della compattazione', () => {
  expect(compactSummary(150000, 30000)).toBe('Sessione compattata: da 150k a 30k token.')
  expect(compactSummary()).toBe('Sessione compattata.')
})
