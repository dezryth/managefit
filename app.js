var express = require("express"),
  fs = require("fs"),
  request = require("request"),
  date = require("date-and-time"),
  path = require("path"),
  logger = require("morgan");
require("dotenv").config();

const database = require("./database");

var db = database.getDatabase();
var quotes;

const indexRouter = require("./routes/index");
const checkinRouter = require("./routes/checkin");

const app = express();

// This enables request body parsing
app.use(express.json({ limit: "1mb" }));

// Enable logger
//app.use(logger('dev'));

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");

app.use(express.static(path.join(__dirname, "public")));

app.use(express.urlencoded({ extended: false }));

// Route handling
app.use("/checkin", checkinRouter);

app.post("/data", (req, res) => {
  // Extract data from request body and store in database
  if (req.body.data) {
    res.json(["POST Request Received. "]);
    console.log(JSON.stringify(req.body.data));
    processRequest(req);
  } else {
    console.log("Invalid request body received.\n" + req.body);
    res.json("Invalid request body.");
  }
});

app.post("/admin/sendmessages", (req, res) => {
  if (req.query.password == process.env.FAB_PASS) {
    sendCheckInMessages();
    res.sendStatus(200);
  } else {
    res.sendStatus(401);
    console.log("Unauthorized attempt to access admin/sendmessages endpoint.");
  }
});

app.listen(3000, () => {
  initialize();
  console.log("Server running on port 3000");
});

function initialize() {
  fs.readFile("./inspirationalQuotes.json", "utf8", (err, data) => {
    if (err) {
      console.log("Error reading file from disk: ${err}");
    } else {
      // parse JSON string to JSON object
      quotes = JSON.parse(data);
    }
  });
}

async function processRequest(req) {
  // Currently expecting data for yesterday due to inconsistent syncs for "today"
  var step_count = null;
  var body_mass_index = null;
  var dietary_energy = null;
  var physical_effort = null;
  var vo2_max = null;
  var weight_body_mass = null;

  req.body.data.metrics.forEach((element) => {
    date_for = new Date(element.data[0].date);
    switch (element.name) {
      case "body_mass_index":
        if (element.data[0]) {
          body_mass_index = element.data[0].qty.toFixed(2);
        }
        break;
      case "dietary_energy":
        if (element.data[0]) {
          dietary_energy = element.data[0].qty.toFixed(0);
        }
        break;
      case "step_count":
        if (element.data[0]) {
          step_count = element.data[0].qty.toFixed(0);
        }
        break;
      case "physical_effort":
        if (element.data[0]) {
          physical_effort = element.data[0].qty.toFixed(2);
        }
        break;
      case "vo2_max":
        if (element.data[0]) {
          vo2_max = element.data[0].qty.toFixed(2);
        }
        break;
      case "weight_body_mass":
        if (element.data[0]) {
          // Handle multiple weigh-ins and take lowest
          let lowestWeight = 0;
          element.data.forEach((weighIn) =>
          {
            if (lowestWeight != 0)
            {
              if (weighIn.qty < lowestWeight)
              lowestWeight = weighIn.qty;
            }
            else
            {
              lowestWeight = weighIn.qty;
            }
          })
          weight_body_mass = lowestWeight.toFixed(2);
        }
        break;
    }
  });

  var date_for_formatted = date_for.toISOString().split("T")[0];

  const healthMetrics = {
    date_for: date_for_formatted,
    user: req.headers.user,
    step_count: step_count,
    body_mass_index: body_mass_index,
    dietary_energy: dietary_energy,
    physical_effort: physical_effort,
    vo2_max: vo2_max,
    weight_body_mass: weight_body_mass,
  };

  // Insert request into requests table
  var insertRequestCmd =
    `
    insert into requests (request_body)
    values ('` +
    JSON.stringify(req.body) +
    `');`;
  database.execSql(db, insertRequestCmd);

  // Insert health data if not already present
  const newData = await database.insertHealthData(db, healthMetrics);

  if (newData || req.headers.override == "true") {
    DailyUpdate();
    // If today is Saturday...
    if (getDayOfWeekName(new Date()) == "Sunday") await WeeklyUpdate();
    // If today is first of the month...
    if (new Date().getDate() == 1) await MonthlyUpdate();
  }

  function DailyUpdate() {
    var dateWithTimezone = date_for_formatted + "T00:00:00-06:00";
    var message =
      req.headers.user +
      "'s " +
      getDayOfWeekName(new Date(dateWithTimezone)) +
      ":\n";
    if (healthMetrics.step_count != null)
      message += "Step Count: " + healthMetrics.step_count + "\n";
    if (healthMetrics.dietary_energy != null)
      message +=
        "Calories Consumed: " +
        healthMetrics.dietary_energy +
        (healthMetrics.dietary_energy < 1000
          ? " (Likely incomplete log)\n"
          : "\n");
    // if (healthMetrics.physical_effort != null)
    //   message +=
    //     "Physical Effort Level: " + healthMetrics.physical_effort + "\n";
    // if (healthMetrics.vo2_max != null)
    //   message += "VO2 Max: " + healthMetrics.vo2_max + "\n";
    // if (healthMetrics.body_mass_index != null)
    //   message += "BMI: " + healthMetrics.body_mass_index + "\n";
    // if (healthMetrics.weight_body_mass != null)
    //   message += "Weight: " + healthMetrics.weight_body_mass + " lbs\n";

    // Append inspiration
    message += getInspiration();
    console.log(message);
    updateBB(message);
  }

  async function WeeklyUpdate() {
    var averages = await database.getAveragesThisWeek(db);
    var message = req.headers.user + "'s Weekly Update\n";
    if (averages.AvgWeight != null) {
      var avgWeight = averages.AvgWeight.toFixed(2);
      message += "Average Weight: " + avgWeight + " lbs\n";
    }

    if (averages.AvgStepCount != null) {
      var avgStepCount = averages.AvgStepCount.toFixed(2);
      message += "Average Step Count: " + avgStepCount + "\n";
    }

    if (averages.AvgCalories != null) {
      var avgCalories = averages.AvgCalories.toFixed(2);;
      message += "Average Calories Consumed: " + avgCalories + "\n";
    }

    // Goal check
    if (process.env.GOAL_STARTDATE && process.env.START_WEIGHT && process.env.GOAL_WEIGHT) {
      var progressPercent =
        ((process.env.START_WEIGHT - averages.AvgWeight) /
          (process.env.START_WEIGHT - process.env.GOAL_WEIGHT)) *
        100;

        message += "Current Goal: Get from " + process.env.START_WEIGHT + " to " + process.env.GOAL_WEIGHT + " lbs\n";
        message +=
          "Total Progress Towards Goal Weight: " +
          progressPercent.toFixed(2) +
          "%\n";

      if (progressPercent >= 100)
      {
        var today = new Date();
        var goalStartDate = new Date(process.env.GOAL_STARTDATE);
        var timeDifference = goalStartDate.getTime() - today.getTime();
        var daysDifference = Math.ceil(timeDifference / (1000 * 3600 * 24));
        message += "Goal has been met! Reached in " + daysDifference + " days!\nTime for a new goal!\n";

        process.env.GOAL_STARTDATE = null;
      }
    }

    // if (averages.AvgPhysicalEffort != null) {
    //   var avgPhysicalEffort = averages.AvgPhysicalEffort.toFixed(2);
    //   message += "Average Physical Effort: " + avgPhysicalEffort + "\n";
    // }

    message += "Share a check in at:" + process.env.CHECKIN_URL;

    console.log(message);
    updateBB(message);
  }

  async function MonthlyUpdate() {
    var averages = await database.getAveragesLastMonth(db);
    var message = req.headers.user + "'s Monthly Update\n";
    if (averages.AvgWeight != null) {
      var avgWeight = averages.AvgWeight.toFixed(2);
      message += "Average Weight: " + avgWeight + " lbs\n";
    }

    if (averages.AvgStepCount != null) {
      var avgStepCount = averages.AvgStepCount.toFixed(2);;
      message += "Average Step Count: " + avgStepCount + "\n";
    }

    if (averages.AvgCalories != null) {
      var avgCalories = averages.AvgCalories.toFixed(2);;
      message += "Average Calories Consumed: " + avgCalories + "\n";
    }

    // if (averages.AvgPhysicalEffort != null) {
    //   var avgPhysicalEffort = averages.AvgPhysicalEffort.toFixed(2);;
    //   message += "Average Physical Effort: " + avgPhysicalEffort + "\n";
    // }

    message += "Share a check in at:" + process.env.CHECKIN_URL;

    console.log(message);
    updateBB(message);
  }
}

