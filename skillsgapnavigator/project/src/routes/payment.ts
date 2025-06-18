import { Router, Request, Response, NextFunction } from 'express';
import { body } from 'express-validator';
import { stripe } from '../config';
import { AppError } from '../middleware/errorHandler';
import { authenticate } from '../middleware/auth';

const router = Router();

/**
 * @swagger
 * /api/payments/create-intent:
 *   post:
 *     summary: Create a payment intent
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *               - currency
 *             properties:
 *               amount:
 *                 type: number
 *               currency:
 *                 type: string
 *                 enum: [usd, eur, gbp]
 */
router.post(
  '/create-intent',
  authenticate,
  [
    body('amount').isNumeric().toFloat(),
    body('currency').isIn(['usd', 'eur', 'gbp']),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { amount, currency } = req.body;

      if (!req.user?.userId) {
        throw new AppError(401, 'User not authenticated');
      }

      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency,
        metadata: {
          userId: req.user.userId,
        },
      });

      res.json({
        status: 'success',
        data: {
          clientSecret: paymentIntent.client_secret,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/payments/history:
 *   get:
 *     summary: Get payment history
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: starting_after
 *         schema:
 *           type: string
 */
router.get(
  '/history',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { limit = 10, starting_after } = req.query;

      if (!req.user?.userId) {
        throw new AppError(401, 'User not authenticated');
      }

      const payments = await stripe.paymentIntents.list({
        limit: Number(limit),
        starting_after: starting_after as string,
        customer: req.user.userId,
      });

      res.json({
        status: 'success',
        data: payments.data.map((payment) => ({
          id: payment.id,
          amount: payment.amount / 100, // Convert from cents
          currency: payment.currency,
          status: payment.status,
          created: payment.created,
        })),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/payments/{paymentIntentId}:
 *   get:
 *     summary: Get payment details
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: paymentIntentId
 *         required: true
 *         schema:
 *           type: string
 */
router.get(
  '/:paymentIntentId',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { paymentIntentId } = req.params;

      if (!req.user?.userId) {
        throw new AppError(401, 'User not authenticated');
      }

      const payment = await stripe.paymentIntents.retrieve(paymentIntentId);

      if (payment.metadata.userId !== req.user.userId) {
        throw new AppError(403, 'Not authorized to view this payment');
      }

      res.json({
        status: 'success',
        data: {
          id: payment.id,
          amount: payment.amount / 100,
          currency: payment.currency,
          status: payment.status,
          created: payment.created,
          paymentMethod: payment.payment_method,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export const paymentRouter = router; 