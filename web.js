'use strict';

/* This is the main file for the web service part of the demo application.
It allows users to link accounts via the Nylas Auth API, and listens for
incoming webhooks.

When new accounts are linked or webhooks are received, it queues jobs for
other worker processes.
*/
const express = require('express');
const request = require('request');
const path = require('path');
const QueueConnector = require('./src/queue-connector');

const app = express();

// Custom middleware that keeps the raw request body. This is necessary to checksum
// the data we receive in webhooks and ensure their authenticity.
app.use(function(req, res, next) {
    req.rawBody = '';
    req.on('data', function(chunk) {
        req.rawBody += chunk;
    });
    next();
});

const bodyParser = require('body-parser');
app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

// Import secret and other configuration
const config = require('./config');
for (const key of Object.keys(config)) {
  process.env[key] = process.env[key] || config[key];
}

// Attach routes to Express
require('./routes/webhooks')(app);
require('./routes/authentication')(app);

// Configure views for Express
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

global.publicURLRoot = null;

QueueConnector.connect(() => {
  // Setup ngrok settings to ensure everything works locally
  request('http://localhost:4040/api/tunnels', function (error, response, body) {
    if (error || response.statusCode !== 200) {
      throw "It looks like ngrok isn't running! Make sure you've started that first with 'ngrok http 1234'";
    }

    if (!process.env.NYLAS_APP_SECRET) {
      throw "Before running this example, edit ./config.js and add your Nylas App ID and Secret.";
    }

    global.publicURLRoot = JSON.parse(body).tunnels[1].public_url
    const webhookURI = `${global.publicURLRoot}/webhook`.replace('http:', 'https:');

    // Start the program
    console.log(`Server running at http://${process.env.HOST}:${process.env.PORT}/`);
    console.log(`\nIf you haven't already, follow these steps:`);
    console.log(` - Visit https://developer.nylas.com and create a 'message.created' webhook with the URL: ${webhookURI}`);
    console.log(` - Start one or more sync workers by running 'npm start worker' in another console.`);
    console.log(` - Link an account to sync by visting http://${process.env.HOST}:${process.env.PORT}/!`);
    console.log(`\nNot receiving webhooks? Make sure it hasn't been disabled on the dashboard. If it has, delete it and create it again.`);
    app.listen(process.env.PORT);
  });
});
