# zod-jsonrpc

Create type-safe JSON-RPC API clients and servers in JS/TS using any transport.

## Features

- **JSON-RPC 2.0-compliant** - Full specification compliance, including batch requests, errors, and notifications
- **Works with standard-schema validation libraries** - Uses `@standard-schema/spec` to support Zod, Effect Schema, Valibot, ArkType, and more
- **Transport-agnostic** - Works with HTTP, WebSockets, IPC, or any custom transport layer
- **Automatic request handling** - Batch requests, notifications, and error responses handled automatically
- **Raw client modes** - Disable client-side validation for performance or when server validation is guaranteed
- **Schema transformations** - Raw clients allow schemas to transform data only once (on the server)
- **Type safety** - Full TypeScript support with automatic inference for requests and responses
- **Zero dependencies** - Only peer dependency on Zod, uses `zod/v4-mini` for minimal bundle impact
- **Flexible validation** - Enable/disable validation per client or per method call

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

Create a complete JSON-RPC setup in minutes:

```typescript
import { createServer, createClient, method } from '@danscan/zod-jsonrpc';
import { z } from 'zod/v4';

// 1. Define your API methods
const greet = method({
  paramsSchema: z.object({ name: z.string() }),
  resultSchema: z.string(),
}, ({ name }) => `Hello, ${name}!`);

// 2. Create a server
const server = createServer({ greet });

// 3. Create a client (with validation)
const client = createClient({ greet }, async (request) => {
  // Your transport layer - could be HTTP, WebSocket, etc.
  return server.request(request); // Direct call for demo
});

// 4. Make type-safe calls
const greeting = await client.greet({ name: 'World' });
console.log(greeting); // "Hello, World!"
```

For production, you'll typically separate the client and server across different processes or machines.

## Usage

### Creating a Server

Define methods with input/output validation and implement your business logic:

```typescript
import { createServer, method, JSONRPC2Error } from '@danscan/zod-jsonrpc';
import { z } from 'zod/v4';

const server = createServer({
  greet: method({
    paramsSchema: z.object({ name: z.string() }),
    resultSchema: z.string(),
  }, ({ name }) => `Hello, ${name}!`),

  divide: method({
    paramsSchema: z.object({ 
      dividend: z.number(), 
      divisor: z.number() 
    }),
    resultSchema: z.number(),
  }, ({ dividend, divisor }) => {
    if (divisor === 0) {
      throw new JSONRPC2Error.InvalidParams({
        message: 'Division by zero',
        data: { divisor },
      });
    }
    return dividend / divisor;
  }),

  // Method that might throw an arbitrary error
  processData: method({
    paramsSchema: z.object({ data: z.string() }),
    resultSchema: z.string(),
  }, async ({ data }) => {
    // Any error thrown here becomes a JSON-RPC Internal Error
    if (!data.trim()) {
      throw new Error('Data cannot be empty');
    }
    return `Processed: ${data}`;
  }),
});

// Handle single requests
const result = await server.request({
  id: 1,
  method: 'greet',
  params: { name: 'danscan' },
  jsonrpc: '2.0',
});
// { id: 1, result: 'Hello, danscan!', jsonrpc: '2.0' }

// Handle batch requests automatically
const results = await server.request([
  { id: 1, method: 'greet', params: { name: 'Alice' }, jsonrpc: '2.0' },
  { id: 2, method: 'divide', params: { dividend: 10, divisor: 2 }, jsonrpc: '2.0' },
  { id: 3, method: 'divide', params: { dividend: 10, divisor: 0 }, jsonrpc: '2.0' },
]);
// [
//   { id: 1, result: 'Hello, Alice!', jsonrpc: '2.0' },
//   { id: 2, result: 5, jsonrpc: '2.0' },
//   { id: 3, error: { code: -32602, message: 'Invalid params: Division by zero', data: { divisor: 0 } }, jsonrpc: '2.0' }
// ]
```

### Error Handling

Server method handlers can throw any type of error, and the server will automatically return appropriate JSON-RPC 2.0 error responses:

```typescript
const server = createServer({
  // Throw specific JSON-RPC errors for controlled error responses
  validateInput: method({
    paramsSchema: z.object({ value: z.number() }),
    resultSchema: z.boolean(),
  }, ({ value }) => {
    if (value < 0) {
      throw new JSONRPC2Error.InvalidParams({
        message: 'Value must be positive',
        data: { value },
      });
    }
    return true;
  }),

  // Arbitrary errors are automatically converted to Internal Errors
  riskyOperation: method({
    paramsSchema: z.void(),
    resultSchema: z.string(),
  }, async () => {
    // This will become: { code: -32603, message: 'Internal error', data: { message: 'Database connection failed', ... } }
    throw new Error('Database connection failed');
  }),
});

// Single request error handling
const errorResult = await server.request({
  id: 1,
  method: 'riskyOperation',
});
// { jsonrpc: '2.0', id: 1, error: { code: -32603, message: 'Internal error', data: { message: 'Database connection failed' } } }

// Batch request error handling - errors are handled individually
const batchResults = await server.request([
  { id: 1, method: 'validateInput', params: { value: 5 } },
  { id: 2, method: 'validateInput', params: { value: -1 } },
  { id: 3, method: 'riskyOperation' },
]);
// [
//   { jsonrpc: '2.0', id: 1, result: true },
//   { jsonrpc: '2.0', id: 2, error: { code: -32602, message: 'Invalid params: Value must be positive', data: { value: -1 } } },
//   { jsonrpc: '2.0', id: 3, error: { code: -32603, message: 'Internal error', data: { message: 'Database connection failed' } } }
// ]
```

This error handling works consistently across both single requests and batch requests, ensuring that one failing method doesn't prevent other methods in a batch from executing.

### Creating a Client

Build type-safe clients that automatically validate requests and responses:

```typescript
import { createClient, method } from '@danscan/zod-jsonrpc';
import { z } from 'zod/v4';

// Define your transport function
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
  greet: method({
    paramsSchema: z.object({ name: z.string() }),
    resultSchema: z.string(),
  }),
  
  getUser: method({
    paramsSchema: z.object({ id: z.uuid() }),
    resultSchema: z.object({
      id: z.uuid(),
      name: z.string(),
      email: z.email(),
    }),
  }),
}, sendRequest);

// Make individual calls
const greeting = await client.greet({ name: 'danscan' });

// Make batch calls with named results
const results = await client.batch((ctx) => ({
  greeting: ctx.greet({ name: 'Dan' }),
  user: ctx.getUser({ id: '123e4567-e89b-12d3-a456-426614174000' }),
}));
// {
//   greeting: { ok: true, value: 'Hello, Dan!' },
//   user: { ok: true, value: { id: '...', name: 'Dan', email: 'dan@selfref.com' } }
// }
```

### Handling Batch Results with Errors

Batch requests return results with a consistent structure that allows type-safe error handling:

```typescript
const results = await client.batch((ctx) => ({
  validUser: ctx.getUser({ id: 'valid-uuid' }),
  invalidUser: ctx.getUser({ id: 'invalid-id' }),
  greeting: ctx.greet({ name: 'Dan' }),
}));

// Type-safe error handling with .ok property
if (results.validUser.ok) {
  // results.validUser is { ok: true, value: UserType }
  console.log('User found:', results.validUser.value.name);
} else {
  // results.validUser is { ok: false, error: JSONRPCError }
  console.error('Failed to get user:', results.validUser.error.message);
}
```

The `.ok` property enables TypeScript to automatically narrow the type, giving you full type safety when accessing either the `value` (on success) or `error` (on failure).

### Raw Client Features

For performance optimization or when you control both client and server, you can disable client-side validation:

#### Server-Generated Raw Clients

When creating a client from a server, you get a raw client by default. This allows schema transformations to happen only once (on the server):

```typescript
const server = createServer({
  transform: method({
    paramsSchema: z.string().transform(s => s.toUpperCase()),
    resultSchema: z.string().transform(s => `Result: ${s}`),
  }, (input) => input), // input is already transformed to uppercase
});

// Raw client - no double transformation
const rawClient = server.createClient(sendRequest);
const result = await rawClient.transform('hello'); // Server transforms: 'hello' -> 'HELLO' -> 'Result: HELLO'

// Validating client - would double-transform
const validatingClient = rawClient.validating();
```

