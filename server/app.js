var express = require("express"),
  fs = require("fs"),
  request = require("request"),
  date = require("date-and-time"),
  path = require("path"),
  logger = require("morgan");
require("dotenv").config();

var history = fs.createWriteStream("history.txt", {
  flags: "a",
});

var latestMsg = "";
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
app.use("/", indexRouter);
app.use("/checkin", checkinRouter);

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

function processRequest(req) {
  var latest = fs.createWriteStream("latest.txt");
  var lastRequest = fs.createWriteStream("lastRequest.txt");
  latestMsg = "";
  var today = new Date();
  var yesterday = new Date();
  yesterday.setDate(today.getDate() -1); 
  // Currently expecting data for yesterday
  var formattedDate = date.format(yesterday, "MM/DD/YY");
  write(
    "FAB Check In:\n" +
      formattedDate +
      "\n"
  );
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
          write("BMI: " + qty + "\n");
        }
        break;
      case "dietary_energy":
        if (element.data[0]) {
          qty = element.data[0].qty.toFixed(0);
          write("Calories Consumed: " + qty + "\n");
        }
        break;
      case "step_count":
        if (element.data[0]) {
          qty = element.data[0].qty.toFixed(0);
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
  var quote = "'" + quotes[position].text + "'";
  // Some quotes don't have an author, so don't specify one if null
  if (quotes[position].author) {
    quote += " - " + quotes[position].author;
  }

  return quote;
}

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

function randomInteger(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
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
      if (!fs.existsSync("archive")){
        fs.mkdirSync("archive");
      }
      
      // Move file once done
      fs.renameSync("updates/" + file, "archive/" + file);
    }
  }
}

function sendFABMessage(text, effect) {
  request(
    {
      url: process.env.BB_SENDMESSAGEURL,
      method: "POST",
      json: {
        method: "private-api",
        chatGuid: process.env.BB_CHATGUID,
        message: text,
        effectId: effect,
      },
    },
    (error, response) => {
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

function updateBB() {
  var scheduleTime = new Date();
  scheduleTime.setHours(19);
  scheduleTime.setMinutes(0);
  scheduleTime.setSeconds(0);

  // If current time is after the normal schedule time, schedule for the following day
  if (new Date() > scheduleTime) {
    scheduleTime.setDate(scheduleTime.getDate() + 1);
  }

  request(
    {
      url: process.env.BB_UPDATESCHEDULEDMESSAGEURL,
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
