const express = require('express');
const router = express.Router();
const keyRequestController = require('../controllers/accessController');

// Create a new key request
router.post('/', keyRequestController.createRequest); // Accessible at /requests
// Admin: Get all key requests
router.get('/all', keyRequestController.getAllRequests);

// Admin: Update request status (approve, deny, return)
router.put('/update-status/:id', keyRequestController.updateRequestStatus);
// Get all requests for a specific user
router.get('/user-requests/:userId', keyRequestController.getUserRequests); // Accessible at /requests/user-requests/:userId

// Update request status (for admins to approve/deny/return)
router.put('/update-status/:id', keyRequestController.updateRequestStatus); // Accessible at /requests/update-status/:id
router.delete('/:id', keyRequestController.deleteRequest);


module.exports = router;
