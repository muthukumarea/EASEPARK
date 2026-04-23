const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const slotController = require('../controllers/slotController');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.get('/', authenticate, slotController.getSlots);

router.post('/', authenticate, requireAdmin, [
  body('parking_id').isInt().withMessage('Valid parking ID required'),
  body('slot_number').notEmpty().withMessage('Slot number is required'),
], slotController.createSlot);

router.delete('/:id', authenticate, requireAdmin, slotController.deleteSlot);

module.exports = router;
