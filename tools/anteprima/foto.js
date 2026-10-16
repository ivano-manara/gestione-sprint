const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(async () => chromium.launch());
  const p = await b.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2 });
  await p.goto('file://' + process.argv[2]);
  const divs = await p.$$('body > div');
  for (const d of divs) {
    const name = await d.$eval('div', e => e.textContent);
    const pre = await d.$('pre');
    await pre.screenshot({ path: `${process.argv[3]}/${name}.png` });
  }
  await b.close();
})();
