# @danscan/zod-jsonrpc

Create JSON-RPC 2.0-compliant servers that use Zod to validate requests and responses.

Just define your methods with Zod schemas and handlers, and let the server handle the rest.

## Features

- JSON-RPC 2.0-compliant
- Transport-agnostic (supports HTTP, WebSockets, and more)
- Automatically handles batch requests, notifications, and errors
- Rich documentation comments referencing the JSON-RPC 2.0 specification
- Exports Zod schemas and types for JSON-RPC requests, responses, errors and notifications
- Built with TypeScript
- No dependencies; just one peer dependency: `zod`


## Installation

```bash
bun add @danscan/zod-jsonrpc
yarn add @danscan/zod-jsonrpc
npm add @danscan/zod-jsonrpc
```

## Usage

```typescript
import { Server, JSONRPC2Error } from '@danscan/zod-jsonrpc';
import { z } from 'zod';

const server = new Server({
  greet: Server.method({
    paramsSchema: z.object({ name: z.string() }),
    resultSchema: z.string(),
    handler: async ({ name }) => `Hello, ${name}!`,
  }),

  mustBeOdd: Server.method({
    paramsSchema: z.object({ number: z.number() }),
    resultSchema: z.boolean(),
    handler: ({ number }) => {
      const isOdd = number % 2 === 1;
      // Just throw a JSONRPC2Error to return an error response
      if (!isOdd) {
        throw new JSONRPC2Error.InvalidParams({
          message: 'Number must be odd',
          data: { number },
        });
      }
      return true;
    },
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
  { id: 3, error: { code: -32602, message: 'Number must be odd', data: { number: 4 } }, jsonrpc: '2.0' },
]
*/
```

## Usage with an HTTP Server

```typescript
const jsonRpcServer = new Server({ /* methods */ });

// Simple Bun HTTP server
Bun.serve({
  fetch: async (req) => {
    const jsonRpcRequest = await req.json();
    const jsonRpcResponse = jsonRpcServer.handle(jsonRpcRequest);
    return Response.json(jsonRpcResponse);
  }
});
```

## Creating a Client

```typescript
const client = server.getClient(async (request) => server.request(request));

// Make requests with the client
const result = await client.request({ id: 1, method: 'greet', params: { name: 'danscan' }, jsonrpc: '2.0' });
```
