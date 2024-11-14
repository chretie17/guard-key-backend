const express = require('express');
const router = express.Router();
const requestController = require('../controllers/requestController');

// Public routes for outsider requests
router.get('/active-sites', requestController.getActiveSites);
router.post('/requests', requestController.createOutsiderRequest);

module.exports = router;
