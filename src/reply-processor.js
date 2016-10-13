const {User} = require('./models');

const Nylas = require('nylas').config({
  appId: process.env.NYLAS_APP_ID,
  appSecret: process.env.NYLAS_APP_SECRET,
});

function processReply({account_id, thread_id, message_id}) {
  // Cool! This is a new email on a thread we're watching. Queue it for processi
  console.log("A new reply has arrived on a thread we are watching!")

  User.findOne({where: {nylasAccountId: account_id}}).then(function(user) {
    if (!user) {
      // This user isn't in our user database. Maybe they deleted their account?
      return;
    }

    // look up the new message in their inbox via Nylas
    Nylas.with(user.nylasAccountToken).messages.find(message_id).then(function(message) {
       console.log(message.body);
    }).catch(function(err) {
       console.log('Message not found! Error: ' + err.toString());
    });
  });
}

function handleReply({account_id, thread_id, message_id}) {
  // In the real world, you'd want to take this data and put it on a queue,
  // like Redis or ActiveMQ. It's a bit hard to create examples that don't
  // require lots of setup, so for now we'll just call our processor directly.
  // It's also not necessary until you have many thousand reqs.
  processReply({account_id, thread_id, message_id});
}

module.exports = {
  handleReply,
  processReply,
};
