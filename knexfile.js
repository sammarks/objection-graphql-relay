module.exports = {
  client: 'sqlite3',
  useNullAsDefault: true,
  connection: {
    filename: ':memory:'
  },
  database: {
    pool: {
      afterCreate: (connection, callback) => {
        connection.exec('PRAGMA foreign_keys = ON', callback)
      }
    }
  }
}
