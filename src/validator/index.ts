import { StandardSchemaV1 } from "@standard-schema/spec";
import { JSONRPCError } from "../jsonrpc/index.js";

/** Parses a value against a schema, throwing an error if the value is invalid. Returns the parsed output value. */
export function parse<T extends StandardSchemaV1>(
  schema: T,
  input: unknown
): StandardSchemaV1.InferOutput<T> {
  const result = schema['~standard'].validate(input);
  if (result instanceof Promise) throw JSONRPCError.InternalError({ message: 'Asynchronous validation is not supported in @danscan/zod-jsonrpc' });
  if (result.issues) throw new Error(JSON.stringify(result.issues, null, 2));

  return result.value;
}

// –
// Safe Parse
// –

/** Parses a value against a schema, returning a success/failure result. */
export function safeParse<T extends StandardSchemaV1>(
  schema: T,
  input: unknown
): SafeParseResult<T> {
  const result = schema['~standard'].validate(input);
  if (result instanceof Promise) throw JSONRPCError.InternalError({ message: 'Asynchronous validation is not supported in @danscan/zod-jsonrpc' });
  if (result.issues) return { success: false, issues: result.issues };
  return { success: true, data: result.value };
}

type SafeParseResult<T extends StandardSchemaV1> = 
  | { success: true; issues?: never; data: StandardSchemaV1.InferOutput<T> }
  | { success: false; data?: never; issues: readonly StandardSchemaV1.Issue[] };
