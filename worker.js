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

function receivedNylasMessage(messageJSON, UserId) {
  EmailMessage.create({
    UserId: UserId,
    threadId: messageJSON.threadId,
    subject: messageJSON.subject,
    body: messageJSON.body,
  }).then(({id}) => {
    QueueConnector.send(PROCESS_QUEUE, {id});
  });
}

/*
 Fetch one page of messages from the account with the given token. If messages
 are returned, this job pushes a job for the next page on to the queue.

 For each returned message, this job calls `receivedNylasMessage`, saving it
 to the local database and queueing a job to process it.
*/
function consumeFetchMessagesJob({page, token, userId}, callback) {
  const pageSize = 100;
  const pageParams = {
    limit: pageSize,
    offset: page * pageSize,
  };

  Nylas.with(token).messages.list(pageParams).then((messages) => {
    if (messages.length == 0) {
      return;
    }

    // save all the messages to the database and queue them for processing
    for (const messageJSON of messages) {
      receivedNylasMessage(messageJSON, userId);
    }

    // since messages were returned, queue another page fetch. If it comes
    // back with zero items, we'll stop paginating.
    QueueConnector.send(FETCH_MESSAGES_QUEUE, {userId: userId, token: token, page: page + 1});
    callback();

  }).catch((err) => {
    console.log('PROCESSOR: Could not fetch page of messages! Error: ' + err.toString());
    if (shouldRetryAfterError(err)) {
      console.log('PROCESSOR: Queueing retry...');
      QueueConnector.send(FETCH_MESSAGES_QUEUE, {userId, page, token});
    }
    callback();
  });
}

/*
 Fetch a single message that we received a webhook for. This job calls
 `receivedNylasMessage`, saving it to the local database and queueing a job
 to process it.
*/
function consumeFetchWebhookMessageJob({messageId, token, userId}, callback) {
  Nylas.with(token).messages.find(messageId).then((messageJSON) => {
    receivedNylasMessage(messageJSON, userId);
    callback();
  }).catch((err) => {
    console.log('PROCESSOR: Could not fetch message! Error: ' + err.toString());
    if (shouldRetryAfterError(err)) {
      console.log('PROCESSOR: Queueing retry...');
      QueueConnector.send(FETCH_WEBHOOK_MESSAGE_QUEUE, {messageId, token});
    }
    callback();
  });
}

/*
 Process a message that has been saved to our local database. This job could do
 more significant processing in the future. Right now, it just edits the subject
 of the message and saves it.
*/
function consumeProcessingJob({id}, callback) {
  console.log(`-- Processed message with id ${id}`);

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
