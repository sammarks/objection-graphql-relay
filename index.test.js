const { Model } = require('objection')
const { toGlobalId, cursorToOffset, offsetToCursor } = require('graphql-relay')
const defer = require('promise-defer')
const {
  idWrapper,
  fromGlobalId,
  singleRelationshipWrapper,
  connectionWrapper,
  relayModel,
  range
} = require('./index')

class SubModel extends Model {}
class DumbModel extends SubModel {
  constructor (id) {
    super()
    this.id = id
  }
}

describe('#singleRelationshipMapper()', () => {
  let wrapper
  beforeEach(() => {
    wrapper = singleRelationshipWrapper('trophy')
  })
  it('returns the value of the relationship if it\'s already set on the parent', () => {
    return expect(wrapper({ trophy: 'test' })).to.eventually.equal('test')
  })
  it('loads the relation and returns the value if it\'s not already set on the parent', () => {
    const parentStub = {
      $loadRelated: jest.fn(() => Promise.resolve({ trophy: 'test' }))
    }
    return expect(wrapper(parentStub)).to.eventually.equal('test').then(() => {
      expect(parentStub.$loadRelated.mock.calls).to.deep.equal([['trophy']])
    })
  })
})

describe('#connectionWrapper()', () => {
  let parentStub
  beforeEach(() => {
    parentStub = {
      paginatedBoom: jest.fn(() => Promise.resolve({
        results: [
          { id: toGlobalId('Foo', 1) },
          { id: toGlobalId('Foo', 2) }
        ],
        total: 2
      }))
    }
  })
  it('sets hasNextPage to true if there are more items', async () => {
    const result = await connectionWrapper('Boom')(parentStub, { first: 1 })
    expect(result.pageInfo.hasNextPage).to.be.true()
  })
  it('sets hasNextPage to false if there are not more items', async () => {
    const result = await connectionWrapper('Boom')(parentStub, { first: 2 })
    expect(result.pageInfo.hasNextPage).to.be.false()
  })
  it('sets hasPreviousPage to true if there is an after', async () => {
    const result = await connectionWrapper('Boom')(parentStub, { first: 2, after: offsetToCursor(1) })
    expect(result.pageInfo.hasPreviousPage).to.be.true()
  })
  it('respects cursors', async () => {
    await connectionWrapper('Boom')(parentStub, { first: 2, after: offsetToCursor(1) })
    expect(parentStub.paginatedBoom.mock.calls[0][0]).to.equal(2)
    expect(parentStub.paginatedBoom.mock.calls[0][1]).to.equal(cursorToOffset(offsetToCursor(1)))
  })
  it('handles an empty array of results', async () => {
    parentStub.paginatedBoom = jest.fn(() => Promise.resolve({
      results: [],
      total: 0
    }))
    const result = await connectionWrapper('Boom')(parentStub, { first: 10 })
    expect(result.edges).to.deep.equal([])
    expect(result.pageInfo.hasNextPage).to.be.false()
    expect(result.pageInfo.hasPreviousPage).to.be.false()
  })
  describe('when passed a string', () => {
    let result
    beforeEach(async () => {
      result = await connectionWrapper('Boom')(parentStub, { first: 20 })
    })
    it('returns totalCount properly', () => {
      expect(result.totalCount).to.equal(2)
    })
    it('sets hasPreviousPage properly', () => {
      expect(result.pageInfo.hasPreviousPage).to.be.false()
    })
    it('sets hasNextPage properly', () => {
      expect(result.pageInfo.hasNextPage).to.be.false()
    })
    it('assigns cursors properly', () => {
      expect(result.edges.map((edge) => edge.cursor)).to.deep.equal([
        offsetToCursor(0),
        offsetToCursor(1)
      ])
    })
    it('returns the results properly', () => {
      expect(result.edges).to.containSubset([
        { node: { id: toGlobalId('Foo', 1) } },
        { node: { id: toGlobalId('Foo', 2) } }
      ])
    })
    it('calls the data function properly', () => {
      expect(parentStub.paginatedBoom.mock.calls).to.deep.equal([
        [20, null, { first: 20 }]
      ])
    })
  })
  describe('when passed an object and collectionInfo is an object', () => {
    let result
    beforeEach(async () => {
      const args = { first: 1, after: offsetToCursor(1) }
      const collectionInfo = {
        results: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }],
        total: 10
      }
      result = await connectionWrapper({ collectionInfo, args })
    })
    it('returns totalCount properly', () => {
      expect(result.totalCount).to.equal(10)
    })
    it('sets hasPreviousPage properly', () => {
      expect(result.pageInfo.hasPreviousPage).to.be.true()
    })
    it('sets hasNextPage properly', () => {
      expect(result.pageInfo.hasNextPage).to.be.true()
    })
  })
  describe('when passed an object and collectionInfo is an object with 0 items', () => {
    let result
    beforeEach(async () => {
      const args = { first: 10, after: null }
      const collectionInfo = {
        results: [],
        total: 0
      }
      result = await connectionWrapper({ collectionInfo, args })
    })
    it('returns totalCount properly', () => {
      expect(result.totalCount).to.equal(0)
    })
  })
  describe('when passed an object and collectionInfo is an array', () => {
    let result
    beforeEach(async () => {
      const args = { first: 1, after: offsetToCursor(1) }
      result = await connectionWrapper({ collectionInfo: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }], args })
    })
    it('returns totalCount properly', () => {
      expect(result.totalCount).to.equal(4)
    })
    it('sets hasPreviousPage properly', () => {
      expect(result.pageInfo.hasPreviousPage).to.be.true()
    })
    it('sets hasNextPage properly', () => {
      expect(result.pageInfo.hasNextPage).to.be.true()
    })
    it('handles when collectionInfo is empty', async () => {
      result = await connectionWrapper({ collectionInfo: [], args: { first: 1 } })
      expect(result.totalCount).to.equal(0)
      expect(result.edges).to.deep.equal([])
    })
  })
  describe('array argument', () => {
    let result = null
    const storeItems = [
      {
        id: 2,
        organizationId: 1,
        name: 'store item 2',
        points: 200,
        createdAt: '2017-07-25T12:31:29.838Z',
        updatedAt: '2017-07-25T12:31:29.838Z',
        organization: {
          id: 1,
          name: 'organization one',
          permissions: null,
          createdAt: '2017-07-25T12:31:29.747Z',
          updatedAt: '2017-07-25T12:31:29.747Z'
        }
      }
    ]
    beforeEach(async () => {
      result = await connectionWrapper({collectionInfo: storeItems, args: {first: 2}})
    })
    it('does not have previous page', () => {
      expect(result.pageInfo.hasPreviousPage).to.be.false()
    })
    it('does not have next page', () => {
      expect(result.pageInfo.hasNextPage).to.be.false()
    })
    it('assigns cursors properly', () => {
      expect(result.edges.map((edge) => edge.cursor)).to.deep.equal([
        offsetToCursor(0)
      ])
    })
    it('returns the results properly', () => {
      expect(result.edges).to.containSubset([{
        node:
          {
            id: 2,
            organizationId: 1,
            name: 'store item 2',
            points: 200,
            createdAt: '2017-07-25T12:31:29.838Z',
            updatedAt: '2017-07-25T12:31:29.838Z',
            organization: {
              id: 1,
              name: 'organization one',
              permissions: null,
              createdAt: '2017-07-25T12:31:29.747Z',
              updatedAt: '2017-07-25T12:31:29.747Z'
            }
          }
      }])
    })
  })
  describe('invalid argument', () => {
    const err = 'Not a valid argument: field. Must be a string or an object containing an array ' +
      '(or a collectionInfo with results and total) and args keys.'
    it('throws an error when argument is an int', () => {
      expect(() => connectionWrapper(1)).to.throw(Error, err)
    })
    it('throws an error when argument is an array', () => {
      expect(() => connectionWrapper([])).to.throw(Error, err)
    })
    it('throws an error when argument is an object and doesnt contain array', () => {
      expect(() => connectionWrapper({args: { first: 1 }})).to.throw(Error, err)
    })
    it('throws an error when argument is an object and doesnt contain args', () => {
      expect(() => connectionWrapper({collectionInfo: []})).to.throw(Error, err)
    })
    it('throws an error when argument is an object and array is invalid', () => {
      expect(() => connectionWrapper({collectionInfo: 1})).to.throw(Error, err)
    })
    it('throws an error when argument is an object and args is invalid', () => {
      expect(() => connectionWrapper({collectionInfo: [], args: 1})).to.throw(Error, err)
    })
  })
})

