var express = require("express"),
  fs = require("fs");
var history = fs.createWriteStream("history.txt", {
  flags: "a",
});
var date = require("date-and-time");
var app = express();

// This enables request body parsing
app.use(express.json({ limit: "1mb" }));

app.get("/", (req, res) => {
  console.log("GET Request received on /test interface.");
  res.json(["The server is up."]);
});

app.post("/data", (req, res) => {
  // Extract data from request body and store in output.txt
  if (req.body.data)
  {
    processBody(req.body);
    res.json(["POST Request Received."]);
  }
  else 
  {
    res.json("Invalid request body.");
  }
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});

function processBody(data) {
  var latest = fs.createWriteStream("latest.txt");
  write(
    latest,
    date.format(new Date(data.data.metrics[0].data[0].date), "MM/DD/YY") + "\n"
  );
  data.data.metrics.forEach((element) => {
    switch (element.name) {
      case "step_count":
        write(latest, "Step Count: " + element.data[0].qty + "\n");
        break;
      case "weight_body_mass":
        write(
          latest,
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
  latest.end();
}

function write(latest, text) {
  history.write(text);
  latest.write(text);
}