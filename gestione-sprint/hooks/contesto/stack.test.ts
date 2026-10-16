import { expect, test } from 'claude-code/testing'

import { blockedDirIn } from './logic'
import {
  claudeMdSnippet,
  detectProfiles,
  dirsFor,
  dumpedFiles,
  heavyKindOf,
  heavyRemedy,
  isSecretFile,
  quietPytest,
  resolvePath,
  stackHintFor,
} from './stack'

test('riconosce Laravel, PHP e Python dai file del progetto', () => {
  expect(detectProfiles(new Set(['artisan', 'composer.json']), 'auto')).toEqual(['laravel'])
  expect(detectProfiles(new Set(['composer.json']), 'auto')).toEqual(['php'])
  expect(detectProfiles(new Set(['pyproject.toml']), 'auto')).toEqual(['python'])
  expect(detectProfiles(new Set(['artisan', 'requirements.txt']), 'auto')).toEqual(['laravel', 'python'])
  expect(detectProfiles(new Set(), 'auto')).toEqual([])
})

test('rispetta il profilo scelto nelle opzioni', () => {
  expect(detectProfiles(new Set(['artisan']), 'python')).toEqual(['python'])
  expect(detectProfiles(new Set(['artisan']), 'generico')).toEqual([])
})

test('Laravel: blocca vendor e le cache, lascia leggibili i log e il codice', () => {
  const dirs = dirsFor(['node_modules'], ['laravel'])

  expect(blockedDirIn('/app/vendor/laravel/framework/src/Foo.php', dirs)).toBe('vendor')
  expect(blockedDirIn('/app/storage/framework/views/abc.php', dirs)).toBe('storage/framework')
  expect(blockedDirIn('/app/bootstrap/cache/config.php', dirs)).toBe('bootstrap/cache')
  expect(blockedDirIn('/app/public/build/assets/app.js', dirs)).toBe('public/build')
  expect(blockedDirIn('/app/storage/logs/laravel.log', dirs)).toBe(undefined)
  expect(blockedDirIn('/app/app/Http/Controllers/UserController.php', dirs)).toBe(undefined)
  expect(blockedDirIn('/app/resources/views/framework.blade.php', dirs)).toBe(undefined)
})

test('Python: blocca ambienti virtuali, cache e pacchetti installati', () => {
  const dirs = dirsFor([], ['python'])

  expect(blockedDirIn('/p/.venv/lib/python3.12/site-packages/x.py', dirs)).toBe('.venv')
  expect(blockedDirIn('/p/src/mio_pacchetto.egg-info/PKG-INFO', dirs)).toBe('*.egg-info')
  expect(blockedDirIn('/p/.pytest_cache/v/cache', dirs)).toBe('.pytest_cache')
  expect(blockedDirIn('/p/src/app/main.py', dirs)).toBe(undefined)
})

test('riconosce i file pesanti per tipo', () => {
  expect(heavyKindOf('storage/logs/laravel.log')).toBe('log')
  expect(heavyKindOf('storage/logs/laravel-2026-10-15.log')).toBe('log')
  expect(heavyKindOf('/app/composer.lock')).toBe('lock')
  expect(heavyKindOf('poetry.lock')).toBe('lock')
  expect(heavyKindOf('_ide_helper.php')).toBe('generated')
  expect(heavyKindOf('public/js/app.min.js')).toBe('minified')
  expect(heavyKindOf('dump.sql')).toBe('data')
  expect(heavyKindOf('analisi.ipynb')).toBe('notebook')
  expect(heavyKindOf('app/Models/User.php')).toBe(undefined)
  expect(heavyKindOf('composer.json')).toBe(undefined)
})

test('dà il rimedio giusto per il tipo di lock', () => {
  expect(heavyRemedy('lock', 'composer.lock')).toContain('composer show')
  expect(heavyRemedy('lock', 'package-lock.json')).toContain('npm ls')
  expect(heavyRemedy('lock', 'poetry.lock')).toContain('pip show')
  expect(heavyRemedy('log', 'storage/logs/laravel.log')).toContain('tail -n 100 storage/logs/laravel.log')
})

