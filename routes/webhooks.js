const {WatchedThread} = require('../src/models');
const ReplyProcessor = require('../src/reply-processor');

/*
Nylas Webhook Data Format:
[
  {
    "date": 1476302954,
    "object": "message",
    "type": "message.created",
    "object_data": {
      "namespace_id": "5gc6bsi1vntkx3yfe1ldfrl22",
      "account_id": "5gc6bsi1vntkx3yfe1ldfrl22",
      "object": "message",
      "attributes": {
        "thread_id": "aoez6036s28dvhhwdfrnou5a2",
        "received_date": 1476301355
      },
      "id": "6v5nf5gb8uhre9s1fizu32wkp",
      "metadata": null
    }
  }
]
*/

// Each request made by Nylas includes an X-Nylas-Signature header. The header
// contains the HMAC-SHA256 signature of the request body, using your client
// secret as the signing key. This allows your app to verify that the
// notification really came from Nylas.
function verifyNylasSignature(req) {
  const hmac = crypto.createHmac('sha256', process.env.NYLAS_APP_SECRET);
  const digest = hmac.update(req.rawBody).digest('hex');
  return (digest === req.get('x-nylas-signature'));
}

module.exports = function(app) {

  // Nylas will check to make sure your webhook is valid by making a GET
  // request to your endpoint with a challenge parameter when you add the
  // endpoint to the developer dashboard.  All you have to do is return the
  // value of the challenge parameter in the body of the response.
  app.get('/webhook', function(req, res) {
    return res.status(200).send(req.query.challenge);
  });

  app.post('/webhook', function(req, res) {
    if (!verifyNylasSignature(req)) {
      console.log("Failed to verify X-Nylas-Signature");
      return res.status(401).send("X-Nylas-Signature failed verification 🚷 ");
    }

    const recentMailThreshold = Date.now() / 1000 - 60 * 60; // last hour

    for (const delta of req.body.deltas) {
      if (delta.type !== 'message.created') {
        continue;
      }

      const {id, account_id} = delta.object_data;
      const {received_date, thread_id} = delta.object_data.attributes;
      const isRecentMail = received_date > recentMailThreshold;

      if (!isRecentMail) {
        // Nylas may be sending us a webhook about a message that it's synced from
        // the user's mailbox, which is not a new message. We don't care about these.
        continue;
      }

      // is this a new message on a thread we're watching? Look it up and see.
      WatchedThread.findOne({
        where: {
          nylasThreadId: thread_id,
          nylasAccountId: account_id,
        },
      }).then(function(watching) {
        if (!watching) {
          return;
        }

        // We've got a reply on a thread we're watching! Hand it off to the
        // reply processor to queue it / apply our business logic.
        ReplyProcessor.handleReply({
          account_id: account_id,
          thread_id: thread_id,
          message_id: id,
        });
      });
    }

    return res.status(200);
  });
}
