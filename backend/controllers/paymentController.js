const Order = require('../models/Order');

const getStripe = () => {
  const key = process.env.STRIPE_SECRET_KEY;
  // A real Stripe key follows sk_test_<20+chars> or sk_live_<20+chars>
  if (!key || !/^sk_(test|live)_[A-Za-z0-9]{20,}$/.test(key)) return null;
  return require('stripe')(key);
};

exports.createPaymentIntent = async (req, res) => {
  try {
    const stripe = getStripe();
    if (!stripe) {
      return res.status(503).json({ message: 'Payment not configured. Set STRIPE_SECRET_KEY in .env' });
    }
    const { amount } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ message: 'Invalid amount' });
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: 'usd',
      payment_method_types: ['card'],
    });
    res.json({ clientSecret: paymentIntent.client_secret, paymentIntentId: paymentIntent.id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Called from orderController after frontend confirms payment — verifies PI status with Stripe
exports.verifyPaymentIntent = async (paymentIntentId) => {
  const stripe = getStripe();
  if (!stripe) return true; // Skip verification if Stripe not configured
  const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
  return pi.status === 'succeeded';
};

// Stripe webhook — server-side payment confirmation (redundant safety net)
exports.handleWebhook = async (req, res) => {
  const stripe = getStripe();
  if (!stripe) return res.status(503).json({ message: 'Stripe not configured' });

  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) return res.status(503).json({ message: 'Webhook secret not configured' });

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    return res.status(400).json({ message: `Webhook signature verification failed: ${err.message}` });
  }

  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object;
    const order = await Order.findOne({ paymentIntentId: pi.id });
    if (order && !order.isPaid) {
      order.isPaid = true;
      order.paidAt = new Date();
      order.status = 'processing';
      order.paymentResult = {
        id: pi.id,
        status: pi.status,
        update_time: new Date().toISOString(),
        email_address: pi.receipt_email || '',
      };
      await order.save();
    }
  }

  res.json({ received: true });
};
