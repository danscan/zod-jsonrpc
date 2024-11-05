/**
 * Represents a JSON-RPC 2.0 error.
 */
export class JSONRPC2Error extends Error {
  /** Invalid JSON was received by the server. An error occurred on the server while parsing the JSON text. */
  static ParseError = new JSONRPC2Error(-32700, 'Parse error');

  /** The JSON sent is not a valid Request object. */
  static InvalidRequest = new JSONRPC2Error(-32600, 'Invalid Request');
  static InvalidRequestWithData = (data: unknown) => new JSONRPC2Error(-32600, 'Invalid Request', data);

  /** The method does not exist / is not available. */
  static MethodNotFound = new JSONRPC2Error(-32601, 'Method not found');
  static MethodNotFoundWithData = (data: unknown) => new JSONRPC2Error(-32601, 'Method not found', data);

  /** Invalid method parameter(s). */
  static InvalidParams = new JSONRPC2Error(-32602, 'Invalid params');
  static InvalidParamsWithData = (data: unknown) => new JSONRPC2Error(-32602, 'Invalid params', data);

  /** Internal JSON-RPC error. */
  static InternalError = new JSONRPC2Error(-32603, 'Internal error');
  static InternalErrorWithData = (data: unknown) => new JSONRPC2Error(-32603, 'Internal error', data);

  name = 'JSON-RPC 2.0 Error';

  /** The JSON-RPC 2.0 error code. */
  public readonly code: number;
  /** The error data. */
  public readonly data?: unknown;

  constructor(code: number, message: string, data?: unknown) {
    super(message);
    this.code = code;
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
