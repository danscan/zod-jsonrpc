import { describe, expect, it } from 'bun:test';
import { method } from './method';
import { z } from 'zod';

describe('method', () => {
  it('should return a client method definition', () => {
    const lol = method({
      paramsSchema: z.object({ name: z.string() }),
      resultSchema: z.boolean(),
    });

    expect(lol).toMatchObject({
      paramsSchema: z.object({ name: z.string() }),
      resultSchema: z.boolean(),
    });

    // @ts-expect-error - handler must not be present on client method definitions
    lol.handler;
  });

  it('should return a server method definition', () => {
    const lol = method({
      paramsSchema: z.tuple([z.string()]),
      resultSchema: z.boolean(),
    }, async (params) => typeof params[0] === 'string');

    expect(lol).toMatchObject({
      paramsSchema: z.tuple([z.string()]),
      resultSchema: z.boolean(),
      handler: expect.any(Function),
    });
  });

  it('should throw an error if the params schema is invalid', () => {
    // @ts-expect-error - params schema is invalid
    expect(() => method({ paramsSchema: z.string(), resultSchema: z.boolean() })).toThrow('Invalid params schema');
  });

  it('should have a type error if the return type of the handler does not match the result schema', () => {
    // @ts-expect-error - return type does not match result schema
    method({ paramsSchema: z.void(), resultSchema: z.boolean() }, async () => 'test result');
  });
});
