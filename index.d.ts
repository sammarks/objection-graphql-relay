import { Model, ModelClass, QueryBuilder } from 'objection';

declare module 'objection-graphql-relay' {
  interface ConnectionWrapperResults {
    results: any[];
    total: number;
  }

  type ConnectionWrapperField = string | any[] | ConnectionWrapperResults;

  interface Edge {
    cursor: string;
    node: Model;
  }

  interface Connection {
    pageInfo: {
      hasPreviousPage: boolean;
      hasNextPage: boolean;
    }
    edges: Edge[];
    totalCount: number;
  }

  export function idWrapper(modelName: string): (parent: Model) => Promise<string>;
  export function fromGlobalId(modelName: string, globalId: string): string;
  export function singleRelationshipWrapper(relationshipName: string): (parent: Model) => Promise<ModelClass<Model>> | Promise<null>;
  export function connectionWrapper(field: ConnectionWrapperField): Connection;
  export function pagedRelationQuery(instance: ModelClass<Model>, field: string | object, first: number, after: number, extraFilter?: (builder: QueryBuilder<Model>) => object, orderBy?: (builder: QueryBuilder<Model>) => object): Promise<ConnectionWrapperResults>;
  export function range(first: number, after: number, deferred: Promise<QueryBuilder<Model>>): (builder: QueryBuilder<Model>) => void;
  export function relayModel<T extends ModelClass<Model>>(ModelClass: T): T;
}