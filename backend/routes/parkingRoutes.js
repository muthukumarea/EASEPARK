const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const parkingController = require('../controllers/parkingController');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.get('/', parkingController.getAllParkings);
router.get('/:id', parkingController.getParkingById);

router.post('/', authenticate, requireAdmin, [
  body('name').notEmpty().withMessage('Parking name is required'),
  body('address').notEmpty().withMessage('Address is required'),
  body('lat').isFloat().withMessage('Valid latitude required'),
  body('lng').isFloat().withMessage('Valid longitude required'),
  body('price_per_hour').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('media').optional().isArray({ max: 5 }).withMessage('You can upload up to 5 media files'),
], parkingController.createParking);

router.put('/:id', authenticate, requireAdmin, parkingController.updateParking);
router.delete('/:id', authenticate, requireAdmin, parkingController.deleteParking);

module.exports = router;
