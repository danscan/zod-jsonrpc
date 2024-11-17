import type { z } from 'zod';
import { JSONRPCError, JSONRPCRequestSchema, JSONRPCResponseSchema } from '../jsonrpc';
import { batch, type BatchContext, type BatchRequestConfig } from './batch';
import type { Client, ClientDef, SendRequestFn } from './types';

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
  params: z.infer<TDef[TMethodName]['paramsSchema']>,
  sendRequest: SendRequestFn,
): Promise<z.infer<TDef[TMethodName]['resultSchema']>> {
  const request = JSONRPCRequestSchema.parse({
    jsonrpc: '2.0',
    method: methodName,
    params: defs[methodName].paramsSchema.parse(params),
    id: crypto.randomUUID(),
  });

  const responseObject = await sendRequest(request);

  const { data: response, error: responseError } = JSONRPCResponseSchema.safeParse(responseObject);
  if (responseError) throw JSONRPCError.ParseError({ message: `Error parsing response`, data: responseError });

  try {
    return defs[methodName].resultSchema.parse(response.result);
  } catch (error) {
    throw JSONRPCError.InternalError({ message: `Invalid result for method ${String(methodName)}`, data: error });
  }
}
