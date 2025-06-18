# @danscan/zod-jsonrpc

Create JSON-RPC 2.0-compliant clients and servers that use Zod to validate requests and responses.

Just define your methods with Zod schemas and handlers, and zod-jsonrpc will handle the rest.

## Features

- JSON-RPC 2.0-compliant
- Transport-agnostic (supports HTTP, WebSockets, and more)
- Automatically handles batch requests, notification requests, and errors
- Rich documentation comments referencing the JSON-RPC 2.0 specification
- Exports Zod schemas and types for JSON-RPC requests, responses, errors and notifications
- Automatic type safety for requests and responses
- No dependencies; just one peer dependency on Zod (see compatibility table below).

### Supported Zod Versions

| zod-jsonrpc Version | Zod Version | Zod Import | Notes |
|---------------------|-------------|------------|-------|
| v3.0.0+ | `^3.25.0` | `import { z } from 'zod/v4'` | Uses Zod v4 API |
| v2.1.0 | `^3.0.0` | `import { z } from 'zod'` | Legacy Zod API support | 

## Installation

```bash
bun add @danscan/zod-jsonrpc
yarn add @danscan/zod-jsonrpc
npm add @danscan/zod-jsonrpc
```

## Quick Start

Here's a minimal example to get you started:

```typescript
import { createServer, method } from '@danscan/zod-jsonrpc';
import { z } from 'zod/v4';

// Define and create a server in one step
const server = createServer({
  greet: method({
    paramsSchema: z.object({ name: z.string() }),
    resultSchema: z.string(),
  }, ({ name }) => `Hello, ${name}!`),
});

// Handle a request
const response = await server.request({
  id: 1,
  method: 'greet',
  params: { name: 'World' },
  jsonrpc: '2.0',
});

console.log(response.result); // "Hello, World!"
```

## Usage

### Creating a Server

```typescript
import { createServer, method, JSONRPC2Error } from '@danscan/zod-jsonrpc';
import { z } from 'zod/v4';

const server = createServer({
  greet: method({
    paramsSchema: z.object({ name: z.string() }),
    resultSchema: z.string(),
  }, ({ name }) => `Hello, ${name}!`),

  mustBeOdd: method({
    paramsSchema: z.object({ number: z.number() }),
    resultSchema: z.boolean(),
  }, ({ number }) => {
    const isOdd = number % 2 === 1;
    // Throw a JSONRPC2Error to return a JSON-RPC 2.0 compliant error response
    if (!isOdd) {
      throw new JSONRPC2Error.InvalidParams({
        message: 'Number must be odd',
        data: { number },
      });
    }
    return true;
  }),
});

// Single request handling
const result = await server.request({
  id: 1,
  method: 'greet',
  params: { name: 'danscan' },
  jsonrpc: '2.0',
});
/*
{
  id: 1,
  result: 'Hello, danscan!',
  jsonrpc: '2.0',
}
*/

// Batch request handling (multiple requests in one call)
const results = await server.request([
  { id: 1, method: 'greet', params: { name: 'danscan' }, jsonrpc: '2.0' },
  { id: 2, method: 'greet', params: { name: 'user' }, jsonrpc: '2.0' },
  { id: 3, method: 'mustBeOdd', params: { number: 4 }, jsonrpc: '2.0' },
]);
/*
[
  { id: 1, result: 'Hello, danscan!', jsonrpc: '2.0' },
  { id: 2, result: 'Hello, user!', jsonrpc: '2.0' },
  { id: 3, error: { code: -32602, message: 'Invalid params: Number must be odd', data: { number: 4 } }, jsonrpc: '2.0' },
]
*/
```

#### Integration with HTTP Servers

```typescript
const jsonRpcServer = createServer({ greet, mustBeOdd });

// Bun
Bun.serve({
  fetch: async (req) => {
    const jsonRpcRequest = await req.json();
    const jsonRpcResponse = await jsonRpcServer.request(jsonRpcRequest);
    return Response.json(jsonRpcResponse);
  }
});

// Next.js
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

### Creating a Client

```typescript
import { createClient, method } from '@danscan/zod-jsonrpc';
import { z } from 'zod/v4';

// Define your transport layer
// HTTP:
const sendRequest = async (request) => {
  const response = await fetch('/jsonrpc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  return response.json();
};

// WebSocket:
const sendRequestViaWebSocket = async (request) => {
  const ws = new WebSocket('ws://localhost:8080');
  ws.onmessage = (event) => {
    return JSON.parse(event.data);
  };
  ws.send(JSON.stringify(request));
};

// Create the client with method definitions
const client = createClient({
  greet: method({
    paramsSchema: z.object({ name: z.string() }),
    resultSchema: z.string(),
  }),
}, sendRequest);

// Make method calls
const greeting = await client.greet({ name: 'danscan' });
console.log(greeting); // 'Hello, danscan!'

// Batch method calls with named results
const results = await client.batch((ctx) => ({
  dan: ctx.greet({ name: 'Dan' }),
  drea: ctx.greet({ name: 'Drea' }),
}));
/*
{
  dan: { ok: true, value: 'Hello, Dan!' },
  drea: { ok: true, value: 'Hello, Drea!' },
}
*/
```

**Pro tip:** If you already have a server defined, create a client from it to ensure consistency:

```typescript
import { server } from './server';

function sendRequest(request) {
  // ...
}

const client = server.createClient(sendRequest);

const result = await client.greet({ name: 'danscan' });
console.log(result); // 'Hello, danscan!'
```

## Recommended Project Structure

For larger applications, I recommend separating method definitions from their implementations. This allows you to:

- Centralize the definition of your API methods
- Share method definitions between client and server
- Version your API independently of your implementation
- Maintain type safety across your entire RPC layer

### Directory Structure

```
src/
  api/
    methods/
      index.ts          # Exports all methods
      auth.ts           # Auth methods
      user.ts           # User methods
    client.ts           # Client definition
    server.ts           # Server definition
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
    userId: z.string().uuid() 
  }),
  resultSchema: z.object({
    id: z.string().uuid(),
    name: z.string(),
    email: z.string().email(),
  }),
});

/** Update user profile */
export const updateUser = method({
  paramsSchema: z.object({
    userId: z.string().uuid(),
    updates: z.object({
      name: z.string().optional(),
      email: z.string().email().optional(),
    }),
  }),
  resultSchema: z.object({
    success: z.boolean(),
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
    if (!user) throw new Error('User not found');
    return user;
  }),

  updateUser: methods.updateUser.implement(async ({ userId, updates }) => {
    await updateUserInDb(userId, updates);
    return { success: true };
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
```
