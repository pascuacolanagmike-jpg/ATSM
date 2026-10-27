import { WebSocketServer } from 'ws';

const PORT = process.env.PORT || 8080;
const wss = new WebSocketServer({ port: PORT });

const esp32Clients = new Set();
const frontendClients = new Set();

wss.on('connection', (ws, req) => {
  const url = req.url || '';
  const isEsp32 = url.startsWith('/esp32');

  if (isEsp32) {
    console.log('[ESP32] connected');
    esp32Clients.add(ws);

    ws.on('message', (data, isBinary) => {
      if (!isBinary) return;
      // Just pass the video frames straight to the browser
      for (const client of frontendClients) {
        if (client.readyState === 1) {
          client.send(data, { binary: true });
        }
      }
    });

    ws.on('close', () => esp32Clients.delete(ws));
  } else {
    console.log('[Frontend] connected');
    frontendClients.add(ws);
    ws.on('close', () => frontendClients.delete(ws));
  }
});

console.log(`Relay listening on port ${PORT}`);