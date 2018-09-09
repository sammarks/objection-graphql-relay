exports.up = (knex, Promise) => {
  return knex.schema.createTable('card_tags', (table) => {
    table.integer('card_id').unsigned()
    table.foreign('card_id').references('cards.id')
    table.integer('tag_id').unsigned()
    table.foreign('tag_id').references('tags.id')
    table.unique(['card_id', 'tag_id'])
  })
}

exports.down = (knex, Promise) => {
  return knex.schema.dropTableIfExists('card_tags')
}
