import { JSONRPCResponse, JSONRPCResponseBatch } from "./JSONRPCSchemas";

/**
 * An union: object or array of objects representing a JSON-RPC 2.0 request.
 */
export type RequestObject = SingleRequestObject | BatchRequestObject;

/**
 * A record representing a single JSON-RPC 2.0 request.
 */
export type SingleRequestObject = Record<string, unknown>;

/**
 * A record representing a batch JSON-RPC 2.0 request.
 */
export type BatchRequestObject = SingleRequestObject[];

/**
 * A union representing a JSON-RPC 2.0 response.
 */
export type ResponseObject = JSONRPCResponse | JSONRPCResponseBatch;
