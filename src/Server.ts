import type { z } from 'zod';
import { JSONRPC2Error } from './JSONRPC2Error';
import {
  type JSONRPCRequest,
  type JSONRPCResponse,
  type JSONRPCResponseBatch,
  JSONRPCRequestBatchSchema,
  JSONRPCRequestSchema,
  JSONRPCResponseBatchSchema,
  JSONRPCResponseSchema
} from './JSONRPC2Schemas';

type BaseMethodHandler<TParams, TResult> = {
  paramsSchema: z.ZodType<TParams>;
  handler: (params: TParams) => Promise<TResult>;
};

type RPCMethodHandler<TParams, TResult> = BaseMethodHandler<TParams, TResult> & {
  resultSchema: z.ZodType<TResult>;
};

type NotificationMethodHandler<TParams> = BaseMethodHandler<TParams, void> & {
  type: 'notification';
};

// Simplified MethodHandler type with better constraints
export type MethodHandler<
  TParams extends z.ZodTypeAny,
  TResult extends z.ZodTypeAny
> = RPCMethodHandler<z.infer<TParams>, z.infer<TResult>> | NotificationMethodHandler<z.infer<TParams>>;

export type Methods = Record<string, MethodHandler<any, any>>;

export class Server<TMethods extends Methods> {
  constructor(private readonly methods: TMethods) {}

  extend<TExtendedMethods extends Methods>(methods: TExtendedMethods) {
    return new Server<TMethods & TExtendedMethods>({ ...this.methods, ...methods });
  }

  /**
   * Handles a JSON-RPC 2.0 request.
   * @param request - The JSON-RPC 2.0 request.
   * @returns The JSON-RPC 2.0 response.
   */
  async request(
    /** The JSON-RPC 2.0 request. */
    request: Record<string, unknown> | Record<string, unknown>[]
  ): Promise<JSONRPCResponse | JSONRPCResponseBatch | void> {
    // If the request is an array, it's a batch request
    if (Array.isArray(request)) {
      // Parse the batch request
      const { data: batchRequest, error } = JSONRPCRequestBatchSchema.safeParse(request);
      // Return an error response if the batch request is invalid
      if (error) return this.buildErrorResponse(
        JSONRPC2Error.InvalidRequestWithData({ message: 'Invalid batch request' }),
        null
      );

      // Handle each request in the batch
      const responses = await Promise.all(
        batchRequest.map(req => this.handleMethodRequest(req))
      );
      // Return the batch response
      return JSONRPCResponseBatchSchema.parse(
        responses.filter((r): r is JSONRPCResponse => r !== undefined)
      );
    }

    // Handle single request
    const { data: singleRequest, error } = JSONRPCRequestSchema.safeParse(request);
    // Return an error response if the single request is invalid
    if (error) return this.buildErrorResponse(JSONRPC2Error.InvalidRequest, null);
    // Handle the single request
    return this.handleMethodRequest(singleRequest);
  }

  /** Private method that handles a single JSON-RPC 2.0 request, used by `request`. */
  private async handleMethodRequest(request: JSONRPCRequest): Promise<JSONRPCResponse | void> {
    // Get the handler for the requested method
    const method = this.methods[request.method];
    // Return a method not found error if the method doesn't exist
    if (!method) return this.buildErrorResponse(
      JSONRPC2Error.MethodNotFoundWithData({ method: request.method }),
      request.id
    );

    // Parse the request params
    const { data: params, error } = method.paramsSchema.safeParse(request.params);
    // Return an invalid params error if the params are invalid
    if (error) return this.buildErrorResponse(JSONRPC2Error.InvalidParams, request.id);

    // Call the method
    return this.callMethod(method, request.id, params);
  }

  /** Private method that calls a method handler, used by `handleMethodRequest`. */
  private async callMethod<TMethod extends MethodHandler<any, any>>(
    method: TMethod,
    id: JSONRPCRequest['id'],
    params: z.infer<TMethod['paramsSchema']>
  ): Promise<JSONRPCResponse | void> {
    // Check if the method is a notification
    const isNotification = 'type' in method && method.type === 'notification';

    try {
      // Call the method handler
      const result = await method.handler(params);
      // Do not return a response if it's a notification
      if (isNotification) return;

      // The request is not a notification, return the result
      return JSONRPCResponseSchema.parse({
        jsonrpc: '2.0',
        result,
        id,
      });
    } catch (error) {
      // An error occurred, return an error response if it's not a notification
      if (!isNotification) return this.buildErrorResponse(error, id);
    }
  }

  /** Private method that builds an error response. */
  private buildErrorResponse(error: unknown, id: JSONRPCRequest['id']) {
    return JSONRPCResponseSchema.parse({
      jsonrpc: '2.0',
      error: error instanceof JSONRPC2Error
        ? error
        : JSONRPC2Error.InternalErrorWithData(error),
      id,
    });
  }
}

