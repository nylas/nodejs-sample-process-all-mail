const crypto = require('crypto');

const {EmailMessage, User} = require('../src/models');
const {FETCH_WEBHOOK_MESSAGE_QUEUE} = require('../src/constants');
const QueueConnector = require('../src/queue-connector');

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

module.exports = (app) => {

  // Nylas will check to make sure your webhook is valid by making a GET
  // request to your endpoint with a challenge parameter when you add the
  // endpoint to the developer dashboard.  All you have to do is return the
  // value of the challenge parameter in the body of the response.
  app.get('/webhook', (req, res) => {
    console.log(`WEBHOOK: Responding to webhook challenge.`)
    return res.status(200).send(req.query.challenge);
  });

  app.post('/webhook', (req, res) => {
    console.log(`WEBHOOK: Received webhook.`)

    if (!verifyNylasSignature(req)) {
      console.error("Failed to verify X-Nylas-Signature");
      return res.status(401).send("X-Nylas-Signature failed verification 🚷 ");
    }

    for (const delta of req.body.deltas) {
      if (delta.type === 'message.created') {
        const {id, account_id} = delta.object_data;

        User.find({where: {nylasAccountId: account_id}}).then((user) => {
          if (!user) {
            console.error(`WEBHOOK: Ignoring webhook for message in account id ${account_id}, which is not a User.`)
            return;
          }

          // We've got a reply on a thread we're watching! Hand it off to the
          // reply processor to queue it / apply our business logic.
          console.log(`WEBHOOK: Queueing fetch for message: ${id}`);
          QueueConnector.send(FETCH_WEBHOOK_MESSAGE_QUEUE, {
            messageId: id,
            userId: user.id,
            token: user.nylasAccountToken,
          });
        });
      }
    }

    return res.status(200);
  });
}
