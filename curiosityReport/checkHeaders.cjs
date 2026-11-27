// For each traceparent the factory saw, ask Jaeger whether it recorded that trace.
const fs = require('fs');

const headers = fs.readFileSync(process.argv[2], 'utf8').trim().split('\n');
(async () => {
  const rows = [];
  for (const header of headers) {
    const [version, traceId, parentSpanId, flags] = header.split('-');
    const response = await fetch(`http://localhost:16686/api/traces/${traceId}`);
    const trace = response.ok ? (await response.json()).data?.[0] : null;
    const parentSpan = trace?.spans.find((span) => span.spanID === parentSpanId);
    rows.push({ version, flags, inJaeger: Boolean(trace), parentSpan: parentSpan?.operationName ?? '-', traceId: traceId.slice(0, 8) });
  }
  console.table(rows);
  for (const flags of ['01', '00']) {
    const group = rows.filter((row) => row.flags === flags);
    console.log(`flags ${flags}: ${group.length} orders, ${group.filter((row) => row.inJaeger).length} found in Jaeger`);
  }
})();
