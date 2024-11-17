import { Client, SendRequestFn } from '../client/types';
import type { RequestObject, ResponseObject } from '../jsonrpc';
import type { ServerMethodDef } from '../method';

/**
 * A record of a server's method definitions by their names.
 */
export type ServerDef = Record<string, ServerMethodDef>;

/**
 * A JSON-RPC 2.0 server.
 */
export type Server<TDef extends ServerDef> = {
  /** Handles a JSON-RPC 2.0 request. */
  request: (request: RequestObject) => Promise<ResponseObject>;
  /** Extends the server with additional methods. */
  extend: <TNewDefs extends ServerDef>(defs: TNewDefs) => Server<TDef & TNewDefs>;
  /** Creates a client for the server. */
  createClient: (sendRequest: SendRequestFn) => Client<TDef>;
};