function getInspiration() {
  var position = randomInteger(0, 1642); // There are 1643 inspirational quotes in our quotes file.
  var quote = "'" + quotes[position].text + "'";
  // Some quotes don't have an author, so don't specify one if null
  if (quotes[position].author) {
    quote += " - " + quotes[position].author;
  }

  return quote;
}

function randomInteger(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getDayOfWeekName(date) {
  // Create an array of options to customize the date format
  var options = { weekday: "long", timeZone: "America/Chicago" };

  // Use toLocaleDateString with the options to get the day of the week name
  var dayOfWeekName = date.toLocaleDateString("en-US", options);

  return dayOfWeekName;
}

function sendCheckInMessages() {
  var files = fs.readdirSync("updates/");

  if (files.length > 0) {
    for (const file of files) {
      // Read file contents - store effect from first line
      var text = fs.readFileSync("updates/" + file, "utf8");
      var endOfFirstLine = text.indexOf("\n");
      var effect = text.substring(0, endOfFirstLine);

      // Remove first line from text
      text = text.substring(endOfFirstLine + 1);

      // Send message with file contents
      sendFABMessage(text, effect);

      // If archive folder doesn't exist, create it
      if (!fs.existsSync("archive")) {
        fs.mkdirSync("archive");
      }

      // Move file once done
      fs.renameSync("updates/" + file, "archive/" + file);
    }
  }
}

function sendFABMessage(text, effect) {
  const headers = {
    "Content-Type": "application/json",
  };

  const requestBody = {
    chatGuid: process.env.BB_CHATGUID,
    message: text,
    method: "private-api",
    effectId: effect,
  };

  const request = new Request(process.env.BB_SENDMESSAGEURL, {
    method: "POST",
    headers: new Headers(headers),
    body: JSON.stringify(requestBody),
  });

  console.log(JSON.stringify(requestBody));

  fetch(request)
    .then((response) => response.json())
    .then((data) => {
      // Handle the response data
      console.log("Response:", data);
    })
    .catch((error) => {
      // Handle errors
      console.error("Error:", error);
    });
}

function updateBB(message) {
  var afterHours = new Date();
  afterHours.setHours(21);
  afterHours.setMinutes(0);
  afterHours.setSeconds(0);

  // If current time is after the normal schedule time, cancel update.
  if (new Date() > afterHours) {
    console.log("Sync came in after hours - too late to send message.");
    return;
  }

  request(
    {
      url: process.env.BB_SENDMESSAGEURL,
      method: "POST",
      json: {
        chatGuid: process.env.BB_CHATGUID,
        message: message,
        method: "private-api",
      },
    },
    (error, response, body) => {
      if (response) {
        console.log("BB Server Response: " + response.statusCode);
      } else {
        console.log("No response from BB server.");
      }
      if (error) {
        console.log(JSON.stringify(error));
      }
    }
  );
}
