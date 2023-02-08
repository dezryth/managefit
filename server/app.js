var express = require("express"),
  fs = require("fs"),
  request = require("request"),
  date = require("date-and-time");
require("dotenv").config();

var history = fs.createWriteStream("history.txt", {
  flags: "a",
});

var latestMsg = "";

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
    processBody(req.body);
    updateBB();
  } else {
    console.log("Invalid request body received.\n" + req.body);
    res.json("Invalid request body.");
  }
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});

function processBody(data) {
  var latest = fs.createWriteStream("latest.txt");
  latestMsg = "";
  var dataForDate = date.format(
    new Date(data.data.metrics[0].data[0].date),
    "MM/DD/YY"
  );
  write(dataForDate + "\n");
  data.data.metrics.forEach((element) => {
    switch (element.name) {
      case "step_count":
        write("Step Count: " + element.data[0].qty + "\n");
        break;
      case "weight_body_mass":
        write(
          "Weight: " +
            element.data[0].qty.toFixed(2) +
            " " +
            element.units +
            "s\n"
        );
        break;
      default:
    }
  });
  latest.write(latestMsg);
  latest.end();
  console.log("Export for " + dataForDate + " processed and stored.");
}

function write(text) {
  latestMsg += text;
  history.write(text);
}

function updateBB() {
  // 7:05PM milliseconds snce epoch 1675904700000
  var scheduleTime = new Date().setTime(1675904700000);

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
        scheduledFor: scheduleTime,
        schedule: { type: "recurring", interval: 1, intervalType: "daily" },
      },
    },
    () => {
      console.log("BB Server Updated");
    }
  );
}
