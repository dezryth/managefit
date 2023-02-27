var express = require("express");
var router = express.Router();

var checkin_controller = require('../controllers/checkinController');

//// Route Handling for checkin
// Form - GET
router.get("/", checkin_controller.checkin_get);

// Form - POST
router.post("/", checkin_controller.checkin_post);

// Form Confirmation - GET
router.get("/thanks", checkin_controller.checkin_thanks_get)

module.exports = router;