import { Server } from './Server';
import { JSONRPC2Error } from './JSONRPC2Error';
import { describe, it, expect } from 'bun:test';
import { z } from 'zod';
import type { JSONRPCResponse } from './JSONRPC2Schemas';

let notificationParam: string | undefined;

const server = new Server({
  greeting: {
    paramsSchema: z.tuple([z.string()]),
    resultSchema: z.string(),
    handler: async (params) => `Hello, ${params[0]}!`,
  },

  notification: {
    type: 'notification',
    paramsSchema: z.tuple([z.string()]),
    handler: async (params) => {
      notificationParam = params[0];
    },
  },

  internalError: {
    paramsSchema: z.undefined(),
    resultSchema: z.string(),
    handler: async () => {
      throw JSONRPC2Error.InternalErrorWithData('test data');
    },
  },
});

describe('Server.request', () => {
  it('handles a normal JSON RPC 2.0 request', async () => {
    const result = await server.request({
      jsonrpc: '2.0',
      id: 1,
      method: 'greeting',
      params: ['Dan'],
    });
    expect(result).toMatchObject({
      jsonrpc: '2.0',
      id: 1,
      result: 'Hello, Dan!',
    });
  });

  it('handles a JSON RPC 2.0 notification', async () => {
    const result = await server.request({
      jsonrpc: '2.0',
      method: 'notification',
      params: ['Dan'],
    });
    expect(result).toBeUndefined();
    expect(notificationParam).toBe('Dan');
  });

  it('returns standard JSON RPC 2.0 errors', async () => {
    const result = await server.request({
      jsonrpc: '2.0',
      method: 'internalError',
      id: 1,
    });
    expect(result).toMatchObject({
      jsonrpc: '2.0',
      id: 1,
      error: { code: -32603, message: 'Internal error', data: 'test data' },
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
      jsonrpc: '2.0',
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
      jsonrpc: '2.0',
      id: 1,
      method: 'greeting',
      params: [123],
    });
    expect(result).toMatchObject({
      jsonrpc: '2.0',
      id: 1,
      error: { code: -32602, message: 'Invalid params' },
    });
  });

  it('handles a batch request', async () => {
    const result = await server.request([
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'greeting',
        params: ['Dan'],
      },
      {
        jsonrpc: '2.0',
        id: 2,
        method: 'greeting',
        params: ['Andrea'],
      },
    ]);
    expect(result).toMatchObject([
      { jsonrpc: '2.0', id: 1, result: 'Hello, Dan!' },
      { jsonrpc: '2.0', id: 2, result: 'Hello, Andrea!' },
    ]);
  });

  it('handles string request ids', async () => {
    const result = await server.request([{ jsonrpc: '2.0', id: '1', method: 'greeting', params: ['Dan'] }]);
    expect(result).toMatchObject([{ jsonrpc: '2.0', id: '1', result: 'Hello, Dan!' }]);
  });
});

describe('Server.extend', () => {
  it('extends the server with new methods', async () => {
    const extendedServer = server.extend({ newMethod: { paramsSchema: z.tuple([z.string()]), resultSchema: z.string(), handler: async (params) => `Hello, ${params[0]}!` } });
    const result = await extendedServer.request({
      jsonrpc: '2.0',
      id: 1,
      method: 'newMethod',
      params: ['Dan'],
    });
    expect(result).toMatchObject({ jsonrpc: '2.0', id: 1, result: 'Hello, Dan!' });
  });
});
