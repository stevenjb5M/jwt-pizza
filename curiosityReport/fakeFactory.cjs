// A stand-in for the pizza factory. It prints the trace header it receives
// and waits FACTORY_DELAY_MS before answering, so we can make it slow on purpose.
const http = require('http');

const delayMs = Number(process.env.FACTORY_DELAY_MS ?? 300);

http
  .createServer((request, response) => {
    console.log(`${request.method} ${request.url}  traceparent: ${request.headers.traceparent ?? '(none)'}`);
    setTimeout(() => {
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({ jwt: 'fake.pizza.jwt', reportUrl: 'http://localhost:4000/report' }));
    }, delayMs);
  })
  .listen(4000, () => console.log(`Fake factory on port 4000, delay ${delayMs} ms`));
