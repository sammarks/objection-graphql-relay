const knex = require('knex')(require('./knexfile'))
const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
const dirtyChai = require('dirty-chai')
const chaiSubset = require('chai-subset')

chai.use(chaiAsPromised)
chai.use(dirtyChai)
chai.use(chaiSubset)

global.jestExpect = global.expect
global.expect = chai.expect
global.knex = knex

beforeEach(async () => {
  await knex.migrate.rollback()
  await knex.migrate.latest()
})

afterEach(async () => {
  await knex.migrate.rollback()
})
