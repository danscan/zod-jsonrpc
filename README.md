# zod-jsonrpc

Create type-safe JSON-RPC API clients and servers in JS/TS using any transport.

## Features

- **JSON-RPC 2.0-compliant** - Comprehensive spec compliance including batch requests, notifications, and errors
- **Supports many schema validation libraries** - Uses `@standard-schema/spec` to support Zod, Effect Schema, Valibot, ArkType, and more
- **Transport-agnostic** - Works with HTTP, WebSockets, or any custom transport layer
- **Automatic request handling** - Batch requests, notifications, and error responses handled automatically
- **Raw client modes** - Disable client-side validation for performance or when server validation is guaranteed
- **Type safety** - Full TypeScript support with automatic inference for requests and responses, including batch requests

### Schema Validation Libraries

`zod-jsonrpc` uses `@standard-schema/spec` for schema validation, supporting any library that implements the Standard Schema specification:
- Zod
- Effect Schema  
- Valibot
- ArkType
- ...and [more](https://standardschema.dev/#what-schema-libraries-implement-the-spec)

## Installation

```bash
bun add @danscan/zod-jsonrpc
yarn add @danscan/zod-jsonrpc
npm add @danscan/zod-jsonrpc
```

## Quick Start

`zod-jsonrpc` makes it easy to create type-safe JSON-RPC servers and clients.

```typescript
import { createServer, createClient, method } from '@danscan/zod-jsonrpc';
import { z } from 'zod/v4';

// Define methods
const greet = method({
  paramsSchema: z.object({ name: z.string() }),
  resultSchema: z.string(),
}, ({ name }) => `Hello, ${name}!`);

// Create server and client
const server = createServer({ greet });
const client = createClient({ greet }, async (request) => {
  // Your transport layer here: fetch, WebSocket, etc.
  return server.request(request);
});

// Make type-safe calls
const greeting = await client.greet({ name: 'World' });
console.log(greeting); // "Hello, World!"
```

## Methods

Methods are the core building blocks of your JSON-RPC API. They define the input and output schemas for a given method, and the handler function that will be called when the method is invoked.

```typescript
const greet = method({
  paramsSchema: z.object({ name: z.string() }),
  resultSchema: z.string(),
}, ({ name }) => `Hello, ${name}!`);
```

You can also define methods with a `paramsSchema` and a `resultSchema` only, and provide a handler function later:

```typescript
// Import this in your client and server
export const greet = method({
  paramsSchema: z.object({ name: z.string() }),
  resultSchema: z.string(),
});

// In your server implementation:
import { greet } from './methods';

const server = createServer({
  greet: greet.implement(({ name }) => `Hello, ${name}!`),
});
```

## Creating Servers

Start by creating a server with your methods:

```typescript
import { createServer, method, JSONRPCError } from '@danscan/zod-jsonrpc';
import { z } from 'zod/v4';

const server = createServer({
  add: method({
    paramsSchema: z.object({ a: z.number(), b: z.number() }),
    resultSchema: z.number(),
  }, ({ a, b }) => a + b),

  divide: method({
    paramsSchema: z.object({ dividend: z.number(), divisor: z.number() }),
    resultSchema: z.number(),
  }, ({ dividend, divisor }) => {
    if (divisor === 0) {
      throw new JSONRPCError.InvalidParams({ message: 'Cannot divide by zero' });
    }
    return dividend / divisor;
  }),
});
```

The server automatically handles single requests, batch requests, and notifications:

```typescript
// Single request
const result = await server.request({
  id: 1,
  method: 'add',
  params: { a: 5, b: 3 },
  jsonrpc: '2.0',
});
// { id: 1, result: 8, jsonrpc: '2.0' }

// Batch request
const results = await server.request([
  { id: 1, method: 'add', params: { a: 5, b: 3 }, jsonrpc: '2.0' },
  { id: 2, method: 'divide', params: { dividend: 10, divisor: 2 }, jsonrpc: '2.0' },
]);
// [{ id: 1, result: 8, jsonrpc: '2.0' }, { id: 2, result: 5, jsonrpc: '2.0' }]
```

## Error Handling

Servers automatically convert any thrown error into proper JSON-RPC responses:

```typescript
const server = createServer({
  validateAge: method({
    paramsSchema: z.object({ age: z.number() }),
    resultSchema: z.boolean(),
  }, ({ age }) => {
    if (age < 0) {
      // You can easily construct and throw a JSONRPC-specific error (ParseError, InvalidRequest, MethodNotFound, InvalidParams, InternalError)
      throw JSONRPCError.InvalidParams({ message: 'Age cannot be negative', data: { age } });
    }
    if (age >= 150) {
      // Any other kind of thrown error becomes a JSONRPCError.InternalError
      throw new Error(`Please don't use Bryan Johnson's age`);
    }
    return true;
  }),
});
```

Errors are handled individually in batch requests, so one failure doesn't affect others:

```typescript
const results = await server.request([
  { id: 1, method: 'validateAge', params: { age: 25 }, jsonrpc: '2.0' },
  { id: 2, method: 'validateAge', params: { age: -5 }, jsonrpc: '2.0' },
  { id: 3, method: 'validateAge', params: { age: 200 }, jsonrpc: '2.0' },
]);
// [
//   { id: 1, result: true, jsonrpc: '2.0' },
//   { id: 2, error: { code: -32602, message: 'Invalid params: Age cannot be negative' }, jsonrpc: '2.0' },
//   { id: 3, error: { code: -32603, message: 'Internal error', data: { message: 'Please don\'t use Bryan Johnson\'s age' } }, jsonrpc: '2.0' }
// ]
```

## Creating Clients

Build type-safe clients that validate requests and responses:

```typescript
import { createClient, method } from '@danscan/zod-jsonrpc';

// Define your transport
const sendRequest = async (request) => {
  const response = await fetch('/api/jsonrpc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  return response.json();
};

// Create client with method definitions
const client = createClient({
  add: method({
    paramsSchema: z.object({ a: z.number(), b: z.number() }),
    resultSchema: z.number(),
  }),
}, sendRequest);

// Make calls with full type safety
const sum = await client.add({ a: 5, b: 3 }); // number
```

## Batch Requests

Clients provide a convenient API for batch requests with named results:

```typescript
const results = await client.batch((ctx) => ({
  // Name each call in the batch so you can easily access the results by name
  // All calls are executed in parallel, so you can use the results as they come in
  sum: ctx.add({ a: 5, b: 3 }),
  product: ctx.multiply({ a: 5, b: 3 }),
  quotient: ctx.divide({ dividend: 10, divisor: 2 }),
}));

// Handle results with type-safe error checking
if (results.sum.ok) {
  console.log('Sum:', results.sum.value); // number
} else {
  console.error('Sum failed:', results.sum.error.message);
}

// Process all results
Object.entries(results).forEach(([operation, result]) => {
  if (result.ok) {
    console.log(`${operation}:`, result.value);
  } else {
    console.error(`${operation} failed:`, result.error.message);
  }
});
```

## Using Schema Transformations

Schemas that change your data in any way should usually only be applied once. If you provide a transforming schema in a method on both your client and server, you should use a raw client to avoid double transformation.

```typescript
// This method is provided to the client and server
const normalize = method({
  paramsSchema: z.string().transform(s => s.toUpperCase()),
  resultSchema: z.string().transform(s => `Result: ${s}`),
}, (input) => input);


const server = createServer({ normalize });

// If you create your client manually, you can use the `raw` method to create a raw client
// This way, the schema transformation is only applied on the server
const client = createClient({ normalize }, sendRequest);
const rawClient = client.raw();

// When generating a client from a server, it will be a raw client by default
const client = server.createClient(sendRequest);
```

If you are only using zod-jsonrpc for the client, your schema transformations will only be applied once, so you don't need to use a raw client.

```typescript
const client = createClient({ normalize }, sendRequest);
const result = await client.normalize('hello'); // "Result: HELLO"
```

## Raw Client Modes

Client has methods that return a new client with different validation modes:

- `client.raw()`: Skip all schema parsing on the client, delegating to the server
- `client.rawParams()`: Skip only parameter validation on the client
- `client.rawResults()`: Skip only result validation on the client
- `client.validating()`: Re-enable all validation on the client

```typescript
const client = createClient({ add }, sendRequest);

// Skip validation of both params and results
const rawClient = client.raw();
const result = await rawClient.add({ a: 5, b: 3 }); // No client-side validation

// Skip only params validation (results still validated)
const rawParamsClient = client.rawParams();

// Skip only result validation (params still validated)
const rawResultsClient = client.rawResults();

// Re-enable params and results validation
const validatingClient = rawClient.validating();

// For example, to disable validation on one request:
client.raw().add({ a: 5, b: 3 });
```

## Transport Integration

Integrate with any HTTP framework or transport:

```typescript
const jsonRpcServer = createServer({ add, divide });

// Bun
Bun.serve({
  fetch: async (req) => {
    const request = await req.json();
    const response = await jsonRpcServer.request(request);
    return Response.json(response);
  }
});

// Next.js App Router
export async function POST(request: Request) {
  const jsonRpcRequest = await request.json();
  const jsonRpcResponse = await jsonRpcServer.request(jsonRpcRequest);
  return Response.json(jsonRpcResponse);
}

// Express.js
app.post('/jsonrpc', async (req, res) => {
  const response = await jsonRpcServer.request(req.body);
  res.json(response);
});
```

## Recommended Project Structure

For larger applications, separate method definitions from implementations:

```
src/
  api/
    methods/          # Shared method definitions
      user.ts
      auth.ts
    server.ts         # Server implementation
    client.ts         # Client setup
```

Define methods separately to share between client and server:

```typescript
// api/methods/user.ts
export const getUser = method({
  paramsSchema: z.object({ id: z.string().uuid() }),
  resultSchema: z.object({
    id: z.string().uuid(),
    name: z.string(),
    email: z.string().email(),
  }),
});

// api/server.ts
import * as methods from './methods';

export const server = createServer({
  getUser: methods.getUser.implement(async ({ id }) => {
    return await getUserFromDatabase(id);
  }),
});

// api/client.ts
import * as methods from './methods';

export const client = createClient({
  getUser: methods.getUser,
}, sendRequest);
```

This structure enables you to share method definitions, maintain type safety across your entire API, and version your API independently of implementation details.
