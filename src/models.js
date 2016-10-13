// Initialize the database and create the models we'll use for the example.
const Sequelize = require('sequelize');
const db = new Sequelize('database', 'username', 'password', {
  dialect: 'sqlite',
  storage: './database.sqlite',
  logging: false,
});

const User = db.define('User', {
  emailAddress: { type: Sequelize.STRING },
  nylasAccountId: { type: Sequelize.STRING },
  nylasAccountToken: { type: Sequelize.STRING },
});

const EmailMessage = db.define('EmailMessage', {
  subject: { type: Sequelize.STRING },
  threadId: { type: Sequelize.STRING },
  body: { type: Sequelize.TEXT },
});

EmailMessage.belongsTo(User);
User.hasMany(EmailMessage);

db.sync();

module.exports = {
  db,
  User,
  EmailMessage,
}
