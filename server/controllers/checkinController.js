const { body, validationResult } = require("express-validator");
var date = require("date-and-time");
var fs = require("fs");
var he = require("he");

const shareTime = process.env.SHARE_TIME;

const effects = {
  "none": "",
  "slam": "com.apple.MobileSMS.expressivesend.impact",
  "loud": "com.apple.MobileSMS.expressivesend.loud",
  "gentle": "com.apple.MobileSMS.expressivesend.gentle",
  "invisible ink": "com.apple.MobileSMS.expressivesend.invisibleink",
  "echo": "com.apple.messages.effect.CKEchoEffect",
  "spotlight": "com.apple.messages.effect.CKSpotlightEffect",
  "balloons": "com.apple.messages.effect.CKHappyBirthdayEffect",
  "confetti": "com.apple.messages.effect.CKConfettiEffect",
  "love": "com.apple.messages.effect.CKHeartEffect",
  "lasers": "com.apple.messages.effect.CKLasersEffect",
  "fireworks": "com.apple.messages.effect.CKFireworksEffect",
  "celebration": "com.apple.messages.effect.CKSparklesEffect",
};

// Display checkin form on GET.
exports.checkin_get = function (req, res, next) {
  var password = req.query.password;
  res.render("checkin", {
    title: "FAB Check In!",
    name: "",
    weight: "",
    activity: "",
    update: "",
    effects: effects,
    parameterPW: password,    
    shareTime: shareTime
  });
};

exports.checkin_thanks_get = function (req, res, next) {
  var user = req.query.user;
  res.render("index", {
    title: "FAB Check In Submitted",
    message: "Thanks " + (user ? user : "nerd") + "!  FAB Check In Submitted.",
  });
};

// Handle checkin form on POST
exports.checkin_post = [
  // Validate and sanitize fields.
  body("user", "Name must not be empty.").trim().isLength({ min: 1 }).escape(),
  body("weight", "Max characters exceeded in Weight - 500.").trim().isLength({ max: 500 }).escape(),
  body("activity", "Max characters exceeded in Activity - 500.").trim().isLength({ max: 500 }).escape(),
  body("update", "Max characters exceeded in Update - 500.").trim().isLength({ max: 500 }).escape(),
  body("password", "You are not authorized for this form.")
    .trim()
    .equals(process.env.FAB_PASS)
    .escape(),
  // Process request after validation and sanitization.
  (req, res, next) => {
    // Extract the validation errors from a request.
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      // There are errors. Render form again with sanitized values/error messages.
      console.log("Form submitted with errors.\n" + JSON.stringify(errors));
      res.render("checkin", {
        title: "FAB Check In!",
        user: req.body.user,
        weight: req.body.weight,
        activity: req.body.activity,
        update: req.body.update,
        effects: effects,
        parameterPW: req.body.password,
        errors: errors.array(),
      });
      return;
    } else {
      // If updates folder doesn't exist, create it
      if (!fs.existsSync("updates")){
        fs.mkdirSync("updates");
      }

      // Create a checkin text file in updates folder
      var today = date.format(new Date(), "MM-DD-YY")
      var checkinFile = fs.createWriteStream("updates/" + today + req.body.user.toLowerCase() + ".txt");
      var checkinMessage = req.body.effect + "\n" +
        date.format(new Date(), "MM/DD/YY") + "\n" + he.decode(req.body.user) + ":\n" + 
        (req.body.weight ? "Weight: " + he.decode(req.body.weight) + "\n" : "") +
        (req.body.activity ? "Activity: " + he.decode(req.body.activity) + "\n" : "") +
        (req.body.update ? "Update: " + he.decode(req.body.update) : "")
      
      checkinFile.write(checkinMessage);
      checkinFile.end();
      console.log("Form submitted successfully.\n" + checkinMessage);
      res.redirect("/checkin/thanks?user=" + req.body.user);
    }
  },
];
