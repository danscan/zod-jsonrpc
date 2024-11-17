import { z } from 'zod';
import { createClient } from '../client';
import { ClientDef, SendRequestFn } from '../client/types';
import {
  type BatchRequestObject,
  JSONRPCError,
  type JSONRPCRequest,
  JSONRPCRequestBatchSchema,
  JSONRPCRequestSchema,
  JSONRPCResponseBatchSchema,
  JSONRPCResponseSchema,
  type RequestObject,
  type ResponseObject,
} from '../jsonrpc';
import type { ServerMethodDef } from '../method';
import { buildErrorResponse } from './buildErrorResponse';
import type { Server, ServerDef } from './types';

/**
 * Creates a JSON-RPC 2.0 server.
 */
export function createServer<TDefs extends ServerDef>(methods: TDefs): Server<TDefs> {
  return {
    /**
     * Handles a JSON-RPC request.
     *
     * Returns a ResponseObject, or null if the request is a single notification.
     */
    request: async (request: RequestObject): Promise<ResponseObject | null> => {
      // If the request is an array, attempt to handle it as a batch request
      if (Array.isArray(request)) return handleArrayRequest(methods, request);

      // Otherwise, attempt to handle it as a single request
      const { data: singleRequest, error: invalidRequestError } = JSONRPCRequestSchema.safeParse(request);

      // Return an error response if the single request is invalid
      if (invalidRequestError) return buildErrorResponse(
        JSONRPCError.InvalidRequest({ data: invalidRequestError }),
        null
      );

      // Handle the single request
      const result = await parseRequestAndCallMethod(methods, singleRequest);
      // Return the result unless the request is a notification
      return result ?? null;
    },

    /**
     * Extends the server with additional methods.
     */
    extend: <TNewDefs extends ServerDef>(defs: TNewDefs) =>
      createServer<TNewDefs & TDefs>({ ...methods, ...defs }),

    /**
     * Creates a typed client for the server.
     */
    createClient: (
      /** The function used to send requests to the server. */
      sendRequest: SendRequestFn,
    ) => {
      const clientMethods: ClientDef = {};

      for (const methodName of Object.keys(methods)) {
        clientMethods[methodName] = {
          paramsSchema: methods[methodName].paramsSchema,
          resultSchema: methods[methodName].resultSchema,
        };
      }

      return createClient(clientMethods as TDefs, sendRequest);
    },
  };
}

// ----------------------------------------------
// Private Helpers
// ----------------------------------------------

/**
 * Handles an array request body, which is likely a batch request.
 * Validates the batch request, and calls `parseRequestAndCallMethod` for each request in the batch.
 * Returns a JSON-RPC 2.0 batch response, unless the request is invalid, in which case it returns an error response.
 */
async function handleArrayRequest<TDefs extends ServerDef>(methods: TDefs, request: BatchRequestObject): Promise<ResponseObject> {
  // Parse the batch request
  const { data: batchRequest, error: invalidRequestError } = JSONRPCRequestBatchSchema.safeParse(request);

  // Return an error response if the batch request is invalid
  if (invalidRequestError) return buildErrorResponse(
    JSONRPCError.InvalidRequest({ message: 'Invalid batch request', data: invalidRequestError }),
    null
  );

  // Handle each request in the batch
  const responses = await Promise.all(
    batchRequest.map(req => parseRequestAndCallMethod(methods, req))
  );

  // Filter out any undefined responses (to notifications), and return the validated batch response
  return JSONRPCResponseBatchSchema.parse(
    responses.filter((r) => r !== undefined)
  );
}

/**
 * Parses a JSON-RPC request and calls the appropriate method handler, handling any request errors,
 * and returning a response unless the request is a notification.
 */
async function parseRequestAndCallMethod<TDefs extends ServerDef>(
  methods: TDefs,
  request: JSONRPCRequest
) {
  // Specification: A Notification is a Request object without an 'id' member.
  const isNotificationRequest = request.id === undefined;

  // Specification: A Request object that is a Notification signifies the Client's lack of interest in
  // the corresponding Response object, and as such no Response object needs to be returned to the client.
  // The Server MUST NOT reply to a Notification, including those that are within a batch request.
  const shouldReturnResponse = !isNotificationRequest;

  // Get the method definition for the request method
  const method = methods[request.method];
  // Handle method not found errors
  if (!method) {
    return shouldReturnResponse
      ? buildErrorResponse(JSONRPCError.MethodNotFound(), request.id)
      : undefined;
  }

  // Parse the request params
  const { data: params, error: paramsError } = method.paramsSchema.safeParse(request.params);
  // Handle invalid params errors
  if (paramsError) {
    return shouldReturnResponse
      ? buildErrorResponse(
          JSONRPCError.InvalidParams({
            message: `Invalid params for method ${request.method}`,
            data: paramsError,
          }),
          request.id
        )
      : undefined;
  }

  // Call the method
  const response = await callMethod(method, params, request.id);
  // Return the result unless the request is a notification
  return shouldReturnResponse
    ? response
    : undefined;
}

/**
 * Calls a method handler with pre-parsed parameters and request ID.
 * Handles internal errors and returns a response.
 */
async function callMethod<TDef extends ServerMethodDef>(
  method: TDef,
  params: z.infer<TDef['paramsSchema']>,
  id?: JSONRPCRequest['id']
) {
  try {
    const result = await method.handler(params);
    return JSONRPCResponseSchema.parse({ result: method.resultSchema.parse(result), id });
  } catch (error) {
    return buildErrorResponse(error, id);
  }
}
