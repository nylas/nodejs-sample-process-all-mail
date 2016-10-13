const {EmailMessage, User} = require('../src/models');
const {FETCH_MESSAGES_QUEUE} = require('../src/constants');
const QueueConnector = require('../src/queue-connector');

const Nylas = require('nylas').config({
  appId: process.env.NYLAS_APP_ID,
  appSecret: process.env.NYLAS_APP_SECRET,
});

module.exports = function(app) {
  app.get('/', function(req, res, next) {
    res.render('index', {
      title: 'Welcome',
      message: 'Link your email to get started.',
      url: Nylas.urlForAuthentication({
        redirectURI: `${global.publicURLRoot}/oauth/callback`,
        trial: false,
      }),
    });
  });

  app.get('/oauth/callback', function (req, res, next) {
    if (req.query.code) {
      Nylas.exchangeCodeForToken(req.query.code).then(function(token) {
        if (!token) {
          res.render('error', {
            message: 'This code has already been used. Please try again.',
            error: { status: '', stack: '' },
          });
          return;
        }

        Nylas.with(token).account.get().then(function(account) {
          // create the user account
          User.create({
            emailAddress: account.emailAddress,
            nylasAccountId: account.id,
            nylasAccountToken: token,
          }).then((user) => {
            console.log(`WEB: Created User ${user.id} (${user.emailAddress}).`);
            console.log(`WEB: Queueing a task to start syncing existing messages in account ${account.id} (${account.emailAddress}).`);
            QueueConnector.send(FETCH_MESSAGES_QUEUE, {token: token, page: 0});
            res.render('success');
          });
        });
      });

    } else if (req.query.error) {
      res.render('error', {
        message: req.query.reason,
        error: {
          status: 'Please try authenticating again or use a different email account.',
          stack: ''
        }
      });
    }
  });
}
