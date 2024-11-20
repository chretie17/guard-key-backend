const express = require('express');
const router = express.Router();
const controller = require('../controllers/dashboardController');

router.get('/total-requests', controller.getTotalRequests);
router.get('/approved-requests', controller.getApprovedRequests);
router.get('/best-performing-site', controller.getBestPerformingSite);
router.get('/most-active-user', controller.getMostActiveUser);
router.get('/request-distribution', controller.getRequestDistributionBySite);
router.get('/status-breakdown', controller.getRequestStatusBreakdown);
router.get('/popular-request-time', controller.getMostPopularRequestTime);
router.get('/request-trends', controller.getRequestTrendsOverTime);

module.exports = router;