describe('#idWrapper()', () => {
  it('generates a generic ID properly', async () => {
    const model = new DumbModel('foo')
    expect(await idWrapper()(model)).to.equal(toGlobalId('DumbModel', 'foo'))
  })
  it('calls toGlobalId with a given modelName if passed', async () => {
    const model = { id: 'baz' }
    expect(await idWrapper('SomeModel')(model)).to.equal(toGlobalId('SomeModel', 'baz'))
  })
  it('throws an error when the parent does not have an id', async () => {
    const model = new DumbModel()
    return expect(idWrapper()(model)).to.be.rejectedWith('The passed model does not contain an ID.')
  })
  it('throws an error when the parent is not a valid class', async () => {
    const model = { foo: 'bar', id: 'foo' }
    return expect(idWrapper()(model)).to.be.rejectedWith('The passed model is not valid.')
  })
})

describe('#fromGlobalId()', () => {
  it('returns the proper local id', () => {
    const globalId = toGlobalId('Foo', 'bar')
    expect(fromGlobalId('Foo', globalId)).to.equal('bar')
  })
  it('throws an error if the class of the identifier doesnt match the passed class', () => {
    const globalId = toGlobalId('Foobar', 'bar')
    expect(() => fromGlobalId('Foo', globalId)).to
      .throw(Error, `Identifier ${globalId} is a 'Foobar' but we were expecting a 'Foo'`)
  })
  it('throws an error if the id is invalid', () => {
    expect(() => fromGlobalId('Foo', 'boom')).to.throw(Error, 'Identifier boom is not valid.')
  })
  it('returns null if the passed id is null', () => {
    expect(fromGlobalId('Foobar', null)).to.equal(null)
  })
})

