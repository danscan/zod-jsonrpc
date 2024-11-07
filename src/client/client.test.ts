import { describe, expect, it } from 'bun:test';
import { z } from 'zod';
import { JSONRPCError } from '../jsonrpc';
import { method } from '../method';
import { createServer } from '../server';
import { createClient } from '.';

const server = createServer({
  greeting: method({
    paramsSchema: z.tuple([z.string()]),
    resultSchema: z.string(),
  }, async ([name]) => `Hello, ${name}!`),

  internalError: method({
    paramsSchema: z.void(),
    resultSchema: z.string(),
  }, async () => {
    throw JSONRPCError.InternalError({ message: 'Intentional test error', data: 'test data' });
  }),
});

const client = createClient({
  greeting: method({
    paramsSchema: z.tuple([z.string()]),
    resultSchema: z.string(),
  }),

  internalError: method({
    paramsSchema: z.void(),
    resultSchema: z.string(),
  }),
}, async (request) => server.request(request));

describe('client', () => {
  it('handles a normal JSON RPC 2.0 request', async () => {
    const result = await client.greeting(['Dan']);
    expect(result).toBe('Hello, Dan!');
  });

  it('handles a JSON RPC 2.0 error response', async () => {
    await expect(client.internalError()).rejects.toThrow();
  });

  it('handles invalid params', async () => {
    // @ts-expect-error - invalid params type
    await expect(client.greeting('invalid')).rejects.toThrow();
  });

  it('handles a batch request', async () => {
    const result = await client.batch((ctx) => ({
      dan: ctx.greeting(['Dan']),
      andrea: ctx.greeting(['Andrea']),
    }));

    expect(result).toMatchObject({
      dan: { status: 'success', result: 'Hello, Dan!' },
      andrea: { status: 'success', result: 'Hello, Andrea!' },
    });
  });

  it('handles a batch request with mixed success/error results', async () => {
    const result = await client.batch((ctx) => ({
      success: ctx.greeting(['Dan']),
      error: ctx.internalError(),
    }));

    expect(result).toMatchObject({
      success: { status: 'success', result: 'Hello, Dan!' },
      error: { status: 'error', error: expect.any(JSONRPCError) },
    });
  });
});
