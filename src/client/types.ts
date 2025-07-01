import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { RequestObject } from '../jsonrpc/index.js';
import type { AnyClientMethodDef, ClientMethodDef } from '../method/index.js';
import type { ClientBatch } from './batch.js';

export type Client<TDef extends ClientDef> = ClientMethods<TDef> & {
  /** Sends a batch request to the server, validating the responses against the expected types, and returning a typed result. */
  batch: ClientBatch<TDef>;

  // –
  // Raw Variants
  // –
  /** Returns a client that does not validate the params, for scenarios where you trust the server to validate the params. */
  rawParams: () => Client<TDef>;
  /** Returns a client that does not validate the results, for scenarios where you trust the server to always return valid results. */
  rawResults: () => Client<TDef>;
  /** Returns a client that does not validate the params or results, for scenarios where you control both the server and client and can guarantee the params and results are always valid. */
  raw: () => Client<TDef>;
  /** Returns a client that validates the params and results, for scenarios where you want to re-enable validation after using a raw client variant. */
  validating: () => Client<TDef>;
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

/**
 * Options for calling a client method.
 */
export type CallMethodOptions = {
  /** Whether to validate the params. */
  validateParams?: boolean;
  /** Whether to validate the results. */
  validateResults?: boolean;
};