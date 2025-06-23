import { z } from 'zod/v4';
import type { ClientMethodDef, MethodParams, ServerMethodDef, ServerMethodHandler } from './types';

/** Creates a type-safe client method definition. */
export function method<
  TParams extends MethodParams,
  TResult extends z.ZodType,
>(definition: { paramsSchema: TParams; resultSchema: TResult }): ClientMethodDef<TParams, TResult>;

/** Creates a type-safe server method definition. */
export function method<
  TParams extends MethodParams,
  TResult extends z.ZodType,
>(definition: { paramsSchema: TParams; resultSchema: TResult }, handler: ServerMethodHandler<TParams, TResult>): ServerMethodDef<TParams, TResult>;

export function method<
  TParams extends MethodParams,
  TResult extends z.ZodType,
>({ paramsSchema, resultSchema }: { paramsSchema: TParams; resultSchema: TResult; }, handler?: ServerMethodHandler<TParams, TResult>): ClientMethodDef<TParams, TResult> | ServerMethodDef<TParams, TResult> {
  // Validate the params schema type
  const paramsSchemaValid =
    paramsSchema instanceof z.ZodVoid ||
    paramsSchema instanceof z.ZodTuple ||
    paramsSchema instanceof z.ZodArray ||
    paramsSchema instanceof z.ZodObject ||
    paramsSchema instanceof z.ZodDiscriminatedUnion;
  if (!paramsSchemaValid) throw new Error('Invalid params schema');

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
