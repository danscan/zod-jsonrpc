import { describe, expect, it } from 'bun:test';
import { z } from 'zod/mini';
import { method } from './method';

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
    expect(lol.handler).toBeUndefined();
  });

  it('should allow a client method definition to be implemented as a server method definition', () => {
    const greet = method({
      paramsSchema: z.object({ name: z.string() }),
      resultSchema: z.string(),
    });

    const greetServer = greet.implement(({ name }) => `Hello, ${name}!`);

    expect(greetServer.handler({ name: 'world' })).toBe('Hello, world!');
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

    // @ts-expect-error - implement must not be present on server method definitions
    expect(lol.implement).toBeUndefined();
  });

  it('should have a type error if the return type of the handler does not match the result schema', () => {
    // @ts-expect-error - return type does not match result schema
    method({ paramsSchema: z.void(), resultSchema: z.boolean() }, async () => 'test result');
  });

  it('should allow a discriminated union as a params schema', () => {
    const lol = method({
      paramsSchema: z.discriminatedUnion('type', [z.object({ type: z.literal('a'), a: z.string() }), z.object({ type: z.literal('b'), b: z.string() })]),
      resultSchema: z.boolean(),
    });

    expect(async () => {
      const lolServer = lol.implement((params) => params.type === 'a' && params.a === 'a');
      await lolServer.handler({ type: 'a', a: 'a' });
    }).not.toThrow();

    expect(async () => {
      const lolServer = lol.implement((params) => params.type === 'b' && params.b === 'b');
      await lolServer.handler({ type: 'b', b: 'b' });
    }).not.toThrow();

    // Type-level checks
    // @ts-expect-error - type is not a or b
    const lolServerWrongType = lol.implement((params) => params.type === 'c' && params.c === 'c');
    const lolServer = lol.implement(() => true);
    // @ts-expect-error - type is not a or b
    lolServer.handler({ type: 'c', b: 'c' });
  });

  it('should allow a method params schema to be a record, array/tuple, or void', () => {
    expect(() => {
      const record = method({
        paramsSchema: z.object({ name: z.string() }),
        resultSchema: z.boolean(),
      });
  
      const array = method({
        paramsSchema: z.array(z.string()),
        resultSchema: z.boolean(),
      });
  
      const tuple = method({
        paramsSchema: z.tuple([z.string()]),
        resultSchema: z.boolean(),
      });
  
      const voId = method({
        paramsSchema: z.void(),
        resultSchema: z.boolean(),
      });
    }).not.toThrow();
  });
});
