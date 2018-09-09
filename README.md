![][header-image]

[![CircleCI][circleci-image]][circleci-url]
[![NPM version][npm-version]][npm-url]
[![NPM downloads][npm-downloads]][npm-url]
![License][license]
![Issues][issues]

`objection-graphql-relay` is a collection of helpers used for combining [Objection][objection] models 
with [GraphQL Relay.][graphql-relay]

## Get Started

```sh
npm install --save objection-graphql-relay objection
```

Below is a full-featured example of how to use the helpers in the library. You should
only use the functions you require.

### Setup Models

```js
const { Model } = require('objection')
const { relayModel } = require('objection-graphql-relay')

@relayModel // Or you can use module.exports = relayModel(Card)
class Card extends Model {
  static tableName = 'cards'
  static get relationshipMappings () {
    return {
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
      },
      organization: {
        relation: Model.BelongsToOneRelation,
        modelClass: Organization,
        join: {
          from: 'cards.organization_id',
          to: 'organizations.id'
        }
      }
    }
  }
  paginatedTags (first, after) {
    // Simple many-to-many or has-many relationships.
    return this.pagedRelationQuery('tags', first, after)
  }
  paginatedRelatedCards (first, after) {
    // More complicated deep relationships with an optional filter.
    return this.pagedRelationQuery('tags.cards', first, after, (builder) => {
      // You can leave out this entire argument if you don't need extra filtering.
      if (builder._modelClass.tableName === Card.tableName) {
        builder.where(`${builder._modelClass.tableName}.should_show_related`, true)
      }
    })
  }
}

@relayModel
class Organization extends Model {
  static tableName = 'organizations'
  static get relationshipMappings () {
    return {
      cards: {
        relation: Model.HasManyRelation,
        modelClass: Card,
        join: {
          from: 'organizations.id',
          to: 'cards.organization_id'
        }
      }
    }
  }  
}

@relayModel
class Tag extends Model {
  static tableName = 'tags'
  static get relationshipMappings () {
    return {
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
  }
}

module.exports = { Card, Tag, Organization }
```

### Setup Helper Functions

cards.js
```js
const getCards = (first, after) => {
  const query = Card.query().limit(first)
    .orderBy('id', 'asc') // Cursors are ID-based currently (will have to support sorting later).
  if (after) {
    return query.offset(after).range()
  } else {
    return query.range() // Adding .range() makes sure the result includes "results" and "total"
  }
}

module.exports = { getCards }
```

### Setup Resolvers

cards_resolver.js
```js
const { idWrapper, connectionWrapper, singleRelationshipWrapper } = require('objection-graphql-relay')
const { cursorToOffset, toGlobalId } = require('graphql-relay')
const { getCards } = require('./cards.js')

module.exports = {
  Query: {
    cards: async (parent, args) => {
      const after = args.after ? cursorToOffset(args.after) : null
      const cards = await getCards(args.first, after)
      return connectionWrapper({ collectionInfo: cards, args })
    }
  },
  Card: {
    id: idWrapper(),
    organization: singleRelationshipWrapper('organization'),
    tags: connectionWrapper('Tags'), // This will call paginatedTags() on the model.
    relatedCards: connectionWrapper('RelatedCards') // This will call paginatedRelatedCards() on the model.
  }
}
```

## API Reference

### `relayModel(ModelClass): ModelClass`

This is a decorator function that attaches the proper QueryBuilder to the passed
model class and adds the `pagedRelationQuery()` helper method. It returns the same
class with the prototype and static properties modified.

### `idWrapper(modelName): function`

Returns a resolver that automatically generates an ID for the parent model, using
the class name as the type. Alternatively, if the parent is not a model, you can
pass in the model name as the first argument.

### `fromGlobalId(modelName, globalId): string`

Verifies that the GraphQL ID (globalId) is of the type `modelName` and returns the
`modelName`-specific ID. Throws an error if `globalId` is not of the type `modelName`

