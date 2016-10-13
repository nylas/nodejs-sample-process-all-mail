// Initialize the database and create the models we'll use for the example
const db = new Sequelize('database', 'username', 'password', {
  dialect: 'sqlite',
  storage: './database.sqlite',
});

const User = db.define('User', {
  nylasAccountId: { type: Sequelize.STRING },
  nylasAccountToken: { type: Sequelize.STRING },
});

const WatchedThread = db.define('WatchedThread', {
  nylasAccountId: { type: Sequelize.STRING, unique: 'idxAccountThread'},
  nylasThreadId: { type: Sequelize.STRING, unique: 'idxAccountThread'},
});

WatchedThread.belongsTo(User);
User.hasMany(WatchedThread);

// Create tables if they don't exist yet. Note: this is async.
db.sync();

module.exports = {
  db,
  WatchedThread,
  User,
}
