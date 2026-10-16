#!/usr/bin/env bash
# Disegna banda e pannello con dati di esempio: anteprima.html e un'immagine per ogni vista in img/.
# Richiede: claude, python3; per le immagini anche node con playwright.
set -euo pipefail
QUI="$(cd "$(dirname "$0")" && pwd)"
MOD="$QUI/../../gestione-sprint"
cp "$QUI/anteprima.test.tsx" "$MOD/hooks/zz_anteprima.test.tsx"
trap 'rm -f "$MOD/hooks/zz_anteprima.test.tsx"' EXIT
(cd "$MOD" && claude plugin test . 2>&1 | grep '^@@' > "$QUI/disegni.txt") || true
python3 -I "$QUI/render.py" "$QUI/disegni.txt" "$QUI/anteprima.html"
if command -v node >/dev/null; then
  mkdir -p "$QUI/img"
  node "$QUI/foto.js" "$QUI/anteprima.html" "$QUI/img" && echo "immagini in $QUI/img"
fi
