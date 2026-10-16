// Indicatore grafico del contesto. Solo funzioni pure.
//
// Usato in tre punti: la banda sopra il prompt, la riga di stato e il pannello /contesto.

import { formatTokens, type Level } from './logic'

export type BarStyle = 'blocchi' | 'ascii'

/** Dove mostrare l'indicatore: banda sopra il prompt, riga di stato, entrambe o nessuna. */
export type MeterMode = 'entrambi' | 'banda' | 'stato' | 'spento'

export const asMeterMode = (value: unknown): MeterMode =>
  value === 'banda' || value === 'stato' || value === 'spento' ? value : 'entrambi'

export const asBarStyle = (value: unknown): BarStyle => (value === 'ascii' ? 'ascii' : 'blocchi')

const clamp = (percent: number): number => Math.min(100, Math.max(0, percent))

/**
 * La barra: `width` celle piene in proporzione alla percentuale.
 * Sotto l'1% resta vuota; sopra lo 0% e sotto una cella ne mostra comunque una.
 */
export const meterBar = (percent: number, width = 20, style: BarStyle = 'blocchi'): string => {
  const exact = (clamp(percent) / 100) * width
  const full = percent >= 1 ? Math.max(1, Math.round(exact)) : 0
  const [on, off] = style === 'ascii' ? ['#', '-'] : ['█', '░']

  return on.repeat(Math.min(width, full)) + off.repeat(width - Math.min(width, full))
}

/** Colore del tema per il livello: verde, giallo, rosso. */
export const meterColor = (level: Level): 'success' | 'warning' | 'error' =>
  level === 2 ? 'error' : level === 1 ? 'warning' : 'success'

/** Parola breve per il livello. */
export const levelWord = (level: Level): string =>
  level === 2 ? 'pieno: meglio una sessione nuova' : level === 1 ? 'attenzione' : 'ok'

/** Il dettaglio dei token: "84k/200k · liberi 116k". */
export const tokenDetail = (tokens: number | undefined, window: number): string =>
  tokens === undefined
    ? `finestra ${formatTokens(window)}`
    : `${formatTokens(tokens)}/${formatTokens(window)} · liberi ${formatTokens(Math.max(0, window - tokens))}`

/** La riga di stato compatta: "Contesto ▕████░░░░░░▏ 42% 84k/200k". */
export const statusMeter = (
  percent: number,
  tokens: number | undefined,
  window: number,
  level: Level,
  style: BarStyle = 'blocchi',
): string => {
  const detail = tokens === undefined ? '' : ` ${formatTokens(tokens)}/${formatTokens(window)}`
  const hint = level === 2 ? ' - meglio una nuova sessione' : level === 1 ? ' - attenzione' : ''
  const [open, close] = style === 'ascii' ? ['[', ']'] : ['▕', '▏']

  return `Contesto ${open}${meterBar(percent, 10, style)}${close} ${Math.round(percent)}%${detail}${hint}`
}

/** Il limite del piano più vicino al tetto, se c'è (es. finestra di 5 ore). */
export type PlanLimit = { kind: string; percentUsed: number }

export const busiestLimit = (limits: readonly PlanLimit[]): PlanLimit | undefined =>
  limits.slice().sort((a, b) => b.percentUsed - a.percentUsed)[0]

/** Nome leggibile della finestra del piano. */
export const limitLabel = (kind: string): string => {
  const key = kind.toLowerCase()

  if (key.includes('five') || key.includes('5h') || key.includes('session')) {
    return 'piano 5h'
  }
  if (key.includes('opus')) {
    return 'piano settimana (Opus)'
  }
  if (key.includes('seven') || key.includes('week') || key.includes('7d')) {
    return 'piano settimana'
  }

  return `piano ${kind}`
}

/** Il valore mostrato quando il contesto non è ancora misurato. */
export type Meter = {
  percent: number
  tokens?: number
  window: number
  limit?: PlanLimit
}

/** Riga di testo con le voci del pannello: nome, barra e token. */
export const categoryLine = (
  name: string,
  tokens: number,
  window: number,
  nameWidth: number,
  style: BarStyle = 'blocchi',
): string => {
  const percent = window > 0 ? (tokens / window) * 100 : 0
  const label = name.length > nameWidth ? `${name.slice(0, nameWidth - 1)}…` : name.padEnd(nameWidth)

  return `${label} ${meterBar(percent, 16, style)} ${formatTokens(tokens).padStart(5)} ${percent.toFixed(1).padStart(5)}%`
}
