var express = require("express"),
  fs = require("fs"),
  request = require("request"),
  date = require("date-and-time");
require("dotenv").config();

var history = fs.createWriteStream("history.txt", {
  flags: "a",
});

var latestMsg = "";
var quotes;

var app = express();

// This enables request body parsing
app.use(express.json({ limit: "1mb" }));

app.get("/", (req, res) => {
  console.log("GET Request received on /test interface.");
  res.json(["The server is up."]);
});

app.post("/data", (req, res) => {
  // Extract data from request body and store in output.txt
  if (req.body.data) {
    res.json(["POST Request Received."]);
    processRequest(req);
    updateBB();
  } else {
    console.log("Invalid request body received.\n" + req.body);
    res.json("Invalid request body.");
  }
});

app.listen(3000, () => {
  initialize();
  console.log("Server running on port 3000");
});

function processRequest(req) {
  var latest = fs.createWriteStream("latest.txt");
  var lastRequest = fs.createWriteStream("lastRequest.txt");
  latestMsg = "";
  var datetime = new Date();
  var dataForDate = date.format(datetime, "MM/DD/YY");
  write("FAB Check In:\n" + dataForDate + 
    " as of " +
    datetime.toLocaleTimeString() +
    "\n");
  if (req.headers.user) {
    write(req.headers.user + ":\n");
  }
  req.body.data.metrics.forEach((element) => {
    var qty = "No Data";
    switch (element.name) {
      case "body_mass_index":
        if (element.data[0]) {
          qty = element.data[0].qty.toFixed(2);
          if (qty > 30) {
            qty += " - Obese";
          } else if (qty > 25) {
            qty += " - Overweight";
          } else if (qty > 18.5) {
            qty += " - Healthy";
          } else {
            qty += " - Underweight";
          }
        }
        write("BMI: " + qty + "\n");
        break;
      case "dietary_energy":
        if (element.data[0]) {
          qty = element.data[0].qty.toFixed(0);
          write("Calories Consumed: " + qty + "\n");
        }
        break;
      case "step_count":
        if (element.data[0]) {
          qty =
            element.data[0].qty.toFixed(0);
        }
        write("Step Count: " + qty + "\n");
        break;
      case "vo2_max": // Only add to message if data is present. This is often missing in data exports.
        if (element.data[0]) {
          qty = element.data[0].qty.toFixed(2);
          write("VO₂ Max: " + qty + "\n");
        }
        break;
      case "weight_body_mass":
        if (element.data[0]) {
          qty = element.data[0].qty.toFixed(2) + " " + element.units + "s";
        }
        write("Weight: " + qty + "\n");
        break;
    }
  });
  write("\n" + getInspiration());
  latest.write(latestMsg);
  latest.end();
  lastRequest.write(JSON.stringify(req.body.data));
  lastRequest.end();
  console.log(latestMsg);
}

function getInspiration() {
  var position = randomInteger(0, 1642); // There are 1643 inspirational quotes in our quotes file.
  var quote = quotes[position].text;
  // Some quotes don't have an author, so don't specify one if null
  if (quotes[position].author) {
    inspiration += " - " + quotes[position].author;
  }

  return quote;
}

function initialize() {
  fs.readFile("./inspirationalQuotes.json", "utf8", (err, data) => {
    if (err) {
      console.log(`Error reading file from disk: ${err}`);
    } else {
      // parse JSON string to JSON object
      quotes = JSON.parse(data);
    }
  });
}

function randomInteger(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function updateBB() {
  // 7:05PM milliseconds snce epoch 1675904700000
  var scheduleTime = new Date();
  scheduleTime.setHours(19);
  scheduleTime.setMinutes(5);
  scheduleTime.setSeconds(0);

  // If current time is after the normal schedule time, schedule for the following day
  if (new Date() > scheduleTime) {
    scheduleTime.setDate(scheduleTime.getDate() + 1);
  }

  request(
    {
      url: process.env.BB_URL,
      method: "PUT",
      json: {
        type: "send-message",
        payload: {
          chatGuid: process.env.BB_CHATGUID,
          message: latestMsg,
          method: "private-api",
        },
        scheduledFor: scheduleTime.getTime(),
        schedule: { type: "recurring", interval: 1, intervalType: "daily" },
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

function write(text) {
  latestMsg += text;
  history.write(text);
}
