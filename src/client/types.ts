import type { z } from 'zod';
import type { RequestObject, ResponseObject } from '../jsonrpc';
import type { ClientMethodDef } from '../method';
import type { ClientBatch } from './batch';

export type Client<TDef extends ClientDef> = ClientMethods<TDef> & {
  /** Sends a batch request to the server, validating the responses against the expected types, and returning a typed result. */
  batch: ClientBatch<TDef>;
};

/**
 * A record of a server's method definitions by their names.
 */
export type ClientDef = Record<string, ClientMethodDef>;

/**
 * A JSON-RPC 2.0 server.
 */
export type ClientMethods<TDef extends ClientDef> = {
  [K in keyof TDef]: TDef[K] extends ClientMethodDef<infer TParams, infer TResult>
    ? (params: z.infer<TParams>) => Promise<z.infer<TResult>>
    : never;
};

/**
 * A function that sends a request object to a JSON-RPC 2.0 server and asynchronously returns a response object, or null if the request is a single notification.
 */
export type SendRequestFn = (requests: RequestObject) => Promise<ResponseObject | null>;
