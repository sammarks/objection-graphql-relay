exports.up = (knex, Promise) => {
  return knex.schema.createTable('tags', (table) => {
    table.increments('id')
    table.string('name').notNull()
  })
}

exports.down = (knex, Promise) => {
  return knex.schema.dropTableIfExists('tags')
}
