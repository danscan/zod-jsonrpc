import { describe, expect, it } from 'bun:test';
import { z } from 'zod/mini';
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

  // Test arbitrary error handling
  arbitraryError: method({
    paramsSchema: z.void(),
    resultSchema: z.string(),
  }, async () => {
    throw new Error('Something went wrong');
  }),

  // Test error with custom data
  errorWithData: method({
    paramsSchema: z.void(),
    resultSchema: z.string(),
  }, async () => {
    const error = new Error('Custom error');
    (error as any).customData = { timestamp: Date.now() };
    throw error;
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

  it('converts arbitrary errors to JSON RPC 2.0 Internal Error', async () => {
    const result = await server.request({
      id: 1,
      method: 'arbitraryError',
    });
    expect(result).toMatchObject({
      jsonrpc: '2.0',
      id: 1,
      error: { 
        code: -32603, 
        message: 'Internal error',
        data: expect.objectContaining({
          message: 'Something went wrong'
        })
      },
    });
  });

  it('preserves error data when converting arbitrary errors', async () => {
    const result = await server.request({
      id: 1,
      method: 'errorWithData',
    });
    expect(result).toMatchObject({
      jsonrpc: '2.0',
      id: 1,
      error: { 
        code: -32603, 
        message: 'Internal error',
        data: expect.objectContaining({
          message: 'Custom error',
          customData: expect.objectContaining({
            timestamp: expect.any(Number)
          })
        })
      },
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

  it('handles mixed success and error results in batch requests', async () => {
    const result = await server.request([
      {
        id: 1,
        method: 'greeting',
        params: ['Dan'],
      },
      {
        id: 2,
        method: 'arbitraryError',
      },
      {
        id: 3,
        method: 'internalError',
      },
      {
        id: 4,
        method: 'unknownMethod',
      },
    ]);
    expect(result).toMatchObject([
      { jsonrpc: '2.0', id: 1, result: 'Hello, Dan!' },
      { jsonrpc: '2.0', id: 2, error: { code: -32603, message: 'Internal error' } },
      { jsonrpc: '2.0', id: 3, error: { code: -32603, message: 'Internal error: Intentional test error' } },
      { jsonrpc: '2.0', id: 4, error: { code: -32601, message: 'Method not found' } },
    ]);
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
    expect(result).toMatchObject({
      jsonrpc: '2.0',
      id: 1,
      error: {
        code: -32603,
        message: 'Internal error: Invalid result',
        data: {
          issues: [{ code: 'invalid_type', expected: 'number', path: [], message: 'Invalid input' }],
          value: 'test result',
        },
      },
    });
  });
});

describe('server.createClient', () => {
  it('creates a typed client for the server', async () => {
    const client = server.createClient(async (req) => server.request(req));
    const result = await client.greeting(['Dan']);
    expect(result).toBe('Hello, Dan!');
  });

  it('should allow a schema with transformation (different input and output types) as params schema', async () => {
    const transformServer = createServer({
      transform: method({
        paramsSchema: z.pipe(
          z.tuple([z.string()]),
          z.transform(([val]) => ({ transformed: val })),
        ),
        resultSchema: z.boolean(),
      }, (params) => params.transformed === 'test'),
    });
    const client = transformServer.createClient(async (req) => transformServer.request(req));
    const result = await client.transform(['test']);
    expect(result).toBe(true);
  });

  describe('raw client variants', () => {
    it('rawParams skips client validation but server still validates', async () => {
      let serverResponse: any;
      const client = server.createClient(async (req) => {
        serverResponse = await server.request(req);
        return serverResponse;
      }).rawParams();
      
      // With rawParams, client doesn't validate params, but server still rejects invalid params
      // @ts-expect-error - testing invalid params type
      expect(() => client.greeting([123])).toThrow();
      
      // Assert the error came from the server
      expect(serverResponse).toMatchObject({
        jsonrpc: '2.0',
        error: {
          code: -32602,
          message: expect.stringContaining('Invalid params'),
        },
      });
    });

    it('raw skips both param and result validation', async () => {
      let serverResponse: any;
      const client = server.createClient(async (req) => {
        serverResponse = await server.request(req);
        return serverResponse;
      }).raw();
      
      // Client doesn't validate params, server rejects them
      // @ts-expect-error - testing invalid params type
      expect(() => client.greeting([123])).toThrow();
      
      // Assert error came from server
      expect(serverResponse).toMatchObject({
        jsonrpc: '2.0',
        error: { code: -32602 },
      });
    });
  });
});
