import { JSONRPC2Error } from './JSONRPC2Error';
import { describe, it, expect } from 'bun:test';

describe('JSONRPC2Error constructor', () => {
  it('should create an error with a code, message, and data', () => {
    const error = new JSONRPC2Error(-32600, 'test', 'test data');
    expect(error.name).toBe('JSON-RPC 2.0 Error');
    expect(error.code).toBe(-32600);
    expect(error.message).toBe('test');
    expect(error.data).toBe('test data');
  });

  it('should create an error with a code and message', () => {
    const error = new JSONRPC2Error(-32600, 'test');
    expect(error.code).toBe(-32600);
    expect(error.message).toBe('test');
    expect(error.data).toBeUndefined();
  });
});

describe('JSONRPC2Error.ParseError', () => {
  it('should create a standard ParseError', () => {
    const error = JSONRPC2Error.ParseError;
    expect(error instanceof JSONRPC2Error).toBe(true);
    expect(error.code).toBe(-32700);
    expect(error.message).toBe('Parse error');
    expect(error.data).toBeUndefined();
  });
});

describe('JSONRPC2Error.InvalidRequest', () => {
  it('should create a standard InvalidRequest', () => {
    const error = JSONRPC2Error.InvalidRequest;
    expect(error instanceof JSONRPC2Error).toBe(true);
    expect(error.code).toBe(-32600);
    expect(error.message).toBe('Invalid Request');
    expect(error.data).toBeUndefined();
  });
});

describe('JSONRPC2Error.InvalidRequestWithData', () => {
  it('should create a standard InvalidRequest with data', () => {
    const error = JSONRPC2Error.InvalidRequestWithData('test data');
    expect(error instanceof JSONRPC2Error).toBe(true);
    expect(error.code).toBe(-32600);
    expect(error.message).toBe('Invalid Request');
    expect(error.data).toBe('test data');
  });
});

describe('JSONRPC2Error.MethodNotFound', () => {
  it('should create a standard MethodNotFound', () => {
    const error = JSONRPC2Error.MethodNotFound;
    expect(error instanceof JSONRPC2Error).toBe(true);
    expect(error.code).toBe(-32601);
    expect(error.message).toBe('Method not found');
    expect(error.data).toBeUndefined();
  });
});

describe('JSONRPC2Error.InvalidParams', () => {
  it('should create a standard InvalidParams', () => {
    const error = JSONRPC2Error.InvalidParams;
    expect(error instanceof JSONRPC2Error).toBe(true);
    expect(error.code).toBe(-32602);
    expect(error.message).toBe('Invalid params');
    expect(error.data).toBeUndefined();
  });
});

describe('JSONRPC2Error.InvalidParamsWithData', () => {
  it('should create a standard InvalidParams with data', () => {
    const error = JSONRPC2Error.InvalidParamsWithData('test data');
    expect(error instanceof JSONRPC2Error).toBe(true);
    expect(error.code).toBe(-32602);
    expect(error.message).toBe('Invalid params');
    expect(error.data).toBe('test data');
  });
});

describe('JSONRPC2Error.InternalError', () => {
  it('should create a standard InternalError', () => {
    const error = JSONRPC2Error.InternalError;
    expect(error instanceof JSONRPC2Error).toBe(true);
    expect(error.code).toBe(-32603);
    expect(error.message).toBe('Internal error');
    expect(error.data).toBeUndefined();
  });
});

describe('JSONRPC2Error.InternalErrorWithData', () => {
  it('should create a standard InternalError with data', () => {
    const error = JSONRPC2Error.InternalErrorWithData('test data');
    expect(error instanceof JSONRPC2Error).toBe(true);
    expect(error.code).toBe(-32603);
    expect(error.message).toBe('Internal error');
    expect(error.data).toBe('test data');
  });

  it('should include the data in its JSON representation', () => {
    const error = JSONRPC2Error.InternalErrorWithData('test data');
    const json = error.toJSON();
    expect(json).toMatchSnapshot();
    expect(json.data).toBe('test data');
  });
});
