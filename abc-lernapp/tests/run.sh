#!/bin/sh
# One command: rebuild index.html, run the whole Playwright suite on all iPad viewports,
# print a compact summary (also saved to tests/results/summary.txt).
#
#   ./tests/run.sh                         # everything
#   ./tests/run.sh --project=ipad-mini     # extra args go to `playwright test`
#   SELECTOR_MODE=testid ./tests/run.sh    # enforce the data-testid contract (redesign)
#   NET=offline ./tests/run.sh             # block all external requests in every test
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
cd "$HERE/.."
./build.sh
echo "built index.html ($(wc -c < index.html) bytes)"
cd "$HERE"
if [ ! -d node_modules/@playwright/test ]; then
  echo "installing test dependencies…"
  npm install --no-audit --no-fund --silent
fi
# use the preinstalled Chromium; never download browsers here
export PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-/opt/pw-browsers}"
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
rm -rf screens results
mkdir -p screens results
set +e
npx playwright test "$@" > results/run.log 2>&1
STATUS=$?
set -e
# The summary reporter writes results/summary.txt; show it (the full log is in results/run.log)
cat results/summary.txt 2>/dev/null || tail -50 results/run.log
echo
echo "screenshots: $HERE/screens/<project>/   full log: $HERE/results/run.log   traces: npx playwright show-report / show-trace"
exit $STATUS
