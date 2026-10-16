import { expect, test } from 'claude-code/testing'

const PANE = { component: 'Pane', requestId: 'sprint', props: { title: 'Sprint', isFocused: true, bodyColumns: 80, placement: 'dock' } as never } as const

test('senza piano propone l\'analisi', async $ => {
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'gestione-sprint', surface, ...PANE })
    expect(await ui.find({ key: 'principale' })).toBeDefined()
    await ui.unmount()
  }
})
