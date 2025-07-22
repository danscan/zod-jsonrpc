import { z } from "zod";

// Type for optional error configuration using statics
type ErrorConfig = { message?: string; data?: unknown };

/**
 * Represents a JSON-RPC 2.0 error.
 */
export class JSONRPCError extends Error {
  /** Invalid JSON was received by the server. An error occurred on the server while parsing the JSON text. */
  static ParseError = ({ message, data }: ErrorConfig = {}) => new JSONRPCError(-32700, formatErrorMessage('Parse error', message), data);

  /** The JSON sent is not a valid Request object. */
  static InvalidRequest = ({ message, data }: ErrorConfig = {}) => new JSONRPCError(-32600, formatErrorMessage('Invalid Request', message), data);

  /** The method does not exist / is not available. */
  static MethodNotFound = ({ message, data }: ErrorConfig = {}) => new JSONRPCError(-32601, formatErrorMessage('Method not found', message), data);

  /** Invalid method parameter(s). */
  static InvalidParams = ({ message, data }: ErrorConfig = {}) => new JSONRPCError(-32602, formatErrorMessage('Invalid params', message), data);

  /** Internal JSON-RPC error. */
  static InternalError = ({ message, data }: ErrorConfig = {}) => new JSONRPCError(-32603, formatErrorMessage('Internal error', message), data);

  name = 'JSON-RPC 2.0 Error';

  /** The JSON-RPC 2.0 error code. */
  public readonly code: number;
  /** The error data. */
  public readonly data?: unknown;

  constructor(code: number, message: string, data?: unknown) {
    super(message);
    // Set the error code according to the JSON-RPC 2.0 specification
    this.code = code;
    // Set the error data
    this.data = data;
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      data: this.data,
    };
  }

  toString() {
    const header = `${this.name}: ${this.message} (Code: ${this.code})`;
    const data = this.data ? `\n\nData: ${JSON.stringify(this.data, null, 2)}` : '';
    const stack = this.stack ? `\n\nStack: ${this.stack}` : '';

    return `----\n${header}${data}${stack}\n----`;
  }
}

// ----------------------------------------------
// Private Helpers
// ----------------------------------------------

function formatErrorMessage(errorType: string, message?: string) {
  return message
    ? `${errorType}: ${message}`
    : errorType;
}

// ----------------------------------------------
// Schemas
// ----------------------------------------------

export const JSONRPCErrorSchema = z.object({
  code: z.number(),
  message: z.string(),
  data: z.unknown(),
});
