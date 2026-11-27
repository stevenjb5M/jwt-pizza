// Stands in for Grafana: prints the order-related metrics the service reports.
const http = require('http');

const wanted = ['pizza_orders', 'pizza_latency', 'http_requests', 'http_latency'];

http
  .createServer((request, response) => {
    let body = '';
    request.on('data', (chunk) => (body += chunk));
    request.on('end', () => {
      const metrics = JSON.parse(body).resourceMetrics[0].scopeMetrics[0].metrics;
      const values = {};
      for (const metric of metrics) {
        if (!wanted.includes(metric.name)) continue;
        for (const point of metric.sum.dataPoints) {
          const labels = Object.fromEntries(point.attributes.map((a) => [a.key, a.value.stringValue]));
          if (labels.endpoint && labels.endpoint !== '/api/order') continue;
          if (labels.method && labels.method !== 'POST') continue;
          values[metric.name] = point.asInt ?? point.asDouble;
        }
      }
      console.log(new Date().toISOString(), JSON.stringify(values));
      response.end('ok');
    });
  })
  .listen(4100, () => console.log('Fake Grafana on port 4100'));
