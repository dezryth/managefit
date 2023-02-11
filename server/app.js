var express = require("express"),
  fs = require("fs"),
  request = require("request"),
  date = require("date-and-time");
require("dotenv").config();

var history = fs.createWriteStream("history.txt", {
  flags: "a",
});

var lastRequest = fs.createWriteStream("lastRequest.txt");

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
    lastRequest.write(JSON.stringify(req.body.data));
    processRequest(req);
    updateBB();
  } else {
    console.log("Invalid request body received.\n" + req.body);
    res.json("Invalid request body.");
  }
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});

function processRequest(req) {
  var latest = fs.createWriteStream("latest.txt");
  latestMsg = "";
  var datetime = new Date();
  var dataForDate = date.format(
    datetime,
    "MM/DD/YY"
  );
  write(dataForDate + "\n");
  if (req.headers.user)
  {
    write(req.headers.user + ":\n");
  }
  req.body.data.metrics.forEach((element) => {
    var qty = "No Data";
    switch (element.name) {
      case "step_count":
        if (element.data[0]) {
          qty = element.data[0].qty.toFixed(0);
        }
        write("Step Count: " + qty + "\n");
        break;
      case "weight_body_mass":
        if (element.data[0]) {
          qty = element.data[0].qty.toFixed(2) + " " + element.units + "s";
        }
        write("Weight: " + qty + "\n");
        break;
      default:
    }
  });
  latest.write(latestMsg);
  latest.end();
  console.log("Export received at " + dataForDate + " " + datetime.toLocaleTimeString() + " has been processed.\n" + latestMsg);
}

function write(text) {
  latestMsg += text;
  history.write(text);
}

function updateBB() {
  // 7:05PM milliseconds snce epoch 1675904700000
  var scheduleTime = new Date();
  scheduleTime.setHours(19);
  scheduleTime.setMinutes(5);
  scheduleTime.setSeconds(0);
  //console.log(scheduleTime);

  request(
    {
      url: process.env.BB_URL,
      method: "PUT",
      json: {
        "type": "send-message",
        "payload": {
          "chatGuid": process.env.BB_CHATGUID,
          "message": latestMsg,
          "method": "private-api",
        },
        "scheduledFor": scheduleTime.getTime(),
        "schedule": { "type": "recurring", "interval": 1, "intervalType": "daily" },
      },
    },
    (error, response, body) => {
      console.log("BB Server Updated - Server Response: " + response.statusCode);
      if (error)
      {
        console.log(JSON.stringify(error))
      }    
    }
  );
}
