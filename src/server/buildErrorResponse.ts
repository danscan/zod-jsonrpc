import { JSONRPCError, type JSONRPCRequest, JSONRPCResponseSchema } from "../jsonrpc/index.js";
import { parse } from "../validator/index.js";

/**
* Builds a JSON-RPC 2.0 error response for a given error and request ID.
*/
export function buildErrorResponse(error: unknown, id?: JSONRPCRequest['id']) {
 return parse(JSONRPCResponseSchema, {
   error: error instanceof JSONRPCError
     ? error
     : JSONRPCError.InternalError({ data: error }),
   id: id ?? null,
 });
}