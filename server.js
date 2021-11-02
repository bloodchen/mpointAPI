// server.js
// where your node app starts

// init project
require('dotenv').config();
const MP = require('./mpoints');
const mPoints = new MP();
/*const express = require("express");
const app = express();

// we've started you off with Express,
// but feel free to use whatever libs or frameworks you'd like through `package.json`.

// http://expressjs.com/en/starter/static-files.html
app.use(express.static("public"));

// http://expressjs.com/en/starter/basic-routing.html
app.get("/", function(request, response) {
  response.sendFile(__dirname + "/views/index.html");
});

// listen for requests :)
const listener = app.listen(process.env.PORT, function() {
  console.log("Your app is listening on port " + listener.address().port);
});*/
//console.log(process.env.HOTWALLET)
mPoints.startSever(process.env.PORT);
console.log("Your app is running");
