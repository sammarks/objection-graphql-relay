exports.up = (knex, Promise) => {
  return knex.schema.createTable('cards', (table) => {
    table.increments('id')
    table.string('name').notNull()
  })
}

exports.down = (knex, Promise) => {
  return knex.schema.dropTableIfExists('cards')
}
