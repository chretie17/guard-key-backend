const express = require('express');
const router = express.Router();
const siteController = require('../controllers/siteController');

router.post('/', siteController.createSite);
router.get('/', siteController.getAllSites);
router.put('/:id', siteController.updateSite);
router.delete('/:id', siteController.deleteSite);

module.exports = router;
