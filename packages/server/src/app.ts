import express, { type Request, type Response } from 'express';

const app = express();

// All API endpoints exchange JSON — parse before any route handler sees the body
app.use(express.json());

// Liveness probe: load balancers and Kubernetes readiness checks hit this
// before routing traffic; must remain dependency-free to never false-negative
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Root route provides minimal API entry point for developers testing the server
// Returns basic service info without exposing any sensitive details
app.get('/', (_req: Request, res: Response) => {
  res.json({ message: 'Real-time Chat API', status: 'running', version: '1.0.0' });
});

export default app;
