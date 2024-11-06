import type { z } from 'zod';
import { JSONRPC2Error } from './JSONRPC2Error';
import {
  JSONRPCRequestBatchSchema,
  JSONRPCRequestSchema,
  JSONRPCResponseBatchSchema,
  JSONRPCResponseSchema,
  type JSONRPCRequest,
  type JSONRPCResponse,
  type JSONRPCResponseBatch
} from './JSONRPC2Schemas';
import { ServerMethod, ServerMethodSpec, ServerNotification } from './Methods';

export class Server<TMethods extends Record<string, ServerMethodSpec>> {
  constructor(private readonly methods: TMethods) {}

  /** Extends the server with additional methods */
  extend<TExtendedMethods extends Record<string, ServerMethodSpec>>(methods: TExtendedMethods) {
    return new Server<TMethods & TExtendedMethods>({ ...this.methods, ...methods });
  }

  /** Returns whether this server supports the given method. */
  supportsMethod(method: string) {
    return method in this.methods;
  }

  /** Handles a JSON-RPC 2.0 request. */
  async request(
    /** The JSON-RPC 2.0 request as a record or array of records (e.g. parsed JSON object or array of objects) */
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
  private async callMethod<TMethod extends ServerMethodSpec>(
    method: TMethod,
    id: JSONRPCRequest['id'],
    params: z.infer<TMethod['paramsSchema']>
  ): Promise<JSONRPCResponse | void> {
    // Check if the method is a notification
    const isNotification = method.type === 'notification';

    try {
      // Call the method handler
      const result = await method.handler(params);
      // Do not return a response if it's a notification
      if (isNotification) return;

      // The request is not a notification, return the result
      return JSONRPCResponseSchema.parse({
        jsonrpc: '2.0',
        result: method.resultSchema.parse(result),
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

  /** Defines a type-safe server method. */
  static method<
    TParams extends z.ZodTypeAny,
    TResult extends z.ZodTypeAny,
    THandler extends (input: z.infer<TParams>) => Promise<z.infer<TResult>>
  >({
    paramsSchema,
    resultSchema,
    handler,
  }: {
    paramsSchema: TParams;
    resultSchema: TResult;
    handler: THandler;
  }): ServerMethod<TParams, TResult> {
    return {
      type: 'method',
      paramsSchema,
      resultSchema,
      handler,
    };
  }

  /** Defines a type-safe server notification. */
  static notification<
    TParams extends z.ZodTypeAny,
    THandler extends (input: z.infer<TParams>) => Promise<void>
  >({
    paramsSchema,
    handler,
  }: {
    paramsSchema: TParams;
    handler: THandler;
  }): ServerNotification<TParams> {
    return {
      type: 'notification',
      paramsSchema,
      handler,
    };
  }
}

