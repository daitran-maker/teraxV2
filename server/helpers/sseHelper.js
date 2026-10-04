const clients = new Set();

function addClient(req, res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Prevent Nginx buffering
  res.flushHeaders();
  
  clients.add(res);
  
  // Immediately write a keepalive/ok message to establish connection
  try {
    res.write(': ok\n\n');
  } catch (err) {
    console.error('Error writing initial message to SSE client:', err);
  }
  
  req.on('close', () => {
    clients.delete(res);
  });
}

function broadcastSSE(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of clients) {
    try {
      client.write(payload);
    } catch (err) {
      console.error('Error broadcasting to SSE client, removing client:', err);
      clients.delete(client);
    }
  }
}

// Keep connections active through Cloudflare (which has a 100s timeout)
// Send a keepalive comment every 25 seconds
setInterval(() => {
  for (const client of clients) {
    try {
      client.write(': keepalive\n\n');
    } catch (err) {
      console.error('Error writing heartbeat to SSE client, removing client:', err);
      clients.delete(client);
    }
  }
}, 25000);

module.exports = {
  addClient,
  broadcastSSE
};

