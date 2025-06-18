import express from 'express';
import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

const router = express.Router();

router.get('/analytics', async (req, res) => {
  try {
    const { timeRange = 'month' } = req.query;
    const now = new Date();
    let startDate: Date;

    // Calculate start date based on time range
    switch (timeRange) {
      case 'week':
        startDate = new Date(now.setDate(now.getDate() - 7));
        break;
      case 'year':
        startDate = new Date(now.setFullYear(now.getFullYear() - 1));
        break;
      case 'month':
      default:
        startDate = new Date(now.setMonth(now.getMonth() - 1));
        break;
    }

    // Fetch payments for the time range
    const payments = await stripe.paymentIntents.list({
      created: {
        gte: Math.floor(startDate.getTime() / 1000),
      },
      limit: 100,
    });

    // Calculate analytics data
    const successfulPayments = payments.data.filter(
      (payment) => payment.status === 'succeeded'
    );
    const totalRevenue = successfulPayments.reduce(
      (sum, payment) => sum + (payment.amount || 0),
      0
    );
    const averageTransactionValue =
      successfulPayments.length > 0
        ? totalRevenue / successfulPayments.length
        : 0;
    const successRate =
      (successfulPayments.length / payments.data.length) * 100;

    // Group payments by date for the revenue chart
    const monthlyRevenue = successfulPayments.reduce((acc, payment) => {
      const date = new Date(payment.created * 1000).toISOString().split('T')[0];
      acc[date] = (acc[date] || 0) + (payment.amount || 0);
      return acc;
    }, {} as Record<string, number>);

    // Group payments by payment method
    const paymentMethods = successfulPayments.reduce((acc, payment) => {
      const method = payment.payment_method_types?.[0] || 'unknown';
      acc[method] = (acc[method] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Group payments by currency
    const currencyDistribution = successfulPayments.reduce((acc, payment) => {
      const currency = payment.currency.toUpperCase();
      acc[currency] = (acc[currency] || 0) + (payment.amount || 0);
      return acc;
    }, {} as Record<string, number>);

    res.json({
      totalRevenue: totalRevenue / 100, // Convert from cents to dollars
      averageTransactionValue: averageTransactionValue / 100,
      successRate: Math.round(successRate),
      monthlyRevenue: Object.entries(monthlyRevenue).map(([date, amount]) => ({
        date,
        amount: amount / 100,
      })),
      paymentMethods: Object.entries(paymentMethods).map(([name, value]) => ({
        name,
        value,
      })),
      currencyDistribution: Object.entries(currencyDistribution).map(
        ([currency, value]) => ({
          currency,
          value: value / 100,
        })
      ),
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics data' });
  }
});

export default router; 