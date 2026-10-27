import { WebSocketServer } from 'ws';

const PORT = process.env.PORT || 8080;

const wss = new WebSocketServer({ port: PORT });

// Track connected clients by role
const esp32Clients = new Set();
const frontendClients = new Set();

wss.on('connection', (ws, req) => {
  const url = req.url || '';
  const isEsp32 = url.startsWith('/esp32');

  if (isEsp32) {
    console.log('[ESP32] connected');
    esp32Clients.add(ws);

    ws.on('message', (data, isBinary) => {
      if (!isBinary) {
        console.log('[ESP32] text message:', data.toString());
        return;
      }

      // `data` is a Buffer containing one JPEG frame.
      // For now: just forward it to all frontend clients so you can see video.
      for (const client of frontendClients) {
        if (client.readyState === 1 /* OPEN */) {
          client.send(data, { binary: true });
        }
      }

      // TODO: plug in face recognition here later.
      // When a face matches, broadcast a JSON event like:
      //   broadcastToFrontend({ type: 'attendance_matched', studentId, confidence })
    });

    ws.on('close', () => {
      console.log('[ESP32] disconnected');
      esp32Clients.delete(ws);
    });

    ws.on('error', (err) => console.error('[ESP32] error:', err));
  } else {
    console.log('[Frontend] connected');
    frontendClients.add(ws);

    ws.on('close', () => {
      console.log('[Frontend] disconnected');
      frontendClients.delete(ws);
    });

    ws.on('error', (err) => console.error('[Frontend] error:', err));
  }
});

function broadcastToFrontend(message) {
  const str = JSON.stringify(message);
  for (const client of frontendClients) {
    if (client.readyState === 1) client.send(str);
  }
}

console.log(`WebSocket relay listening on port ${PORT}`);