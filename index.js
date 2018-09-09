const { Model, QueryBuilder: ObjectionQueryBuilder } = require('objection')
const {
  toGlobalId,
  offsetToCursor,
  cursorToOffset,
  fromGlobalId: graphqlFromGlobalId
} = require('graphql-relay')
const util = require('util')
const _ = require('lodash')
const defer = require('promise-defer')

const _connectionMapper = (array, { first, after }, total) => {
  after = after ? cursorToOffset(after) : 0
  return {
    pageInfo: {
      hasPreviousPage: !!after,
      hasNextPage: total > (after + first)
    },
    edges: array.map((node) => {
      if (!node.id) {
        throw new Error(`Came across node without an ID: ${util.inspect(node)}`)
      }
      return { cursor: offsetToCursor(node.id), node }
    }),
    totalCount: total
  }
}

const connectionWrapper = (field) => {
  if (_.isString(field)) {
    return (parent, args) => {
      const after = args.after ? cursorToOffset(args.after) : null
      return parent['paginated' + field](args.first, after, args).then((result) => {
        return _connectionMapper(result.results, args, result.total)
      })
    }
  } else if (_.isObject(field) && !_.isArray(field)) {
    const { collectionInfo, args } = field
    if (_.isArray(collectionInfo) && _.isObject(args) && !_.isArray(args)) {
      return _connectionMapper(collectionInfo, args, collectionInfo.length)
    } else if (_.isObject(collectionInfo) && _.isArray(collectionInfo.results) && collectionInfo.total) {
      return _connectionMapper(collectionInfo.results, args, collectionInfo.total)
    }
  }
  throw new Error('Not a valid argument: field. Must be a string or an object containing an array ' +
    '(or a collectionInfo with results and total) and args keys.')
}

const singleRelationshipWrapper = (relationshipName) => {
  return (parent) => {
    if (parent[relationshipName]) {
      return Promise.resolve(parent[relationshipName])
    } else {
      return parent.$loadRelated(relationshipName).then((newParent) => {
        return newParent[relationshipName]
      })
    }
  }
}

const idWrapper = (modelName) => {
  return (parent) => {
    return new Promise((resolve, reject) => {
      if (!parent.id) {
        return reject(new Error('The passed model does not contain an ID.'))
      }
      if (modelName) {
        return resolve(toGlobalId(modelName, parent.id))
      }
      if (!modelName && !(parent instanceof Model)) {
        return reject(new Error('The passed model is not valid.'))
      }
      return resolve(toGlobalId(parent.constructor.name, parent.id))
    })
  }
}

const fromGlobalId = (modelName, globalId) => {
  if (!globalId) return null
  const { type, id } = graphqlFromGlobalId(globalId)
  if (!type) {
    throw new Error(`Identifier ${globalId} is not valid.`)
  }
  if (modelName !== type) {
    throw new Error(`Identifier ${globalId} is a '${type}' but we were expecting a '${modelName}'`)
  }
  return id
}

const range = (first, after, deferred) => {
  return (builder) => {
    const limit = first || 0
    if (after) {
      builder.limit(limit).offset(after)
    } else {
      builder.limit(limit)
    }

    deferred.hasValidPromise = true
    deferred.resolve(builder.clone().range())
  }
}

const orderById = (builder) => {
  builder.orderBy(`${builder._modelClass.tableName}.id`)
}

const excludeSelf = (instanceTableName, instanceId) => {
  return (builder) => {
    const builderTableName = builder._modelClass.tableName
    if (builderTableName === instanceTableName) {
      builder.where(`${builderTableName}.id`, '!=', instanceId)
    }
  }
}

const defaultExtraFilter = (builder) => {}
const pagedRelationQuery = (instance, field, first, after, extraFilter = defaultExtraFilter, orderBy = orderById) => {
  let totalDeferred = defer()
  return instance.$query().eager(`${field}(orderBy, excludeSelf, extraFilter, range)`, {
    orderBy,
    excludeSelf: excludeSelf(instance.constructor.tableName, instance.id),
    extraFilter,
    range: range(first, after, totalDeferred)
  }).then((result) => {
    const results = field.split('.').reduce((finalResult, segment) => {
      return _.uniqBy(_.flatten(finalResult.map((item) => item[segment])), 'id')
    }, [result])
    if (totalDeferred.hasValidPromise) {
      return totalDeferred.promise.then(({ total }) => {
        return { results, total }
      })
    } else {
      return { results, total: 0 }
    }
  })
}

class QueryBuilder extends ObjectionQueryBuilder {
  static forClass (modelClass) {
    const builder = new this(modelClass)
    return builder.context({ modelClass })
  }
}

const relayModel = (ModelClass) => {
  ModelClass.QueryBuilder = QueryBuilder
  ModelClass.prototype.pagedRelationQuery = function (field, first = 10, after = null, extraFilter, orderBy) {
    return pagedRelationQuery(this, field, first, after, extraFilter, orderBy)
  }
  return ModelClass
}

module.exports = {
  idWrapper,
  fromGlobalId,
  singleRelationshipWrapper,
  connectionWrapper,
  pagedRelationQuery,
  range,
  QueryBuilder,
  relayModel
}
