const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 4879;
const specPath = path.join(__dirname, '..', 'openapi', 'spec.json');

const server = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/spec.json') {
        res.writeHead(200, {'Content-Type': 'application/json'});
        fs.createReadStream(specPath).pipe(res);
        return;
    }
    res.writeHead(404, {'Content-Type': 'text/plain'});
    res.end('Not found');
});

server.on('error', error => {
    // Fail loudly on a port collision instead of leaving the caller to fetch
    // whatever else happens to be listening on PORT.
    console.error(`Failed to start OpenAPI spec server: ${error.message}`);
    process.exit(1);
});

server.listen(PORT, () => {
    console.log(`Serving OpenAPI spec at http://localhost:${PORT}/spec.json`);
});