test('suggerimenti per comandi che stampano elenchi enormi', () => {
  expect(stackHintFor('php artisan route:list')?.message).toContain('--path=')
  expect(stackHintFor('php artisan route:list --path=api')).toBe(undefined)
  expect(stackHintFor('php artisan route:list --except-vendor')).toBe(undefined)
  expect(stackHintFor('composer show')?.message).toContain('composer show <vendor/pacchetto>')
  expect(stackHintFor('composer show laravel/framework')).toBe(undefined)
  expect(stackHintFor('npm ls')?.message).toContain('--depth=0')
  expect(stackHintFor('npm ls --depth=0')).toBe(undefined)
  expect(stackHintFor('php artisan migrate')).toBe(undefined)
})

test('pytest con meno output, solo quando è davvero pytest', () => {
  expect(quietPytest('pytest')).toBe('pytest -q --tb=short')
  expect(quietPytest('pytest tests/test_api.py')).toBe('pytest tests/test_api.py -q --tb=short')
  expect(quietPytest('python -m pytest')).toBe('python -m pytest -q --tb=short')
  expect(quietPytest('uv run pytest -k login')).toBe('uv run pytest -k login -q --tb=short')
  expect(quietPytest('pytest -v')).toBe(undefined)
  expect(quietPytest('pytest --tb=long')).toBe(undefined)
  expect(quietPytest('pip install pytest')).toBe(undefined)
  expect(quietPytest('pytest && echo ok')).toBe(undefined)
})

test('trova i file stampati per intero', () => {
  expect(dumpedFiles('cat storage/logs/laravel.log')).toEqual(['storage/logs/laravel.log'])
  expect(dumpedFiles('cat storage/logs/laravel.log | grep ERROR')).toEqual([])
  expect(dumpedFiles('tail -n 100 storage/logs/laravel.log')).toEqual([])
})

test('riconosce i file con credenziali, non i modelli', () => {
  expect(isSecretFile('/app/.env')).toBe(true)
  expect(isSecretFile('/app/.env.production')).toBe(true)
  expect(isSecretFile('C:\\app\\.env.testing')).toBe(true)
  expect(isSecretFile('/app/storage/oauth-private.key')).toBe(true)
  expect(isSecretFile('/app/.env.example')).toBe(false)
  expect(isSecretFile('/app/config/env.php')).toBe(false)
  expect(isSecretFile('/app/app/Services/KeyService.php')).toBe(false)
})

test('CLAUDE.md breve per il profilo giusto', () => {
  const laravel = claudeMdSnippet(['laravel', 'php'])

  expect(laravel).toContain('php artisan test')
  expect(laravel).not.toContain('## PHP')
  expect(claudeMdSnippet(['python'])).toContain('pytest -q')
  expect(claudeMdSnippet([])).toContain('mai .env')
  expect(laravel.split('\n').length).toBeLessThan(20)
})

test('git log senza limite riceve un suggerimento', () => {
  expect(stackHintFor('git log')?.message).toContain('--oneline -20')
  expect(stackHintFor('git log --oneline -20')).toBe(undefined)
  expect(stackHintFor('git log -n 5')).toBe(undefined)
  expect(stackHintFor('git log main..HEAD')).toBe(undefined)
})

test('risolve i percorsi rispetto alla cartella di lavoro', () => {
  expect(resolvePath('/app', 'storage/logs/laravel.log')).toBe('/app/storage/logs/laravel.log')
  expect(resolvePath('/app/', './composer.lock')).toBe('/app/composer.lock')
  expect(resolvePath('C:\\progetti\\app', 'composer.lock')).toBe('C:\\progetti\\app\\composer.lock')
  expect(resolvePath('/app', '/etc/hosts')).toBe('/etc/hosts')
  expect(resolvePath('/app', '~/file.log')).toBe(undefined)
})
