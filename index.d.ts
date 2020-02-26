import { Model, ModelClass } from 'objection';

declare module 'objection-graphql-relay' {
  export function idWrapper(modelName?: string): (parent: Model) => Promise<string>;
  export function fromGlobalId(modelName?: string, globalId?: string): string;
  export function singleRelationshipWrapper(relationshipName: string): Promise<string>;
  export function connectionWrapper(field: string | object): Promise<object>;
  export function pagedRelationQuery(instance: ModelClass<Model>, field: string | object, first: number, after: number, extraFilter?: (builder: any) => object, orderBy?: (builder: any) => object): Promise<object>;
  export function range(first?: number, after?: number, deferred?: object): Promise<any>;
  export function relayModel(ModelClass: ModelClass<Model>): ModelClass<Model>;
}