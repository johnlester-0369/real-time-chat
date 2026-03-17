// .js extension required — nodenext moduleResolution resolves to .ts at compile time
// but the emitted JS and Node's ESM loader both need the .js reference
import app from '@/app.js';
import setupSocketServer from '@/socket/index.js';

// noUncheckedIndexedAccess means process.env['PORT'] is string | undefined —
// nullish coalescing before Number() prevents NaN from crashing the listener
const PORT = Number(process.env['PORT'] ?? 3000);

const server = app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
 
// Attach WebSocket server to the same HTTP instance — critical for Socket.IO
// to share ports with Express routes
setupSocketServer(server);

// SIGTERM is sent by container orchestrators (Kubernetes, ECS, Docker) during
// rolling deploys — close() lets in-flight requests drain before process.exit()
// rather than dropping connections mid-response
process.on('SIGTERM', () => {
  server.close(() => {
    process.exit(0);
  });
});
