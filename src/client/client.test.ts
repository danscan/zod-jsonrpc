import { beforeEach, describe, expect, it } from 'bun:test';
import { z } from 'zod/mini';
import { createClient } from '.';
import { JSONRPCError, RequestObject } from '../jsonrpc';
import { method } from '../method';
import { createServer } from '../server';

let clientRequest: RequestObject | undefined;

beforeEach(() => {
  clientRequest = undefined;
});

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

  // Mismatched params type between client and server (client: number, server: string)
  badParams: method({
    paramsSchema: z.tuple([z.number()]),
    resultSchema: z.number(),
  }, async ([num]) => num * 2),

  // Server-validated mismatched result type between client and server (client: number, server: string)
  badServerResult: method({
    paramsSchema: z.void(),
    resultSchema: z.string(),
    // @ts-expect-error - testing invalid result type
  }, async () => 42),

  // Non-server-validated mismatched result type between client and server (client: number, server: string)
  badClientResult: method({
    paramsSchema: z.void(),
    resultSchema: z.any(),
  }, async () => 42),
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

  // Mismatched params type between client and server (client: number, server: string)
  badParams: method({
    paramsSchema: z.tuple([z.string()]),
    resultSchema: z.number(),
  }),

  // Server-validated mismatched result type between client and server (client: number, server: string)
  badServerResult: method({
    paramsSchema: z.void(),
    resultSchema: z.number(),
  }),

  // Non-server-validated mismatched result type between client and server (client: number, server: string)
  badClientResult: method({
    paramsSchema: z.void(),
    resultSchema: z.string(),
  }),
}, async (request) => {
  clientRequest = request;
  return server.request(request);
});

describe('client', () => {
  it('handles a normal JSON RPC 2.0 request', async () => {
    const result = await client.greeting(['Dan']);
    expect(result).toBe('Hello, Dan!');
  });

  it('handles a JSON RPC 2.0 error response', async () => {
    expect(client.internalError()).rejects.toThrow();
  });

  it('handles invalid params', async () => {
    // @ts-expect-error - invalid params type
    expect(client.greeting('invalid')).rejects.toThrow();
  });

  it('handles a batch request', async () => {
    const result = await client.batch((ctx) => ({
      dan: ctx.greeting(['Dan']),
      andrea: ctx.greeting(['Andrea']),
    }));

    expect(result).toMatchObject({
      dan: { ok: true, value: 'Hello, Dan!' },
      andrea: { ok: true, value: 'Hello, Andrea!' },
    });
  });

  it('handles a batch request with mixed success/error results', async () => {
    const batchResult = await client.batch((ctx) => ({
      success: ctx.greeting(['Dan']),
      error: ctx.internalError(),
      badClientResult: ctx.badClientResult(),
    }));
    expect(batchResult).toMatchObject({
      success: { ok: true, value: 'Hello, Dan!' },
      error: { ok: false, error: expect.any(JSONRPCError) },
      badClientResult: { ok: false, error: expect.any(JSONRPCError) },
    });
  });
});

describe('client.raw* variants - params validation', () => {
  it('accepts invalid client params using a raw client', async () => {
    // Server still receives the request, but returns an error
    // @ts-expect-error - testing invalid params type
    expect(() => client.raw().greeting([123])).toThrow();
    expect(clientRequest).toMatchObject({
      jsonrpc: '2.0',
      method: 'greeting',
      params: [123],
    });
  });

  it('accepts invalid client params using a rawParams client', async () => {
    // Server still receives the request, but returns an error
    // @ts-expect-error - testing invalid params type
    expect(() => client.rawParams().greeting([123])).toThrow();
    expect(clientRequest).toMatchObject({
      jsonrpc: '2.0',
      method: 'greeting',
      params: [123],
    });
  });

  it('accepts invalid batch-request client params using a raw client', async () => {
    const result = await client.raw().batch((ctx) => ({
      // @ts-expect-error - testing invalid params type
      greeting: ctx.greeting([123]),
    }));
    expect(clientRequest).toMatchObject([{
      jsonrpc: '2.0',
      method: 'greeting',
      params: [123],
    }]);

    // Server still receives the request, but returns an error
    expect(result.greeting.ok).toBe(false);
    expect(!result.greeting.ok && result.greeting.error).toBeInstanceOf(JSONRPCError);
  });

  it('accepts invalid batch-request client params using a rawParams client', async () => {
    const result = await client.rawParams().batch((ctx) => ({
      // @ts-expect-error - testing invalid params type
      greeting: ctx.greeting([123]),
    }));
    expect(clientRequest).toMatchObject([{
      jsonrpc: '2.0',
      method: 'greeting',
      params: [123],
    }]);

    // Server still receives the request, but returns an error
    expect(result.greeting.ok).toBe(false);
    expect(!result.greeting.ok && result.greeting.error).toBeInstanceOf(JSONRPCError);
  });

  it('does NOT accept invalid client params using a rawResults client', async () => {
    // @ts-expect-error - testing invalid params type
    expect(() => client.rawResults().greeting([123])).toThrow();
    expect(clientRequest).toBeUndefined();
  });

  it('does NOT accept invalid batch-request client params using a rawResults client', async () => {
    expect(() => client.rawResults().batch((ctx) => ({
      // @ts-expect-error - testing invalid params type
      greeting: ctx.greeting([123]),
    }))).toThrow();
    expect(clientRequest).toBeUndefined();
  });

  it('does NOT accept invalid client params using a normal client', async () => {
    // @ts-expect-error - testing invalid params type
    expect(() => client.greeting([123])).toThrow();
    expect(clientRequest).toBeUndefined();
  });

  it('does NOT accept invalid batch-request client params using a normal client', async () => {
    expect(() => client.batch((ctx) => ({
      // @ts-expect-error - testing invalid params type
      greeting: ctx.greeting([123]),
    }))).toThrow();
    expect(clientRequest).toBeUndefined();
  });

  it('does NOT accept invalid client params using a validating client', async () => {
    // @ts-expect-error - testing invalid params type
    expect(() => client.raw().validating().greeting([123])).toThrow();
    expect(clientRequest).toBeUndefined();
  });

  it('does NOT accept invalid batch-request client params using a validating client', async () => {
    expect(() => client.raw().validating().batch((ctx) => ({
      // @ts-expect-error - testing invalid params type
      greeting: ctx.greeting([123]),
    }))).toThrow();
  });
});

