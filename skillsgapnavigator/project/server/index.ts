import express from 'express';
import cors from 'cors';
import { corsOptions, logger } from './config';
import authRoutes from './routes/auth';
import paymentRoutes from './routes/payments';
import webhookHandler from './webhooks';

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Webhook endpoint needs raw body
app.post('/api/webhook', express.raw({ type: 'application/json' }), webhookHandler);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/payments', paymentRoutes);

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(port, () => {
  logger.info(`Server running on port ${port}`);
}); 