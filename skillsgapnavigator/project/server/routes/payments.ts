import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { stripe, supabase, logger } from '../config';
import { authenticateUser, AuthenticatedRequest } from '../middleware/auth';
import { Response } from 'express';

const router = Router();

// Create payment intent
router.post(
  '/create-payment-intent',
  authenticateUser,
  [
    body('amount').isNumeric().toInt(),
    body('currency').isString().isLength({ min: 3, max: 3 }),
  ],
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { amount, currency } = req.body;

      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency,
        customer: req.user!.id,
        metadata: {
          userId: req.user!.id,
        },
      });

      res.json({
        clientSecret: paymentIntent.client_secret,
      });
    } catch (error) {
      logger.error('Payment intent creation error:', error);
      res.status(500).json({ error: 'Failed to create payment intent' });
    }
  }
);

// Get payment history
router.get(
  '/payment-history',
  authenticateUser,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const payments = await stripe.paymentIntents.list({
        customer: req.user!.id,
        limit: 10,
      });

      const formattedPayments = payments.data.map((payment) => ({
        id: payment.id,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        created: payment.created,
      }));

      res.json(formattedPayments);
    } catch (error) {
      logger.error('Payment history fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch payment history' });
    }
  }
);

// Create subscription
router.post(
  '/create-subscription',
  authenticateUser,
  [body('priceId').isString()],
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { priceId } = req.body;

      // Create or get Stripe customer
      let customer;
      const { data: profile } = await supabase
        .from('profiles')
        .select('stripe_customer_id')
        .eq('id', req.user!.id)
        .single();

      if (profile?.stripe_customer_id) {
        customer = await stripe.customers.retrieve(profile.stripe_customer_id);
      } else {
        customer = await stripe.customers.create({
          email: req.user!.email,
          metadata: {
            userId: req.user!.id,
          },
        });

        // Save Stripe customer ID to profile
        await supabase
          .from('profiles')
          .update({ stripe_customer_id: customer.id })
          .eq('id', req.user!.id);
      }

      // Create subscription
      const subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: priceId }],
        payment_behavior: 'default_incomplete',
        payment_settings: {
          payment_method_types: ['card'],
          save_default_payment_method: 'on_subscription',
        },
        expand: ['latest_invoice.payment_intent'],
      });

      const invoice = subscription.latest_invoice as any;
      const paymentIntent = invoice.payment_intent;

      res.json({
        subscriptionId: subscription.id,
        clientSecret: paymentIntent.client_secret,
      });
    } catch (error) {
      logger.error('Subscription creation error:', error);
      res.status(500).json({ error: 'Failed to create subscription' });
    }
  }
);

// Cancel subscription
router.post(
  '/cancel-subscription',
  authenticateUser,
  [body('subscriptionId').isString()],
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { subscriptionId } = req.body;

      const subscription = await stripe.subscriptions.cancel(subscriptionId);

      res.json({
        status: subscription.status,
        canceledAt: subscription.canceled_at,
      });
    } catch (error) {
      logger.error('Subscription cancellation error:', error);
      res.status(500).json({ error: 'Failed to cancel subscription' });
    }
  }
);

export default router; 