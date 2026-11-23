import express from 'express';

const app = express();
app.use(express.json());

// Simple decision endpoint: GET /api/loan-decision?amount=5000&score=720
app.get('/api/loan-decision', (req, res) => {
  const amount = Number(req.query.amount);
  const score = Number(req.query.score);

  let decision = 'approved';
  let reason = 'Meets score and amount rules';

  if (score < 600) {
    decision = 'rejected';
    reason = 'Credit score below 600';
  } else if (amount > 20000) {
    decision = 'manual_review';
    reason = 'Amount above 20000 needs review';
  }

  res.json({ decision, reason, amount, score });
});

// Order status endpoint: GET /api/order-status?orderId=A100
app.get('/api/order-status', (req, res) => {
  res.json({
    orderId: req.query.orderId,
    status: 'shipped',
    eta: '2026-11-26',
  });
});

app.listen(4000, () => console.log('Fake backend on http://localhost:4000'));