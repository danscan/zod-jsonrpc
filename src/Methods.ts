import { z } from 'zod'

// Server
export type ServerMethodSpec<TParams extends z.ZodTypeAny = z.ZodTypeAny, TResult extends z.ZodTypeAny = z.ZodTypeAny> =
  | ServerMethod<TParams, TResult>
  | ServerNotification<TParams>;
export type ServerMethod<TParams extends z.ZodTypeAny, TResult extends z.ZodTypeAny> = { type: 'method'; paramsSchema: TParams; resultSchema: TResult; handler: (input: z.infer<TParams>) => MaybePromise<z.infer<TResult>> };
export type ServerNotification<TParams extends z.ZodTypeAny> = { type: 'notification'; paramsSchema: TParams; handler: (input: z.infer<TParams>) => MaybePromise<void> };

export type MaybePromise<T> = T | Promise<T>;