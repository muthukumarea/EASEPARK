const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const bookingController = require('../controllers/bookingController');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.post('/book-slot', authenticate, [
  body('slot_id').isInt().withMessage('Valid slot ID required'),
  body('duration_hours').optional().isFloat({ min: 0.5, max: 24 }).withMessage('Duration must be between 0.5 and 24 hours'),
], bookingController.bookSlot);

router.get('/my-bookings', authenticate, bookingController.getMyBookings);
router.get('/all', authenticate, requireAdmin, bookingController.getAllBookings);
router.post('/:id/end', authenticate, bookingController.endBooking);
router.post('/:id/cancel', authenticate, bookingController.cancelBooking);

module.exports = router;
