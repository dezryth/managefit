var express = require("express");
var router = express.Router();

// Require our checkin controller
var checkin_controller = require('../controllers/checkinController');

// checkin Routes

// checkin Form.
router.get("/", checkin_controller.checkin_get);
router.get("/thanks", checkin_controller.checkin_thanks_get)
router.post("/", checkin_controller.checkin_post);

module.exports = router;