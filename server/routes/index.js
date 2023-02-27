var express = require("express");
var router = express.Router();

/* GET home page. */
router.get("/", function (req, res) {
  res.render('index', { title: 'Wrong Turn?', message: "Nothing interesting beyond this point - I promise." });
  console.log("GET Request received at: /");
});

module.exports = router;
