import { Client, SendRequestFn } from '../client/types.js';
import type { RequestObject, ResponseObject } from '../jsonrpc/index.js';
import type { AnyServerMethodDef, ServerDefToClientDef } from '../method/index.js';

/**
 * A record of a server's method definitions by their names.
 */
export type ServerDef = Record<string, AnyServerMethodDef>;

/**
 * A JSON-RPC 2.0 server.
 */
export type Server<TDef extends ServerDef> = {
  /** Handles a JSON-RPC 2.0 request. */
  request: (request: RequestObject) => Promise<ResponseObject | null>;
  /** Extends the server with additional methods. */
  extend: <TNewDefs extends ServerDef>(defs: TNewDefs) => Server<TDef & TNewDefs>;
  /** Creates a client for the server. */
  createClient: (sendRequest: SendRequestFn) => Client<ServerDefToClientDef<TDef>>;
};
