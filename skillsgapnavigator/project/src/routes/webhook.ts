import express, { Router, Request, Response, NextFunction } from 'express';
import { stripe } from '../config';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../config';

const router = Router();

/**
 * @swagger
 * /api/webhook:
 *   post:
 *     summary: Handle Stripe webhook events
 *     tags: [Webhooks]
 */
router.post(
  '/',
  express.raw({ type: 'application/json' }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sig = req.headers['stripe-signature'];

      if (!sig) {
        throw new AppError(400, 'No Stripe signature found');
      }

      const event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET!
      );

      // Handle the event
      switch (event.type) {
        case 'payment_intent.succeeded':
          const paymentIntent = event.data.object;
          logger.info('Payment succeeded:', {
            paymentIntentId: paymentIntent.id,
            amount: paymentIntent.amount,
            currency: paymentIntent.currency,
          });
          break;

        case 'payment_intent.payment_failed':
          const failedPayment = event.data.object;
          logger.error('Payment failed:', {
            paymentIntentId: failedPayment.id,
            error: failedPayment.last_payment_error,
          });
          break;

        case 'charge.refunded':
          const refund = event.data.object;
          logger.info('Charge refunded:', {
            chargeId: refund.id,
            amount: refund.amount,
            currency: refund.currency,
          });
          break;

        default:
          logger.info(`Unhandled event type: ${event.type}`);
      }

      res.json({ received: true });
    } catch (error) {
      next(error);
    }
  }
);

export const webhookRouter = router; 