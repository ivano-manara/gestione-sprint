import { expect, test } from 'claude-code/testing'

import {
  dedupeRepeated,
  compressOutput,
  familyOf,
  foldNumberLists,
  isNumericLine,
  levelFor,
  slimLangChainRepr,
  truncateTraceBlocks,
} from './compress'
import { langVersions, langchainGuide, versionFromRequirements, versionFromTomlLock } from './langchain'
import { claudeMdSnippet, detectProfiles, dirsFor, heavyKindOf, mentionsLangChain, stackHintFor } from './stack'

// ---- Output realistici di LangChain e LangGraph ----

const AI_MESSAGE =
  "{'agent': {'messages': [AIMessage(content='Ecco la risposta sul cliente.', additional_kwargs={'refusal': None, 'tool_calls': [{'id': 'call_1', 'type': 'function'}]}, " +
  "response_metadata={'token_usage': {'completion_tokens': 120, 'prompt_tokens': 2400, 'total_tokens': 2520}, 'model_name': 'gpt-4o', 'system_fingerprint': 'fp_x', 'finish_reason': 'stop', 'logprobs': None}, " +
  "id='run-1f2e3d4c-aaaa-bbbb-cccc-1234567890ab-0', usage_metadata={'input_tokens': 2400, 'output_tokens': 120, 'total_tokens': 2520})]}}"

const EMBEDDING = `[${Array.from({ length: 1536 }, (_, n) => (Math.sin(n) / 10).toFixed(6)).join(', ')}]`

const DEBUG_TRACE = [
  '[chain/start] [chain:RunnableSequence] Entering Chain run with input:',
  '{',
  ...Array.from({ length: 80 }, (_, n) => `  "campo_${n}": "valore ${n}",`),
  '}',
  '[llm/error] [chain:RunnableSequence > llm:ChatOpenAI] [1.20s] LLM run errored with error:',
  '"RateLimitError(\'Rate limit reached\')"',
].join('\n')

const PYTEST_WARNINGS = [
  '============================= warnings summary =============================',
  ...Array.from({ length: 40 }, (_, n) => [
    `tests/test_agent.py::test_caso_${n}`,
    '  /p/.venv/lib/python3.12/site-packages/langchain_core/_api/deprecation.py:117: LangChainDeprecationWarning: The class `LLMChain` was deprecated in LangChain 0.1.17 and will be removed in 1.0.',
    '    warnings.warn(',
  ]).flat(),
  '-- Docs: https://docs.pytest.org/en/stable/how-to/capture-warnings.html',
  '======================= 40 passed, 40 warnings in 3.20s ========================',
].join('\n')

test('LangChain: via metadati e id dai messaggi, resta il contenuto', () => {
  const slim = slimLangChainRepr(AI_MESSAGE)

  expect(slim).toContain("AIMessage(content='Ecco la risposta sul cliente.'")
  expect(slim).not.toContain('response_metadata')
  expect(slim).not.toContain('usage_metadata')
  expect(slim).not.toContain('additional_kwargs')
  expect(slim).not.toContain('run-1f2e3d4c')
  expect(slim.length).toBeLessThan(AI_MESSAGE.length / 3)
  expect(slim.endsWith(')]}}')).toBe(true)
})

test('LangChain: i testi lunghi nei messaggi si accorciano', () => {
  const long = `HumanMessage(content='${'parola '.repeat(400)}')`

  expect(slimLangChainRepr(long)).toContain('caratteri]')
  expect(slimLangChainRepr('nessun messaggio qui')).toBe('nessun messaggio qui')
})

test('embedding e liste di numeri diventano un conteggio', () => {
  const folded = foldNumberLists(`vettore: ${EMBEDDING}`)

  expect(folded).toContain('1536 numeri')
  expect(folded.length).toBeLessThan(80)
  expect(foldNumberLists('[1, 2, 3]')).toBe('[1, 2, 3]')
  expect(isNumericLine('  0.123  -0.44  1.5e-3  0.9  0.1 ')).toBe(true)
  expect(isNumericLine('riga 1 2 3 4 5')).toBe(false)
})

test('tracciati di set_debug: blocchi lunghi accorciati, errori interi', () => {
  const lines = truncateTraceBlocks(DEBUG_TRACE.split('\n'))

  expect(lines.join('\n')).toContain('righe del tracciato omesse')
  expect(lines.join('\n')).toContain("RateLimitError('Rate limit reached')")
  expect(lines.length).toBeLessThan(25)
})

test('pytest: lo stesso avviso ripetuto resta una volta con il conteggio', () => {
  const result = compressOutput(PYTEST_WARNINGS, 'full', 500)

  expect(result.text).toContain('LangChainDeprecationWarning')
  expect(result.text).toContain('ripetuto 40 volte')
  expect(result.text).toContain('40 passed, 40 warnings')
  expect(result.linesAfter).toBeLessThan(15)
})

