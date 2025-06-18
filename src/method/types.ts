import { z } from 'zod/v4';

export type AnyClientMethodDef = ClientMethodDef<any, any>;
export type AnyServerMethodDef = ServerMethodDef<any, any>;
export type AnyServerMethodHandler = ServerMethodHandler<any, any>;

/** A type-safe client-side method definition. */
export interface ClientMethodDef<
  TParams extends MethodParams,
  TResult extends z.ZodType
> {
  /** The zod schema of the method parameters */
  paramsSchema: TParams;
  /** The zod schema of the method result */
  resultSchema: TResult;
};

/** A type-safe server-side method definition. */
export interface ServerMethodDef<
  TParams extends MethodParams,
  TResult extends z.ZodType
> extends ClientMethodDef<TParams, TResult> {
  /** The handler of the method */
  handler: ServerMethodHandler<TParams, TResult>;
};

/** A type-safe server-side method handler. */
export type ServerMethodHandler<
  TParams extends MethodParams,
  TResult extends z.ZodType
> = (params: z.infer<TParams>) => MaybePromise<z.infer<TResult>>;

/** Valid params types for methods */
export type MethodParams =
  | z.ZodVoid
  | z.ZodTuple<[z.ZodType, ...z.ZodType[]]>
  | z.ZodArray<z.ZodType>
  | z.ZodObject<Record<string, z.ZodType>>;

/** A helper for a synchronous or asynchronous function's return type. */
export type MaybePromise<T> = T | Promise<T>;