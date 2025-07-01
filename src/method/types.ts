import type { StandardSchemaV1 } from '@standard-schema/spec';

// Any types for use in generic parameters
export type AnyClientMethodDef = ClientMethodDef<any, any>;
export type AnyServerMethodDef = ServerMethodDef<any, any>;
export type AnyServerMethodHandler = ServerMethodHandler<any, any>;

/** A type-safe client-side method definition. */
export interface ClientMethodDef<
  TParams extends MethodParams,
  TResult extends StandardSchemaV1
> {
  /** The schema of the method parameters */
  paramsSchema: TParams;
  /** The schema of the method result */
  resultSchema: TResult;
  /** Takes a server method handler and returns an implemented ServerMethodDef */
  implement: (handler: ServerMethodHandler<TParams, TResult>) => ServerMethodDef<TParams, TResult>;
};

/** A type-safe server-side method definition. */
export interface ServerMethodDef<
  TParams extends MethodParams,
  TResult extends StandardSchemaV1
> extends Omit<ClientMethodDef<TParams, TResult>, 'implement'> {
  /** The handler of the method */
  handler: ServerMethodHandler<TParams, TResult>;
};

/** A type-safe server-side method handler. */
export type ServerMethodHandler<
  TParams extends MethodParams,
  TResult extends StandardSchemaV1
> = (params: StandardSchemaV1.InferInput<TParams>) => MaybePromise<StandardSchemaV1.InferOutput<TResult>>;

/** Valid params types for methods */
export type MethodParams<T extends
  | Record<string, unknown>
  | unknown[]
  | void = any> = StandardSchemaV1<T, T>;

// –
// Utility types
// –

/** Converts a ServerMethodDef to a ClientMethodDef by extracting schemas */
export type ServerMethodDefToClientMethodDef<T extends AnyServerMethodDef> = 
  T extends ServerMethodDef<infer TParams, infer TResult>
    ? ClientMethodDef<TParams, TResult>
    : never;

/** Converts a ServerDef to a ClientDef */
export type ServerDefToClientDef<T extends Record<string, AnyServerMethodDef>> = {
  [K in keyof T]: ServerMethodDefToClientMethodDef<T[K]>;
};

/** A helper for a synchronous or asynchronous function's return type. */
export type MaybePromise<T> = T | Promise<T>;