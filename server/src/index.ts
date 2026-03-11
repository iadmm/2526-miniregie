import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' }, // restreindre en production
});

app.use(express.json());

// Fichiers statiques des clients
app.use('/admin', express.static('../client/admin/dist'));
app.use('/go', express.static('../client/go/dist'));
app.use('/', express.static('../client/broadcast/dist'));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', ts: Date.now() });
});

io.on('connection', (socket) => {
  console.log(`client connected: ${socket.id}`);

  // Heartbeat — toutes les 10s pour le watchdog client
  const pingInterval = setInterval(() => {
    socket.emit('ping');
  }, 10_000);

  socket.on('disconnect', () => {
    clearInterval(pingInterval);
    console.log(`client disconnected: ${socket.id}`);
  });
});

const PORT = process.env['PORT'] ?? 3000;
httpServer.listen(PORT, () => {
  console.log(`MiniRégie server running on http://localhost:${PORT}`);
});
