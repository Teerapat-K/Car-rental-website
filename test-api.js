const http = require('http');

const data = JSON.stringify({
    pickupLocationId: "1",
    returnLocationId: "1",
    pickupDate: "2026-03-03T10:00",
    returnDate: "2026-03-05T10:00"
});

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/search',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

const req = http.request(options, res => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => console.log('Response:', body));
});

req.on('error', error => {
    console.error('Error:', error);
});

req.write(data);
req.end();