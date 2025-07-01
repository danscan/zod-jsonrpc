import type { StandardSchemaV1 } from '@standard-schema/spec';
import { JSONRPCError } from '../jsonrpc/JSONRPCError.js';
import { JSONRPCRequestSchema, JSONRPCResponseSchema } from '../jsonrpc/JSONRPCSchemas.js';
import { parse, safeParse } from '../validator/index.js';
import { batch, type BatchContext, type BatchRequestConfig } from './batch.js';
import type { CallMethodOptions, Client, ClientDef, SendRequestFn } from './types.js';

export function createClient<TDef extends ClientDef>(defs: TDef, sendRequest: SendRequestFn, options: CallMethodOptions = {}): Client<TDef> {
  const baseClient = {
    /** Sends a batch request to the server, validating the responses against the expected types, and returning a typed result. */
    batch: (getBatchRequestConfig: (ctx: BatchContext<TDef>) => BatchRequestConfig) => 
      batch(defs, getBatchRequestConfig, sendRequest, options),

    // –
    // Raw Variants
    // –
    rawParams: () => createClient(defs, sendRequest, { ...options, validateParams: false }),
    rawResults: () => createClient(defs, sendRequest, { ...options, validateResults: false }),
    raw: () => createClient(defs, sendRequest, { ...options, validateParams: false, validateResults: false }),
    validating: () => createClient(defs, sendRequest, { ...options, validateParams: true, validateResults: true }),
  };

  // Set methods on the base client
  const methods: Record<string, (params: any) => Promise<any>> = {};
  for (const methodName of Object.keys(defs)) {
    methods[methodName] = (params: any) => callMethod(defs, methodName, params, sendRequest, options);
  }

  // Return the client with methods
  return { ...baseClient, ...methods } as Client<TDef>;
}

async function callMethod<TDef extends ClientDef, TMethodName extends keyof TDef>(
  defs: TDef,
  methodName: TMethodName,
  params: StandardSchemaV1.InferInput<TDef[TMethodName]['paramsSchema']>,
  sendRequest: SendRequestFn,
  { validateParams = true, validateResults = true }: CallMethodOptions = {},
): Promise<StandardSchemaV1.InferOutput<TDef[TMethodName]['resultSchema']>> {
  // Build the request
  const request = parse(JSONRPCRequestSchema, {
    jsonrpc: '2.0',
    method: methodName,
    params: validateParams
      ? parse(defs[methodName].paramsSchema, params)
      : params,
    id: crypto.randomUUID(),
  });

  // Send the request to the server
  const responseObject = await sendRequest(request);

  // Parse the response
  const { data: response, issues: responseIssues } = safeParse(JSONRPCResponseSchema, responseObject);
  if (responseIssues) throw JSONRPCError.ParseError({ message: `Error parsing response`, data: { issues: responseIssues, value: responseObject } });

  // If the response is an error, throw it
  if (response.error) throw new JSONRPCError(response.error.code, response.error.message, response.error.data);

  // Return the result, validating if enabled
  try {
    return validateResults
      ? parse(defs[methodName].resultSchema, response.result)
      : response.result;
  } catch (error) {
    throw JSONRPCError.InternalError({ message: `Invalid result for method ${String(methodName)}`, data: error });
  }
}
