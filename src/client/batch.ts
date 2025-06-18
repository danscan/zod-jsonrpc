import { z } from 'zod/v4';
import { JSONRPCError, JSONRPCRequestSchema, JSONRPCResponseBatchSchema, type JSONRPCRequest } from '../jsonrpc';
import type { AnyClientMethodDef, ClientMethodDef } from '../method';
import type { ClientDef, SendRequestFn } from './types';

/** The batch method of a client. */
export type ClientBatch<TDef extends ClientDef> = <TConfig extends BatchRequestConfig>(
  getBatchRequestConfig: (ctx: BatchContext<TDef>) => TConfig
) => Promise<BatchResult<TConfig>>;

/** A record of request builders by method names. */
export type BatchContext<TDef extends ClientDef> = {
  [K in keyof TDef]: TDef[K] extends ClientMethodDef<infer TParams, infer TResult>
    ? (params: z.infer<TParams>) => BatchRequestConfigEntry<TDef[K]>
    : never;
};

/** A record from a local request ID to a request to be sent in a batch. */
export type BatchRequestConfig = Record<string, BatchRequestConfigEntry<AnyClientMethodDef>>;
export type BatchRequestConfigEntry<TMethodDef extends AnyClientMethodDef> = [TMethodDef, JSONRPCRequest];

/** A record from a local request ID to a response from a batch. */
export type BatchResult<TBatchConfig extends BatchRequestConfig> = {
  [K in keyof TBatchConfig]: TBatchConfig[K] extends BatchRequestConfigEntry<infer TMethodDef>
    ? BatchResultEntry<TMethodDef>
    : never;
};

/** A result from a batch request. */
export type BatchResultEntry<TMethodDef extends AnyClientMethodDef> =
  | { ok: true; value: z.infer<TMethodDef['resultSchema']> }
  | { ok: false; error: JSONRPCError };

/** Builds a batch context from a client definition. */
function buildBatchContext<TDef extends ClientDef>(defs: TDef): BatchContext<TDef> {
  const ctx: Record<string, (p: any) => BatchRequestConfigEntry<TDef[keyof TDef]>> = {};

  for (const [methodName, methodDef] of Object.entries(defs)) {
    try {
      ctx[methodName] = (params: any) => [methodDef, JSONRPCRequestSchema.parse({
        jsonrpc: '2.0',
        method: methodName,
        params: z.parse(methodDef.paramsSchema, params),
        id: crypto.randomUUID(),
      })] as BatchRequestConfigEntry<TDef[keyof TDef]>;
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
  const results: Record<string, BatchResultEntry<TBatchConfig[keyof TBatchConfig][0]>> = {};
  for (const { id, result, error } of batchResponse) {
    const localRequestId = localRequestIdsByGeneratedId.get(id as string);
    if (!localRequestId) throw JSONRPCError.InvalidRequest({ message: `No local request ID found for generated ID ${id}` });
    const methodDef = batchConfig[localRequestId as keyof TBatchConfig][0];
    try {
      results[localRequestId] = error
        ? { ok: false, error: new JSONRPCError(error.code, error.message, error.data) }
        : { ok: true, value: methodDef.resultSchema.parse(result) };
    } catch (error) {
      results[localRequestId] = { ok: false, error: JSONRPCError.InternalError({ message: `Invalid result in batch result for entry ${localRequestId}`, data: { error, result} }) };
    }
  }
  // Map the responses to the expected types
  return results as BatchResult<TBatchConfig>;
}