describe('client.raw* variants - result validation', () => {
  it('accepts invalid client results using a raw client', async () => {
    const result = await client.raw().badClientResult();
    // @ts-expect-error - testing invalid result type
    expect(result).toBe(42);
  });

  it('accepts invalid batch-request client results using a raw client', async () => {
    const result = await client.raw().batch((ctx) => ({
      badClientResult: ctx.badClientResult(),
    }));

    expect(result.badClientResult.ok).toBe(true);
    // @ts-expect-error - testing invalid result type
    expect(result.badClientResult.ok && result.badClientResult.value).toBe(42);
  });

  it('accepts invalid client results using a rawResults client', async () => {
    const result = await client.rawResults().badClientResult();
    // @ts-expect-error - testing invalid result type
    expect(result).toBe(42);
  });

  it('accepts invalid batch-request client results using a rawResults client', async () => {
    const result = await client.rawResults().batch((ctx) => ({
      badClientResult: ctx.badClientResult(),
    }));

    expect(result.badClientResult.ok).toBe(true);
    // @ts-expect-error - testing invalid result type
    expect(result.badClientResult.ok && result.badClientResult.value).toBe(42);
  });

  it('throws due to invalid server results via server-side validation', async () => {
    expect(client.raw().badServerResult()).rejects.toThrow();
  });

  it('receives an error due to invalid batch-request server results using a raw client', async () => {
    const result = await client.raw().batch((ctx) => ({
      badServerResult: ctx.badServerResult(),
    }));

    expect(result.badServerResult.ok).toBe(false);
    expect(!result.badServerResult.ok && result.badServerResult.error).toBeInstanceOf(JSONRPCError);
  });

  it('does NOT accept invalid client results using a rawParams client', async () => {
    expect(client.rawParams().badClientResult()).rejects.toThrow();
  });

  it('does NOT accept invalid batch-request client results using a rawParams client', async () => {
    const result = await client.rawParams().batch((ctx) => ({
      badClientResult: ctx.badClientResult(),
    }));

    expect(result.badClientResult.ok).toBe(false);
    expect(!result.badClientResult.ok && result.badClientResult.error).toBeInstanceOf(JSONRPCError);
  });

  it('does NOT accept invalid client results using a normal client', async () => {
    expect(client.badClientResult()).rejects.toThrow();
  });

  it('does NOT accept invalid batch-request client results using a normal client', async () => {
    const result = await client.batch((ctx) => ({
      badClientResult: ctx.badClientResult(),
    }));

    expect(result.badClientResult.ok).toBe(false);
    expect(!result.badClientResult.ok && result.badClientResult.error).toBeInstanceOf(JSONRPCError);
  });

  it('does NOT accept invalid client results using a validating client', async () => {
    expect(client.raw().validating().badClientResult()).rejects.toThrow();
  });

  it('does NOT accept invalid batch-request client results using a validating client', async () => {
    const result = await client.raw().validating().batch((ctx) => ({
      badClientResult: ctx.badClientResult(),
    }));

    expect(result.badClientResult.ok).toBe(false);
    expect(!result.badClientResult.ok && result.badClientResult.error).toBeInstanceOf(JSONRPCError);
  });
});
