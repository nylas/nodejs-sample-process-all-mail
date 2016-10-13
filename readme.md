# Nylas Sync Example

This example demonstrates how to process all mail in your user's email accounts,
creating a cache of the messages in an application database and processing each
message as it is ingested.

When an email account is linked via the example web service, a task is queued
which starts pagination through all of the messages available via the Nylas API.
The web service responds to the Nylas Webhooks API to process messages that
are synced or received after the initial pagination. This ensures that every
message in the email account is seen and processed.

This example also demonstrates how to use Redis to queue work, rather than processing
it on the fly as it is received. The fetching and processing of mail is separated
from the web service which responds to webhooks, so the two can be scaled separately.
In production, you might consider using another queue service, like [Amazon SQS](https://aws.amazon.com/sqs/), and 
using the number of items in the queue as a scaling trigger for the worker pool.

# Dependencies

## ngrok

Using the Nylas Webhooks API requires that Nylas is able to reach your machine
to send a webhook. To make testing easy, this example uses [ngrok](https://ngrok.com/).

## NodeJS / NPM

Make sure `node` and `npm` are installed. **This example requires Node 4.0 or greater and uses [ES2016 JavaScript syntax](https://babeljs.io/docs/learn-es2015/).**

## Redis

This example uses [Redis](http://redis.io/) as a simple queue service. In production, you might consider
using ActiveMQ or [Amazon Simple Queue Service]((https://aws.amazon.com/sqs/)) (SQS). To install redis on Mac OS X,
run `brew install redis`.

# Getting Started

1. Install Dependencies:

```bash
npm install
```

2. Place your Nylas App ID and Secret in `config.js`

3. Start a Redis server by running `redis-server` at a command prompt.

4. Start [ngrok](https://ngrok.com/) by running `ngrok http 1234` at a command prompt.

# Running

In two separate terminals, launch the web service and a sync worker. You can run
multiple sync workers if you'd like - they pull tasks from the Redis queue:

```
npm run web
```

```
npm run worker
```

Follow the instructions that are printed to the console by the web service. To
see the example in action, you'll need to link an account by visiting http://localhost:1234/

Once you've linked an account, you'll see `database.sqlite` begin to fill with
email messages, with the subject prefixed with "PROCESSED:".
