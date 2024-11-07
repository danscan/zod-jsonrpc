import { z } from 'zod';

/** A type-safe client-side method definition. */
export interface ClientMethodDef<
  TParams extends MethodParams = MethodParams,
  TResult extends z.ZodTypeAny = z.ZodTypeAny
> {
  /** The zod schema of the method parameters */
  paramsSchema: TParams;
  /** The zod schema of the method result */
  resultSchema: TResult;
};

/** A type-safe server-side method definition. */
export interface ServerMethodDef<
  TParams extends MethodParams = any,
  TResult extends z.ZodTypeAny = z.ZodTypeAny
> extends ClientMethodDef<TParams, TResult> {
  /** The handler of the method */
  handler: ServerMethodHandler<TParams, TResult>;
};

/** A type-safe server-side method handler. */
export type ServerMethodHandler<
  TParams extends MethodParams = MethodParams,
  TResult extends z.ZodTypeAny = z.ZodTypeAny
> = (params: z.infer<TParams>) => MaybePromise<z.infer<TResult>>;

/** Valid params types for methods */
export type MethodParams =
  | z.ZodVoid
  | z.ZodTuple<[z.ZodTypeAny, ...z.ZodTypeAny[]]>
  | z.ZodArray<z.ZodTypeAny>
  | z.ZodObject<Record<string, z.ZodTypeAny>>;

/** A helper for a synchronous or asynchronous function's return type. */
export type MaybePromise<T> = T | Promise<T>;