Model.knex(knex)
class Card extends Model {}
class Tag extends Model {}
Card.tableName = 'cards'
Tag.tableName = 'tags'
Card.relationMappings = {
  tags: {
    relation: Model.ManyToManyRelation,
    modelClass: Tag,
    join: {
      from: 'cards.id',
      to: 'tags.id',
      through: {
        from: 'card_tags.card_id',
        to: 'card_tags.tag_id'
      }
    }
  }
}
Tag.relationMappings = {
  cards: {
    relation: Model.ManyToManyRelation,
    modelClass: Card,
    join: {
      from: 'tags.id',
      to: 'cards.id',
      through: {
        from: 'card_tags.tag_id',
        to: 'card_tags.card_id'
      }
    }
  }
}
Card = relayModel(Card)
Tag = relayModel(Tag)

describe('#pagedRelationQuery()', () => {
  let card, secondCard, thirdCard
  let tags = []
  beforeEach(async () => {
    card = await Card.query().insertGraph({
      id: 1,
      name: 'test card',
      tags: [
        { name: 'tag one' },
        { name: 'tag two' },
        { name: 'tag three' },
        { name: 'tag four' },
        { name: 'tag five' }
      ]
    })
    card = await Card.query().where('id', card.id).eager('tags').first()
    tags = card.tags
    secondCard = await Card.query().insertGraph({
      id: 2,
      name: 'second test card',
      tags: [
        { '#dbRef': tags[0].id },
        { '#dbRef': tags[1].id }
      ]
    })
    thirdCard = await Card.query().insertGraph({
      id: 3,
      name: 'third test card',
      tags: [
        { '#dbRef': tags[1].id },
        { '#dbRef': tags[0].id }
      ]
    })
  })
  it('loads properly with default values', async () => {
    const result = await card.pagedRelationQuery('tags', 3)
    expect(result.results.length).to.equal(3)
    expect(result.results[0]).to.containSubset({ name: 'tag one' })
    expect(result.results[1]).to.containSubset({ name: 'tag two' })
    expect(result.results[2]).to.containSubset({ name: 'tag three' })
    expect(result.total).to.equal(5)
  })
  it('loads deep relationships properly with default values', async () => {
    const result = await card.pagedRelationQuery('tags.cards', 1)
    expect(result.results.length).to.equal(1)
    expect(result.results[0]).to.containSubset({ id: secondCard.id })
  })
  it('supports paging', async () => {
    const result = await card.pagedRelationQuery('tags', 3, 3)
    expect(result.results.length).to.equal(2)
    expect(result.results[0]).to.containSubset({ name: 'tag four' })
    expect(result.results[1]).to.containSubset({ name: 'tag five' })
    expect(result.total).to.equal(5)
  })
  it('supports deep paging', async () => {
    const result = await card.pagedRelationQuery('tags.cards', 20, 3)
    expect(result.results.length).to.equal(1)
    expect(result.results[0]).to.containSubset({ id: thirdCard.id })
  })
  it('returns empty array with invalid paging', async () => {
    const result = await card.pagedRelationQuery('tags', 3, 394939)
    expect(result.results).to.be.an('array')
    expect(result.results.length).to.equal(0)
    expect(result.total).to.equal(5)
  })
  it('works with an extra filter', async () => {
    const extraFilter = (builder) => {
      if (builder._modelClass.tableName === Card.tableName) {
        builder.where(`${builder._modelClass.tableName}.name`, '!=', 'second test card')
      }
    }
    const result = await card.pagedRelationQuery('tags.cards', 20, null, extraFilter)
    expect(result.results.length).to.equal(1)
    expect(result.results[0]).to.containSubset({ id: thirdCard.id })
  })
  it('works with a custom orderBy function', async () => {
    const orderBy = (builder) => {
      builder.orderBy('cards.id', 'desc')
    }
    const result = await card.pagedRelationQuery('tags.cards', 5, null, undefined, orderBy)
    expect(result.results.length).to.equal(2)
    expect(result.results[0]).to.containSubset({ id: 3 })
    expect(result.results[1]).to.containSubset({ id: 2 })
  })
})

