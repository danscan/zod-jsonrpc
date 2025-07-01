import type { StandardSchemaV1 } from '@standard-schema/spec';
import { JSONRPCError } from '../jsonrpc/JSONRPCError.js';
import { JSONRPCRequestSchema, JSONRPCResponseSchema } from '../jsonrpc/JSONRPCSchemas.js';
import { parse, safeParse } from '../validator/index.js';
import { batch, type BatchContext, type BatchRequestConfig } from './batch.js';
import type { Client, ClientDef, SendRequestFn } from './types.js';

export function createClient<TDef extends ClientDef>(defs: TDef, sendRequest: SendRequestFn): Client<TDef> {
  const baseClient = {
    /** Sends a batch request to the server, validating the responses against the expected types, and returning a typed result. */
    batch: (getBatchRequestConfig: (ctx: BatchContext<TDef>) => BatchRequestConfig) => batch(defs, getBatchRequestConfig, sendRequest),
  };

  // Set methods on the base client
  const methods: Record<string, (params: any) => Promise<any>> = {};
  for (const methodName of Object.keys(defs)) {
    methods[methodName] = (params: any) => callMethod(defs, methodName, params, sendRequest);
  }

  // Return the client with methods
  return { ...baseClient, ...methods } as Client<TDef>;
}

async function callMethod<TDef extends ClientDef, TMethodName extends keyof TDef>(
  defs: TDef,
  methodName: TMethodName,
  params: StandardSchemaV1.InferInput<TDef[TMethodName]['paramsSchema']>,
  sendRequest: SendRequestFn,
): Promise<StandardSchemaV1.InferOutput<TDef[TMethodName]['resultSchema']>> {
  const request = parse(JSONRPCRequestSchema, {
    jsonrpc: '2.0',
    method: methodName,
    params: parse(defs[methodName].paramsSchema, params),
    id: crypto.randomUUID(),
  });

  const responseObject = await sendRequest(request);

  const { data: response, issues: responseIssues } = safeParse(JSONRPCResponseSchema, responseObject);
  if (responseIssues) throw JSONRPCError.ParseError({ message: `Error parsing response`, data: { issues: responseIssues, value: responseObject } });

  try {
    return parse(defs[methodName].resultSchema, response.result);
  } catch (error) {
    throw JSONRPCError.InternalError({ message: `Invalid result for method ${String(methodName)}`, data: error });
  }
}
