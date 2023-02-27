const { body, validationResult } = require("express-validator");

// Display checkin form on GET.
exports.checkin_get = function (req, res, next) {
  var password = req.query.password;
  console.log(password);
  res.render("checkin", {
    name: "",
    weight: "",
    activity: "",
    update: "",
    parameterPW: password,
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
      console.log("Form submitted with errors.");
      res.render("checkin", {
        user: req.body.user,
        weight: req.body.weight,
        activity: req.body.activity,
        update: req.body.update,
        parameterPW: req.body.password,
        errors: errors.array(),
      });
      return;
    } else {
      // Create a checkin text file in updates folder
      console.log("Form submitted successfully.");
      //TODO
      // Successful - redirect to thanks page.
      res.redirect("/checkin/thanks?user=" + req.body.user);
    }
  },
];