test('lo stesso errore identico: restano le prime tre volte, senza i suoi frame', () => {
  const block = (n: number) => [
    `[2026-10-16 09:0${n}:00] local.ERROR: Connessione al database fallita`,
    '#0 /app/vendor/laravel/framework/src/Db.php(10): connect()',
    '#1 {main}',
  ]
  const lines = dedupeRepeated(Array.from({ length: 8 }, (_, n) => block(n)).flat())
  const errors = lines.filter(line => line.includes('local.ERROR'))

  expect(errors.length).toBe(3)
  expect(errors[0]).toContain('ripetuto 8 volte')
  expect(lines.length).toBe(9)
})

test('errori diversi restano tutti', () => {
  const lines = ['ERROR riga numero 1 diversa', 'ERROR riga numero 2 diversa', 'ERROR riga numero 3 diversa', 'ERROR riga numero 4 diversa']

  expect(dedupeRepeated(lines)).toEqual(lines)
})

test('pip: righe della stessa famiglia raggruppate anche al livello leggero', () => {
  expect(familyOf('Requirement already satisfied: langchain in ./.venv')).toBe('§Requirement already satisfied')
  const pip = [
    ...Array.from({ length: 60 }, (_, n) => `Requirement already satisfied: pacchetto${String.fromCharCode(97 + (n % 26))}x in /p/.venv/lib/python3.12/site-packages (from langgraph) (1.${n}.0)`),
    'Successfully installed langgraph-1.0.2',
  ].join('\n')
  const result = compressOutput(pip, 'light', 500)

  expect(result.text).toContain('righe simili omesse')
  expect(result.text).toContain('Successfully installed langgraph-1.0.2')
})

test('livelli: linter Python, PHP e LangGraph CLI sono rumorosi', () => {
  expect(levelFor('ruff check .')).toBe('full')
  expect(levelFor('uv run mypy src')).toBe('full')
  expect(levelFor('vendor/bin/php-cs-fixer fix --dry-run')).toBe('full')
  expect(levelFor('langgraph dev')).toBe('full')
  expect(levelFor('python agent.py')).toBe('light')
})

test('output di un agente: compressione al livello leggero', () => {
  const output = [AI_MESSAGE, AI_MESSAGE, `embedding: ${EMBEDDING}`, 'Fine.'].join('\n')
  const result = compressOutput(output, 'light', 500)

  expect(result.isChanged).toBe(true)
  expect(result.text).toContain('Ecco la risposta sul cliente.')
  expect(result.text).toContain('1536 numeri')
  expect(result.text).toContain('Fine.')
})

// ---- Profilo LangChain ----

test('riconosce LangChain dalle dipendenze e da langgraph.json', () => {
  expect(mentionsLangChain('dependencies = [\n  "langchain-openai>=0.2",\n  "fastapi"\n]')).toBe(true)
  expect(mentionsLangChain('langgraph==1.0.2\nrequests')).toBe(true)
  expect(mentionsLangChain('requests\nflask')).toBe(false)
  expect(detectProfiles(new Set(['langgraph.json']), 'auto')).toEqual(['python', 'langchain'])
  expect(detectProfiles(new Set(), 'langchain')).toEqual(['python', 'langchain'])
})

test('LangChain: cartelle dei vector store escluse, file binari pesanti', () => {
  const dirs = dirsFor([], ['python', 'langchain'])

  expect(dirs).toContain('chroma_db')
  expect(dirs).toContain('.langgraph_api')
  expect(heavyKindOf('indici/clienti.faiss')).toBe('binary')
  expect(heavyKindOf('modelli/pesi.safetensors')).toBe('binary')
  expect(claudeMdSnippet(['python', 'langchain'])).toContain('draw_mermaid')
})

test('suggerimenti per pip list e artisan list', () => {
  expect(stackHintFor('pip list')?.message).toContain('pip show')
  expect(stackHintFor('uv pip freeze')?.message).toContain('pip show')
  expect(stackHintFor('pip list | grep lang')).toBeUndefined()
  expect(stackHintFor('php artisan list')?.message).toContain('artisan list <gruppo>')
  expect(stackHintFor('php artisan list make')).toBeUndefined()
})

test('versioni di LangChain e LangGraph da lock e dipendenze', () => {
  const lock = '[[package]]\nname = "langgraph"\nversion = "1.0.2"\n\n[[package]]\nname = "langchain"\nversion = "1.0.5"\n'

  expect(versionFromTomlLock(lock, 'langgraph')).toEqual({ major: 1, minor: 0 })
  expect(versionFromRequirements('langchain-core>=0.3.15\n', 'langchain-core')).toEqual({ major: 0, minor: 3 })
  expect(versionFromRequirements('"langchain[openai]==0.2.1"', 'langchain')).toEqual({ major: 0, minor: 2 })
  expect(langVersions(undefined, 'langchain-core~=0.3.0')).toEqual({ langchain: { major: 0, minor: 3 }, langgraph: undefined })
})

test('guida adatta alla versione di LangChain', () => {
  const v1 = langchainGuide({ langchain: { major: 1, minor: 0 }, langgraph: { major: 1, minor: 0 } })

  expect(v1).toContain('create_agent')
  expect(v1).toContain('langchain-classic')
  expect(langchainGuide({ langchain: { major: 0, minor: 3 } })).toContain('LCEL')
  expect(langchainGuide({})).toContain('non rilevata')
})
