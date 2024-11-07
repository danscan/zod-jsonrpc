import { JSONRPCError, JSONRPCRequest, JSONRPCResponseSchema } from "../jsonrpc";

/**
* Builds a JSON-RPC 2.0 error response for a given error and request ID.
*/
export function buildErrorResponse(error: unknown, id?: JSONRPCRequest['id']) {
 return JSONRPCResponseSchema.parse({
   error: error instanceof JSONRPCError
     ? error
     : JSONRPCError.InternalError({ data: error }),
   id: id ?? null,
 });
}