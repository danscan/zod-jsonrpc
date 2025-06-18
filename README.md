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
- No dependencies; just one peer dependency: `zod@^3.25.0`.

### Supported Zod Versions

As of zod-jsonrpc v3.0.0, the Zod v4 API (`import { z } from 'zod/v4'`) is required to specify schemas.

If you need support for the pre-v4 zod API, use zod-jsonrpc v2.1.0, which is compatible with `zod@^3.0.0`. 

## Installation

```bash
bun add @danscan/zod-jsonrpc
yarn add @danscan/zod-jsonrpc
npm add @danscan/zod-jsonrpc
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
    // Just throw a JSONRPC2Error to return an error response
    if (!isOdd) {
      throw new JSONRPC2Error.InvalidParams({
        message: 'Number must be odd',
        data: { number },
      });
    }
    return true;
  }),
});

// Handles single requests
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

// Handles batch requests
const result = await server.request([
  { id: 1, method: 'greet', params: { name: 'danscan' }, jsonrpc: '2.0' },
  { id: 2, method: 'greet', params: { name: 'user' }, jsonrpc: '2.0' },
  { id: 3, method: 'mustBeOdd', params: { number: 4 }, jsonrpc: '2.0' },
]);
/*
[
  { id: 1, result: 'Hello, danscan!', jsonrpc: '2.0' },
  { id: 2, result: 'Hello, user!', jsonrpc: '2.0' },
  // Throwing a JSON-RPC 2.0 error returns a correct JSON-RPC 2.0 error response
  { id: 3, error: { code: -32602, message: 'Invalid params: Number must be odd', data: { number: 4 } }, jsonrpc: '2.0' },
]
*/
```

#### Usage with an HTTP Server

```typescript
const jsonRpcServer = createServer({ /* methods */ });

// Simple Bun HTTP server
Bun.serve({
  fetch: async (req) => {
    const jsonRpcRequest = await req.json();
    const jsonRpcResponse = await jsonRpcServer.request(jsonRpcRequest);
    return Response.json(jsonRpcResponse);
  }
});
```

## Creating a Client

```typescript
import { createClient } from '@danscan/zod-jsonrpc';
import { z } from 'zod/v4';

// Define a function that sends a JSON-RPC request to the server
const sendRequest = async (request: JSONRPCRequest) => {
  const response = await fetch('/jsonrpc', {
    method: 'POST',
    body: JSON.stringify(request),
  });
  return response.json();
};

// Create the client with the methods you want to call, and pass in the request function
const client = createClient({
  greet: method({
    paramsSchema: z.object({ name: z.string() }),
    resultSchema: z.string(),
  }),
}, sendRequest);

// Send a single request
const result = await client.greet({ name: 'danscan' });
// 'Hello, danscan!'

// Send a batch request, setting a convenient key for each request so you can easily match them up in the response
const result = await client.batch((ctx) => ({
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

If you already have a server defined, you can create a client from it using the `server.createClient` method.

```typescript
const client = server.createClient(async (request) => {
  // TODO: send the request to the server and return the result
});
```