#### Manual Raw Mode

Any client can be switched to raw mode to skip validation:

```typescript
const client = createClient({ greet }, sendRequest);

// Skip all validation (params and results)
const rawClient = client.raw();
await rawClient.greet({ name: 'World' }); // No client-side validation

// Skip only params validation
const rawParamsClient = client.rawParams();
await rawParamsClient.greet({ name: 'World' }); // Results still validated

// Skip only results validation  
const rawResultsClient = client.rawResults();
await rawResultsClient.greet({ name: 'World' }); // Params still validated

// Re-enable full validation
const validatingClient = rawClient.validating();
await validatingClient.greet({ name: 'World' }); // Full validation restored
```

Raw clients are ideal when:
- You control both client and server and trust the server's validation
- You want maximum performance by avoiding duplicate validation
- Your schemas include transformations that should only be applied once
- You're building internal APIs where client-side validation is redundant

### Integration with HTTP Servers

Integrate with any HTTP framework:

```typescript
const jsonRpcServer = createServer({ greet, divide });

// Bun
Bun.serve({
  fetch: async (req) => {
    const jsonRpcRequest = await req.json();
    const jsonRpcResponse = await jsonRpcServer.request(jsonRpcRequest);
    return Response.json(jsonRpcResponse);
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
  const jsonRpcResponse = await jsonRpcServer.request(req.body);
  res.json(jsonRpcResponse);
});
```

### Client from Server

Create a client directly from your server definition to ensure consistency:

```typescript
import { server } from './server';

const sendRequest = async (request) => {
  const response = await fetch('/api/jsonrpc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  return response.json();
};

// `server.createClient` returns a raw client by default since the server guarantees validation
const client = server.createClient(sendRequest);

// Enable client-side params/results validation if needed
const validatingClient = client.validating();
```

## Recommended Project Structure

For larger applications, separate method definitions from implementations to enable code sharing and independent versioning:

### Directory Structure

```
src/
  api/
    methods/
      index.ts          # Exports all methods
      auth.ts           # Authentication methods
      user.ts           # User management methods
    client.ts           # Client configuration
    server.ts           # Server implementation
  // ... rest of your app
```

### Method Definitions

```typescript
// api/methods/user.ts
import { method } from '@danscan/zod-jsonrpc';
import { z } from 'zod/v4';

/** Get user profile by ID */
export const getUser = method({
  paramsSchema: z.object({ 
    userId: z.uuid() 
  }),
  resultSchema: z.object({
    id: z.uuid(),
    name: z.string(),
    email: z.email(),
    createdAt: z.iso.datetime(),
  }),
});

/** Update user profile */
export const updateUser = method({
  paramsSchema: z.object({
    userId: z.uuid(),
    updates: z.object({
      name: z.string().optional(),
      email: z.email().optional(),
    }),
  }),
  resultSchema: z.object({
    success: z.boolean(),
    user: z.object({
      id: z.uuid(),
      name: z.string(),
      email: z.email(),
    }),
  }),
});
```

```typescript
// api/methods/index.ts
export * from './auth';
export * from './user';
```

### Server Implementation

```typescript
// api/server.ts
import { createServer } from '@danscan/zod-jsonrpc';
import * as methods from './methods';
import { getUserFromDb, updateUserInDb } from '../db';

export const server = createServer({
  getUser: methods.getUser.implement(async ({ userId }) => {
    const user = await getUserFromDb(userId);
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }),

  updateUser: methods.updateUser.implement(async ({ userId, updates }) => {
    const user = await updateUserInDb(userId, updates);
    return {
      success: true,
      user,
    };
  }),
});
```

### Client Setup

```typescript
// api/client.ts
import { createClient } from '@danscan/zod-jsonrpc';
import * as methods from './methods';

const sendRequest = async (request) => {
  const response = await fetch('/api/jsonrpc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  return response.json();
};

export const apiClient = createClient({
  getUser: methods.getUser,
  updateUser: methods.updateUser,
}, sendRequest);

// For internal use where you trust the server validation
export const rawApiClient = apiClient.raw();
```

This structure enables you to share method definitions between client and server, version your API independently, and maintain type safety across your entire RPC layer.
