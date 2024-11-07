import { z } from 'zod';
import { ClientMethodDef, MaybePromise, ServerMethodDef, ServerMethodHandler, MethodParams } from './types';

/** Creates a type-safe client method definition. */
export function method<
  TParams extends MethodParams,
  TResult extends z.ZodTypeAny,
>(definition: { paramsSchema: TParams; resultSchema: TResult }, handler?: never): ClientMethodDef<TParams, TResult>;

/** Creates a type-safe server method definition. */
export function method<
  TParams extends MethodParams,
  TResult extends z.ZodTypeAny,
>(definition: { paramsSchema: TParams; resultSchema: TResult }, handler: ServerMethodHandler<TParams, TResult>): ServerMethodDef<TParams, TResult>;

export function method<
  TParams extends MethodParams,
  TResult extends z.ZodTypeAny,
>({ paramsSchema, resultSchema }: { paramsSchema: TParams; resultSchema: TResult; }, handler: ServerMethodHandler<TParams, TResult>): ServerMethodDef<TParams, TResult> {
  // Validate the params schema type
  const paramsSchemaValid =
    paramsSchema instanceof z.ZodVoid ||
    paramsSchema instanceof z.ZodTuple ||
    paramsSchema instanceof z.ZodArray ||
    paramsSchema instanceof z.ZodObject;
  if (!paramsSchemaValid) throw new Error('Invalid params schema');

  return { paramsSchema, resultSchema, handler } as any;
}
