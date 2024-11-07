import { RequestObject, ResponseObject } from '../jsonrpc';
import { ServerMethodDef } from '../method';

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
  extend: (defs: ServerDef) => Server<TDef & ServerDef>;
};
