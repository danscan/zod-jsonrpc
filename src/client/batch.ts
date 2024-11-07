import type { z } from 'zod';
import { JSONRPCError, JSONRPCRequestSchema, JSONRPCResponseBatchSchema, type JSONRPCRequest } from '../jsonrpc';
import type { ClientMethodDef } from '../method';
import type { ClientDef, SendRequestFn } from './types';

/** A record of request builders by method names. */
export type BatchContext<TDef extends ClientDef> = {
  [K in keyof TDef]: TDef[K] extends ClientMethodDef<infer TParams>
    ? (params: z.infer<TParams>) => BatchRequestConfigEntry
    : never;
};

/** A record from a local request ID to a request to be sent in a batch. */
export type BatchRequestConfig = Record<string, BatchRequestConfigEntry>;
export type BatchRequestConfigEntry = [ClientMethodDef, JSONRPCRequest];

/** A record from a local request ID to a response from a batch. */
export type BatchResult<TBatchConfig extends BatchRequestConfig> = {
  [K in keyof TBatchConfig]: TBatchConfig[K] extends BatchRequestConfigEntry
    ? BatchResultEntry<TBatchConfig[K]>
    : never;
};

/** A result from a batch request. */
export type BatchResultEntry<TBatchRequestConfigEntry extends BatchRequestConfigEntry> =
  | { status: 'success', result: z.infer<TBatchRequestConfigEntry[0]['resultSchema']> }
  | { status: 'error', error: JSONRPCError };

/** Builds a batch context from a client definition. */
function buildBatchContext<TDef extends ClientDef>(defs: TDef): BatchContext<TDef> {
  const ctx: Record<string, (p: any) => BatchRequestConfigEntry> = {};

  for (const [methodName, methodDef] of Object.entries(defs)) {
    try {
      ctx[methodName] = (params: any) => [methodDef, JSONRPCRequestSchema.parse({
        jsonrpc: '2.0',
        method: methodName,
        params: methodDef.paramsSchema.parse(params),
        id: crypto.randomUUID(),
      })];
    } catch (error) {
      throw JSONRPCError.InvalidParams({ message: `Invalid params for batch method ${methodName}: ${error}` });
    }
  }

  return ctx as unknown as BatchContext<TDef>;
}

/** Sends a batch request to the server, validating the responses against the expected types, and returning a typed result. */
export async function batch<
  TDef extends ClientDef,
  TBatchConfig extends BatchRequestConfig
>(
  defs: TDef,
  getBatchRequestConfig: (ctx: BatchContext<TDef>) => TBatchConfig,
  sendRequest: SendRequestFn,
): Promise<BatchResult<TBatchConfig>> {
  const ctx = buildBatchContext(defs);
  const batchConfig = getBatchRequestConfig(ctx);

  // Send the requests
  const requests = Object.values(batchConfig).map(([_, request]) => request);
  const batchResponseObject = await sendRequest(requests);

  // Parse the responses
  const { data: batchResponse, error: batchError } = JSONRPCResponseBatchSchema.safeParse(batchResponseObject);
  if (batchError) throw JSONRPCError.ParseError({ message: `Error in batch response: ${batchError}` });

  // Map the results to the local request IDs
  const localRequestIdsByGeneratedId = new Map<string, string>();
  // Iterate over batch config entries
  for (const [localRequestId, [_, request]] of Object.entries(batchConfig)) {
    const generatedId = request.id;
    // generatedId is a UUID string
    localRequestIdsByGeneratedId.set(generatedId as string, localRequestId);
  }

  // Parse the results and map them to the local request IDs
  const results: Record<string, BatchResultEntry<TBatchConfig[keyof TBatchConfig]>> = {};
  for (const { id, result, error } of batchResponse) {
    const localRequestId = localRequestIdsByGeneratedId.get(id as string);
    if (!localRequestId) throw JSONRPCError.InvalidRequest({ message: `No local request ID found for generated ID ${id}` });
    const methodDef = batchConfig[localRequestId as keyof TBatchConfig][0];
    try {
      results[localRequestId] = error
        ? { status: 'error', error: new JSONRPCError(error.code, error.message, error.data) }
        : { status: 'success', result: methodDef.resultSchema.parse(result) };
    } catch (error) {
      results[localRequestId] = { status: 'error', error: JSONRPCError.InternalError({ message: `Invalid result in batch result for entry ${localRequestId}`, data: { error, result} }) };
    }
  }
  // Map the responses to the expected types
  return results as BatchResult<TBatchConfig>;
}