describe('#range()', () => {
  let builder, limitStub, offsetStub
  beforeEach(() => {
    offsetStub = jest.fn()
    limitStub = jest.fn(() => {
      return { offset: offsetStub }
    })
    builder = {
      clone: () => {
        return {
          range: () => 'foo'
        }
      },
      limit: limitStub
    }
  })
  it('calls only limit when after is not set', () => {
    const deferred = defer()
    range(1, 0, deferred)(builder)
    expect(limitStub.mock.calls).to.deep.equal([[1]])
    expect(offsetStub.mock.calls).to.have.length(0)
    return expect(deferred.promise).to.eventually.equal('foo')
  })
  it('calls limit and then offset when after is set', () => {
    const deferred = defer()
    range(1, 2, deferred)(builder)
    expect(limitStub.mock.calls).to.deep.equal([[1]])
    expect(offsetStub.mock.calls).to.deep.equal([[2]])
    return expect(deferred.promise).to.eventually.equal('foo')
  })
  it('only allows integers to be passed to limit', () => {
    const deferred = defer()
    range(null, 0, deferred)(builder)
    expect(limitStub.mock.calls).to.deep.equal([[0]])
    expect(offsetStub.mock.calls).to.have.length(0)
    return expect(deferred.promise).to.eventually.equal('foo')
  })
})
