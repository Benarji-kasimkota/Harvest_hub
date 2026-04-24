const router = require('express').Router();
const { createTicket, getMyTickets, getAllTickets, updateTicket } = require('../controllers/supportController');
const { protect, admin } = require('../middleware/auth');
const { validators } = require('../middleware/validate');
const rateLimit = require('express-rate-limit');

const ticketLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { message: 'Too many support tickets submitted, please wait before trying again' },
  skip: () => process.env.NODE_ENV === 'test',
});

router.post('/ticket', protect, ticketLimiter, validators.createTicket, createTicket);
router.get('/my-tickets', protect, getMyTickets);
router.get('/all', protect, admin, getAllTickets);
router.put('/:id', protect, admin, validators.updateTicket, updateTicket);

module.exports = router;
