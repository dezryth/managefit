var express = require("express"), fs = require("fs");
var writer = fs.createWriteStream("output.txt");
var app = express();

// This enables request body parsing
app.use(express.json({limit: '1mb'}));

app.get("/test", (req, res, next) => {
 res.json(["The server is up and responding to requests."]);
});

app.post("/data", (req, res, next) => {
 writer.write(JSON.stringify(req.body));
 console.log(req.body);
 res.json([req.body]);
});

app.listen(3000, () => {
 console.log("Server running on port 3000");
});
