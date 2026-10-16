// Versioni di LangChain e LangGraph e guida breve per il modello. Solo funzioni pure.
//
// Fonti verificate:
// - LangChain 1.0 e LangGraph 1.0 (ottobre 2025, blog ufficiale LangChain).
// - In 1.0: create_react_agent di langgraph.prebuilt è deprecato a favore di
//   create_agent di langchain.agents; le catene storiche sono nel pacchetto langchain-classic.
// - L'API del grafo (StateGraph, stream, checkpoint) resta la stessa in LangGraph 1.0.

export type PackageVersion = { major: number; minor: number }

export type LangVersions = { langchain?: PackageVersion; langgraph?: PackageVersion }

const parse = (text: string | undefined): PackageVersion | undefined => {
  const match = text?.match(/(\d+)\.(\d+)/)

  return match === null || match === undefined ? undefined : { major: Number(match[1]), minor: Number(match[2]) }
}

const escape = (name: string): string => name.replace(/[-_]/g, '[-_]')

/** Versione esatta da un lock in formato TOML (uv.lock, poetry.lock): `name = "x"` seguito da `version = "1.2.3"`. */
export const versionFromTomlLock = (lockText: string, name: string): PackageVersion | undefined =>
  parse(lockText.match(new RegExp(String.raw`name\s*=\s*"${escape(name)}"\s*\r?\nversion\s*=\s*"([^"]+)"`, 'i'))?.[1])

/** Versione indicativa da requirements.txt o pyproject.toml (es. `langgraph>=1.0` o `"langchain==0.3.27"`). */
export const versionFromRequirements = (text: string, name: string): PackageVersion | undefined =>
  parse(
    // pip, uv, PEP 621: langgraph>=1.0, "langchain[openai]==0.2.1"
    text.match(new RegExp(String.raw`(^|["'\s,\[])${escape(name)}(\[[^\]]*\])?\s*(==|>=|~=|\^|>)\s*["']?(\d+\.\d+)`, 'im'))?.[4] ??
      // Poetry: langchain = "^0.3.0" oppure langchain = { version = "^0.3", extras = [...] }
      text.match(new RegExp(String.raw`^\s*${escape(name)}\s*=\s*(\{[^}\n]*version\s*=\s*)?["'][\^~>=<!\s]*(\d+\.\d+)`, 'im'))?.[2],
  )

/** Le due versioni dal lock (esatte) o dalle dipendenze (indicative). */
export const langVersions = (lockText: string | undefined, requirementsText: string | undefined): LangVersions => {
  const find = (name: string) =>
    (lockText === undefined ? undefined : versionFromTomlLock(lockText, name)) ??
    (requirementsText === undefined ? undefined : versionFromRequirements(requirementsText, name))

  return { langchain: find('langchain') ?? find('langchain-core'), langgraph: find('langgraph') }
}

const label = (version: PackageVersion | undefined): string =>
  version === undefined ? 'non rilevata' : `${version.major}.${version.minor}`

/** Poche righe per il prompt di sistema: come lavorare su LangChain/LangGraph consumando poco contesto. */
export const langchainGuide = (versions: LangVersions): string => {
  const lines = [
    `Progetto LangChain/LangGraph (langchain ${label(versions.langchain)}, langgraph ${label(versions.langgraph)}). Indicazioni per usare meno contesto:`,
    '- Versioni e API: "pip show langchain-core langgraph"; per una firma "python -c \\"import inspect, modulo; print(inspect.signature(modulo.funzione))\\"". Non leggere site-packages.',
    '- Struttura del grafo: stampa graph.get_graph().draw_mermaid() invece di leggere tutti i nodi.',
    '- Esecuzioni di prova: stream_mode="updates" (non "values") e stampa solo le chiavi che servono, es. state["messages"][-1].content.',
    '- Debug: niente set_debug(True) o verbose=True su esecuzioni lunghe; usa un input minimo.',
    '- Vector store e indici (.faiss, .npy, .pkl, chroma_db/) non si leggono: interrogali con uno script.',
  ]

  if (versions.langchain !== undefined && versions.langchain.major >= 1) {
    lines.push('- LangChain 1.x: agenti con create_agent di langchain.agents; LLMChain, AgentExecutor e le catene storiche sono in langchain-classic.')
  } else if (versions.langchain !== undefined) {
    lines.push('- LangChain 0.x: preferisci LCEL (prompt | modello | parser) e LangGraph agli oggetti deprecati (LLMChain, AgentExecutor).')
  }

  if (versions.langgraph !== undefined && versions.langgraph.major >= 1) {
    lines.push('- LangGraph 1.x: create_react_agent di langgraph.prebuilt è deprecato; per agenti nuovi usa create_agent di langchain.agents.')
  }

  return lines.join('\n')
}
