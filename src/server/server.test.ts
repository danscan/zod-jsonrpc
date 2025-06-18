import { describe, expect, it } from 'bun:test';
import { z } from 'zod/v4';
import { createServer } from '.';
import { JSONRPCError } from '../jsonrpc';
import { method } from '../method';

let notificationParam: string | undefined;

const server = createServer({
  greeting: method({
    paramsSchema: z.tuple([z.string()]),
    resultSchema: z.string(),
  }, (params) => `Hello, ${params[0]}!`),

  notification: method({
    paramsSchema: z.tuple([z.string()]),
    resultSchema: z.boolean(),
  }, async (params) => {
    notificationParam = params[0];
    return true;
  }),

  internalError: method({
    paramsSchema: z.void(),
    resultSchema: z.string(),
  }, async () => {
    throw JSONRPCError.InternalError({ message: 'Intentional test error', data: 'test data' });
  }),
});

const serverWithSchemaError = createServer({
  // If the below is not a type error, something is broken
  invalidResult: method({
    paramsSchema: z.void(),
    resultSchema: z.number(),
    // @ts-expect-error - this is exercising invalid result types, which are a type error
  }, async () => 'test result'),
});

describe('server.request', () => {
  it('handles a normal JSON RPC 2.0 request', async () => {
    const result = await server.request({
      id: 1,
      method: 'greeting',
      params: ['Dan'],
    });
    expect(result).toMatchObject({
      id: 1,
      jsonrpc: '2.0',
      result: 'Hello, Dan!',
    });
  });

  it('handles a JSON RPC 2.0 notification', async () => {
    const result = await server.request({
      method: 'notification',
      params: ['Dan'],
    });
    expect(result).toBeNull();
    expect(notificationParam).toBe('Dan');
  });

  it('returns standard JSON RPC 2.0 errors', async () => {
    const result = await server.request({
      id: 1,
      method: 'internalError',
    });
    expect(result).toMatchObject({
      jsonrpc: '2.0',
      id: 1,
      error: { code: -32603, message: 'Internal error: Intentional test error', data: 'test data' },
    });
  });

  it('handles an invalid request', async () => {
    const result = await server.request({
      jsonrpc: '1.0',
    });
    expect(result).toMatchObject({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32600, message: 'Invalid Request' },
    });
  });

  it('handles a method not found error', async () => {
    const result = await server.request({
      id: 1,
      method: 'unknownMethod',
    });
    expect(result).toMatchObject({
      jsonrpc: '2.0',
      id: 1,
      error: { code: -32601, message: 'Method not found' },
    });
  });

  it('handles an invalid params error', async () => {
    const result = await server.request({
      id: 1,
      method: 'greeting',
      params: [123],
    });
    expect(result).toMatchObject({
      jsonrpc: '2.0',
      id: 1,
      error: { code: -32602, message: 'Invalid params: Invalid params for method greeting' },
    });
  });

  it('handles a batch request', async () => {
    const result = await server.request([
      {
        id: 1,
        method: 'greeting',
        params: ['Dan'],
      },
      {
        method: 'notification',
        params: ['The notification was received'],
      },
      {
        id: 2,
        method: 'greeting',
        params: ['Andrea'],
      },
    ]);
    expect(result).toMatchObject([
      { jsonrpc: '2.0', id: 1, result: 'Hello, Dan!' },
      { jsonrpc: '2.0', id: 2, result: 'Hello, Andrea!' },
    ]);
    expect(notificationParam).toBe('The notification was received');
  });

  it('handles string request ids', async () => {
    const result = await server.request([{ jsonrpc: '2.0', id: '1', method: 'greeting', params: ['Dan'] }]);
    expect(result).toMatchObject([{ jsonrpc: '2.0', id: '1', result: 'Hello, Dan!' }]);
  });
});

describe('server.extend', () => {
  it('extends the server with new methods', async () => {
    const extendedServer = server.extend({
      newMethod: {
        paramsSchema: z.tuple([z.string()]),
        resultSchema: z.string(),
        handler: async (params) => `Hello, ${params[0]}!`,
      },
    });
    const result = await extendedServer.request({
      id: 1,
      method: 'newMethod',
      params: ['Dan'],
    });
    expect(result).toMatchObject({ jsonrpc: '2.0', id: 1, result: 'Hello, Dan!' });
  });
});

describe('server.method.resultSchema', () => {
  it('returns an internal error if the result does not adhere to the result schema', async () => {
    const result = await serverWithSchemaError.request({
      jsonrpc: '2.0',
      id: 1,
      method: 'invalidResult',
    });
    expect(result).toMatchObject({ jsonrpc: '2.0', id: 1, error: { code: -32603, message: 'Internal error' } });
  });
});

describe('server.createClient', () => {
  it('creates a typed client for the server', async () => {
    const client = server.createClient(async (req) => server.request(req));
    const result = await client.greeting(['Dan']);
    expect(result).toBe('Hello, Dan!');
  });
});
