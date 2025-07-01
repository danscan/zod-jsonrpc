import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { RequestObject } from '../jsonrpc/index.js';
import type { AnyClientMethodDef, ClientMethodDef } from '../method/index.js';
import type { ClientBatch } from './batch.js';

export type Client<TDef extends ClientDef> = ClientMethods<TDef> & {
  /** Sends a batch request to the server, validating the responses against the expected types, and returning a typed result. */
  batch: ClientBatch<TDef>;
};

/**
 * A record of a server's method definitions by their names.
 */
export type ClientDef = Record<string, AnyClientMethodDef>;

/**
 * A JSON-RPC 2.0 server.
 */
export type ClientMethods<TDef extends ClientDef> = {
  [K in keyof TDef]: TDef[K] extends ClientMethodDef<infer TParams, infer TResult>
    ? (params: StandardSchemaV1.InferInput<TParams>) => Promise<StandardSchemaV1.InferOutput<TResult>>
    : never;
};

/**
 * A function that sends a request object to a JSON-RPC 2.0 server and asynchronously returns a response object, or null if the request is a single notification.
 * 
 * The return type is a promise for unknown. The response object will be validated internally.
 */
export type SendRequestFn = (requests: RequestObject) => Promise<unknown>;
