'use strict';

const express = require('express');
const crypto = require('crypto');
const request = require('request');

const app = express();
const bodyParser = require('body-parser');
const Sequelize = require('sequelize');

// Import secret and other configuration
const config = require('./config');
for (const key of Object.keys(config)) {
  process.env[key] = process.env[key] || config[key];
}

// Custom Middleware to compute rawBody. Unfortunately using
// JSON.stringify(req.body) will remove spaces and newlines, so verification
// will fail. We must add this middleware to ensure we're computing the correct
// signature
app.use(function(req, res, next) {
    req.rawBody = '';
    req.on('data', function(chunk) {
        req.rawBody += chunk;
    });
    next();
});
app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

// Attach our routes!
require('./routes/webhooks')(app);


// Setup ngrok settings to ensure everything works locally
request('http://localhost:4040/api/tunnels', function (error, response, body) {
  var webhook_uri = null;

  if (!error && response.statusCode == 200) {
    webhook_uri = JSON.parse(body).tunnels[1].public_url + "/webhook";
  } else {
    throw "It looks like ngrok isn't running! Make sure you've started that first with 'ngrok http 1234'";
  }

  if (!process.env.NYLAS_APP_SECRET) {
    throw "You need to add your Nylas client secret to config.js first!"
  }
  // Start the program
  console.log('\n%s\n\nAdd the above url to the webhooks page at https://developer.nylas.com', webhook_uri);
  console.log(`Server running at http://${process.env.HOST}:${process.env.PORT}/`);
  app.listen(process.env.PORT);
});
