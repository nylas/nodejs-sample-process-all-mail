// This is a very small implementation of a task queue in redis. Depending
// on your infrastructure, you may want to replace this with a different
// queueing library using ActiveMQ, Amazon Simple Queue Service, etc.

const redis = require("redis");

class QueueConnector {
  constructor() {
    this.queues = {};
  }

  connect(callback) {
    this.client = redis.createClient();

    this.client.on('error', (err) => {
      console.error("This demo requires Redis, a simple message broker. To install redis on Mac OS X, use `brew install redis`");
      console.error("After installing, run `redis-server` in another terminal and restart this demo.");
      console.error(err);

      // In production, this will trigger a process monitor to restart the process.
      process.exit();
    });

    this.client.on('connect', callback);
  }

  consume(name, callback) {
    this.client.lpop(name, (err, data) => {
      if (err) {
        console.error(err);
        return;
      }
      if (data) {
        console.log(data);
        callback(JSON.parse(data), () => {
          this.consume(name, callback);
        });
      } else {
        setTimeout(() => {
          this.consume(name, callback);
        }, 100);
      }
    });
  }

  send(name, data) {
    console.log(`QUEUE: Appending item to queue ${name}.`)
    this.client.rpush(name, JSON.stringify(data));
  }
}

module.exports = new QueueConnector();
