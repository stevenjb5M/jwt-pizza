#!/bin/bash
# Runs the k6 stress test against three setups of jwt-pizza-service, twice each:
# no tracing, 100% sampling, and 10% sampling.
# Usage: SERVICE_DIR=~/jwt-pizza-service/src ./runTracingCost.sh
HERE=$(cd "$(dirname "$0")" && pwd)
cd "${SERVICE_DIR:?set SERVICE_DIR to jwt-pizza-service/src}"

startService() {
  pkill -f "index.js 3000"; sleep 1
  case $1 in
    none)  (node index.js 3000 > /dev/null 2>&1 &) ;;
    all)   (node --require ./tracing.js index.js 3000 > /dev/null 2>&1 &) ;;
    tenth) (OTEL_TRACES_SAMPLER=traceidratio OTEL_TRACES_SAMPLER_ARG=0.1 node --require ./tracing.js index.js 3000 > /dev/null 2>&1 &) ;;
  esac
  for i in $(seq 1 30); do curl -s localhost:3000/ > /dev/null && return; sleep 1; done
}

for round in 1 2; do
  for mode in none all tenth; do
    startService $mode
    k6 run --quiet --summary-export "$HERE/k6-$mode-$round.json" "$HERE/tracingCost.js" > /dev/null 2>&1
    node -e '
      const m = require(process.argv[1]).metrics;
      const d = m["http_req_duration{expected_response:true}"] || m.http_req_duration;
      console.log(process.argv[2].padEnd(6), "round", process.argv[3],
        "| req/s", m.http_reqs.rate.toFixed(0).padStart(5),
        "| avg", d.avg.toFixed(1).padStart(6), "ms",
        "| p95", d["p(95)"].toFixed(1).padStart(6), "ms",
        "| failed", (m.http_req_failed.value * 100).toFixed(1) + "%");
    ' "$HERE/k6-$mode-$round.json" $mode $round
  done
done
