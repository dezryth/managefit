var express = require("express");
var router = express.Router();

/* GET home page. */
router.get("/", function (req, res) {
  res.render('index', { title: 'Wrong Turn?', message: "You're not supposed to be here.." });
  console.log("GET Request received at: /");
});

module.exports = router;
