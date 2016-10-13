'use strict';

// Import secret and other configuration
const config = require('./config');
for (const key of Object.keys(config)) {
  process.env[key] = process.env[key] || config[key];
}

const {User, EmailMessage} = require('./src/models');
const QueueConnector = require('./src/queue-connector');
const {FETCH_WEBHOOK_MESSAGE_QUEUE, FETCH_MESSAGES_QUEUE, PROCESS_QUEUE} = require('./src/constants');

const Nylas = require('nylas').config({
  appId: process.env.NYLAS_APP_ID,
  appSecret: process.env.NYLAS_APP_SECRET,
});

function shouldRetryAfterError(err) {
  if ((err.statusCode === 400) || (err.statusCode === 403) || (err.statusCode === 401)) {
    return false;
  }
  return true;
}

function receivedNylasMessage(messageJSON) {
  EmailMessage.create({
    threadId: messageJSON.threadId,
    subject: messageJSON.subject,
    body: messageJSON.body,
  }).then(({id}) => {
    QueueConnector.send(PROCESS_QUEUE, {id});
  });
}

function consumeFetchMessagesJob({page, token}, callback) {
  const pageSize = 100;

  Nylas.with(token).messages.list({limit: pageSize, offset: page * pageSize}).then(function(messages) {
    if (messages.length == 0) {
      return;
    }

    // save all the messages to the database and queue them for processing
    for (const messageJSON of messages) {
      receivedNylasMessage(messageJSON);
    }

    // if more than 0 messages were returned, we want to queue another page fetch
    QueueConnector.send(FETCH_MESSAGES_QUEUE, {token: token, page: page + 1});
    callback();

  }).catch(function(err) {
    console.log('PROCESSOR: Could not fetch page of messages! Error: ' + err.toString());
    if (shouldRetryAfterError(err)) {
      console.log('PROCESSOR: Queueing retry...');
      QueueConnector.send(FETCH_MESSAGES_QUEUE, {page, token});
    }
    callback();
  });
}

function consumeFetchWebhookMessageJob({messageId, token}, callback) {
  Nylas.with(token).messages.find(messageId).then(function(messageJSON) {
    receivedNylasMessage(messageJSON);
    callback();
  }).catch(function(err) {
    console.log('PROCESSOR: Could not fetch message! Error: ' + err.toString());
    if (shouldRetryAfterError(err)) {
      console.log('PROCESSOR: Queueing retry...');
      QueueConnector.send(FETCH_WEBHOOK_MESSAGE_QUEUE, {messageId, token});
    }
    callback();
  });
}

function consumeProcessingJob({id}, callback) {
  console.log(`-- Processed message with id ${id}`);

  // right now, this doesn't do much. Let's imagine that it processes each of the
  // messages and just appends something to the body as a demo.

  EmailMessage.findById(id).then((message) => {
    message.subject = `PROCESSED: ${message.subject}`;
    return message.save();
  }).then(() => {
    callback();
  });
}

QueueConnector.connect(() => {
  console.log("PROCESSOR: Connected to Redis. Waiting for work...");
  QueueConnector.consume(FETCH_WEBHOOK_MESSAGE_QUEUE, consumeFetchWebhookMessageJob);
  QueueConnector.consume(FETCH_MESSAGES_QUEUE, consumeFetchMessagesJob);
  QueueConnector.consume(PROCESS_QUEUE, consumeProcessingJob);
});
