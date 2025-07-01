import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { ClientMethodDef, MethodParamsSchema, ServerMethodDef, ServerMethodHandler } from './types.js';

/** Creates a type-safe client method definition. */
export function method<
  TParams extends MethodParamsSchema,
  TResult extends StandardSchemaV1,
>(definition: { paramsSchema: TParams; resultSchema: TResult }): ClientMethodDef<TParams, TResult>;

/** Creates a type-safe server method definition. */
export function method<
  TParams extends MethodParamsSchema,
  TResult extends StandardSchemaV1,
>(definition: { paramsSchema: TParams; resultSchema: TResult }, handler: ServerMethodHandler<TParams, TResult>): ServerMethodDef<TParams, TResult>;

export function method<
  TParams extends MethodParamsSchema,
  TResult extends StandardSchemaV1,
>({ paramsSchema, resultSchema }: { paramsSchema: TParams; resultSchema: TResult; }, handler?: ServerMethodHandler<TParams, TResult>): ClientMethodDef<TParams, TResult> | ServerMethodDef<TParams, TResult> {
  if (handler) {
    // Return ServerMethodDef (no implement method)
    return {
      paramsSchema,
      resultSchema,
      handler,
    };
  } else {
    // Return ClientMethodDef (with implement method)
    return {
      paramsSchema,
      resultSchema,
      implement: (handler) => method({ paramsSchema, resultSchema }, handler),
    };
  }
}
