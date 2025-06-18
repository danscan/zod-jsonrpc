import { describe, expect, it } from 'bun:test';
import { JSONRPCError } from './JSONRPCError';

describe('JSONRPC2Error constructor', () => {
  it('should create an error with a code, message, and data', () => {
    const error = new JSONRPCError(-32600, 'test', 'test data');
    expect(error.name).toBe('JSON-RPC 2.0 Error');
    expect(error.code).toBe(-32600);
    expect(error.message).toBe('test');
    expect(error.data).toBe('test data');
  });

  it('should create an error with a code and message', () => {
    const error = new JSONRPCError(-32600, 'test');
    expect(error.code).toBe(-32600);
    expect(error.message).toBe('test');
    expect(error.data).toBeUndefined();
  });
});

describe('JSONRPC2Error.ParseError', () => {
  it('should create a standard ParseError', () => {
    const error = JSONRPCError.ParseError();
    expect(error instanceof JSONRPCError).toBe(true);
    expect(error.code).toBe(-32700);
    expect(error.message).toBe('Parse error');
    expect(error.data).toBeUndefined();
  });
});

describe('JSONRPC2Error.InvalidRequest', () => {
  it('should create a standard InvalidRequest', () => {
    const error = JSONRPCError.InvalidRequest();
    expect(error instanceof JSONRPCError).toBe(true);
    expect(error.code).toBe(-32600);
    expect(error.message).toBe('Invalid Request');
    expect(error.data).toBeUndefined();
  });
});

describe('JSONRPC2Error.InvalidRequest with custom data', () => {
  it('should create a standard InvalidRequest with custom data', () => {
    const error = JSONRPCError.InvalidRequest({ message: 'Your request was invalid', data: 'test data' });
    expect(error instanceof JSONRPCError).toBe(true);
    expect(error.code).toBe(-32600);
    expect(error.message).toBe('Invalid Request: Your request was invalid');
    expect(error.data).toBe('test data');
  });
});

describe('JSONRPC2Error.MethodNotFound', () => {
  it('should create a standard MethodNotFound', () => {
    const error = JSONRPCError.MethodNotFound();
    expect(error instanceof JSONRPCError).toBe(true);
    expect(error.code).toBe(-32601);
    expect(error.message).toBe('Method not found');
    expect(error.data).toBeUndefined();
  });
});

describe('JSONRPC2Error.InvalidParams', () => {
  it('should create a standard InvalidParams', () => {
    const error = JSONRPCError.InvalidParams();
    expect(error instanceof JSONRPCError).toBe(true);
    expect(error.code).toBe(-32602);
    expect(error.message).toBe('Invalid params');
    expect(error.data).toBeUndefined();
  });
});

describe('JSONRPC2Error.InvalidParams with custom data', () => {
  it('should create a standard InvalidParams with custom data', () => {
    const error = JSONRPCError.InvalidParams({ message: 'Your params were invalid', data: 'test data' });
    expect(error instanceof JSONRPCError).toBe(true);
    expect(error.code).toBe(-32602);
    expect(error.message).toBe('Invalid params: Your params were invalid');
    expect(error.data).toBe('test data');
  });
});

describe('JSONRPC2Error.InternalError', () => {
  it('should create a standard InternalError', () => {
    const error = JSONRPCError.InternalError();
    expect(error instanceof JSONRPCError).toBe(true);
    expect(error.code).toBe(-32603);
    expect(error.message).toBe('Internal error');
    expect(error.data).toBeUndefined();
  });
});

describe('JSONRPC2Error.InternalError with custom data', () => {
  it('should create a standard InternalError with custom data', () => {
    const error = JSONRPCError.InternalError({ message: 'Something went wrong', data: 'test data' });
    expect(error instanceof JSONRPCError).toBe(true);
    expect(error.code).toBe(-32603);
    expect(error.message).toBe('Internal error: Something went wrong');
    expect(error.data).toBe('test data');
  });

  it('should include the data in its JSON representation', () => {
    const error = JSONRPCError.InternalError({ message: 'Something went wrong', data: 'test data' });
    const json = error.toJSON();
    expect(json).toMatchSnapshot();
    expect(json.data).toBe('test data');
  });
});
