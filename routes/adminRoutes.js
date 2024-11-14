const express = require('express');
const router = express.Router();
const requestController = require('../controllers/requestController');

// Admin routes for managing outsider requests
router.get('/outsider-requests', requestController.getAllOutsiderRequests);
router.put('/outsider-requests/:id/status', requestController.updateOutsiderRequestStatus);

module.exports = router;