This function is useful for grabbing arguments on inputs where you must reference
other nodes. It handles parsing the ID and verifying that it is the class you're expecting.

### `pagedRelationQuery(instance, field, first, after, [extraFilter, orderBy]): Promise<object>`

_The `pagedRelationQuery()` method on the Model has the same definition minus the first argument._

Loads the `field` relationship on the passed model instance (or the current model instance if
using the model method), limiting based on the `first` and `after` arguments. Optionally filters
with the `extraFilter` argument (which is an Objection relationship filter), and ordering by
the `orderBy` filter (which is also an Objection relationship filter).

`field` can have one of two types of values:

- `relationship` (example: `tags`) - This fetches the single-depth relationship. In this case,
    the current model has multiple tags related to it. This will fetch all of those tags and
    support pagination.
- `relationship.otherRelationship` (example: `tags.cards`) - This fetches the multi-depth
    relationship. In this case, the current model has multiple tags related to it, and those
    tags relate to other `cards` (assuming the current model is a `card`). This will fetch
    all unique `cards` (that are not the current `card`) related through their common `tags`.

## Other Questions

### Overriding QueryBuilder

If you have to override the QueryBuilder, make sure you extend it from the QueryBuilder
exported from this module.

### What is going on inside `pagedRelationQuery()`?

This is a rather complicated method, but the purpose of it is to help resolve
relationships in models. It's used if you have a many-to-many, belongs-to-many,
or has-many relationship defined on the model. If you're interested in resolving
relationships for a single-model relationship, you'll want to use the 
`singleRelationshipWrapper()` function instead. With that said, here we go with
the explanation:

For this example, let's say we have a "tag" model and a "card" model, and they are
related through a many-to-many relationship. In the example, we are trying to find
all other cards that are related to the current card through the same tags (so the
relationship path would be `tags.cards` because we want all the cards related to
the tags that are related to the current card).

To start with, we'll explain this line:

```js
const results = field.split('.').reduce(...)
```

This section is responsible for gathering all of the second+-level relationships
and flattening them into a single array, also reducing duplicates. We start by
splitting the field (so maybe something like "tags.cards" to find all other cards
with at least one common tag with the current card) into segments. So we end up with
`["tags", "card"]`, and then we reduce with those segments starting with the initial
result object inside an array.

Then, inside the `reduce()`, we process each of the relationships for the current item,
flatten the results, and remove duplicates. In the case of the example above, result
contains a key called "tags" (since result is a card in this example). So segment is
currently "tags" and finalResult is currently `[result]`.

We loop through each item in finalResult and pull out the "tags" array, and then flatten
to remove duplicates.

In the second iteration of this function, finalResult is equal to all of the tags in the
original result (the original card), and segment is equal to "cards."

So we loop through each tag, and pull out the "cards" inside each tag. Then we flatten
all of them into a single array, and then remove duplicates based on the ID.

Once that's done, that'll be the final iteration of our example and we'll end up with a flat
array of unique cards that are related to the current card through the tags the current card
is associated with.

[header-image]: https://raw.githubusercontent.com/sammarks/art/master/objection-graphql-relay/header.jpg
[circleci-image]: https://img.shields.io/circleci/project/github/sammarks/objection-graphql-relay.svg
[circleci-url]: https://circleci.com/gh/sammarks/objection-graphql-relay/tree/master
[npm-version]: https://img.shields.io/npm/v/objection-graphql-relay.svg
[npm-downloads]: https://img.shields.io/npm/dm/objection-graphql-relay.svg
[npm-url]: https://www.npmjs.com/package/objection-graphql-relay
[license]: https://img.shields.io/github/license/sammarks/objection-graphql-relay.svg
[issues]: https://img.shields.io/github/issues/sammarks/objection-graphql-relay.svg
[objection]: https://www.npmjs.com/package/objection
[graphql-relay]: https://www.npmjs.com/package/graphql-relay
