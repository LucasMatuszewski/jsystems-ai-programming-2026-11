#!/bin/bash
# One spec per Playwright invocation (T27). Each run has a 15 min limit and its own log.
cd "$(dirname "$0")/../../../app" || exit 1
export E2E_SERVER_LOG=../docs/qa/T27/server.log
for p in desktop mobile; do
  for s in smoke return-flow complaint-flow date-rule chat session form-validation; do
    [ "$p-$s" = desktop-form-validation ] && continue
    timeout 15m pnpm exec playwright test --project=$p $s.spec.ts --global-timeout=900000 > ../docs/qa/T27/e2e-$p-$s.log 2>&1
    echo "$p $s exit $?" >> ../docs/qa/T27/spec-summary.txt
  done
done
echo DONE >> ../docs/qa/T27/spec-summary.txt
