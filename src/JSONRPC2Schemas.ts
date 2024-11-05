import { z } from 'zod';
import { JSONRPC2Error } from './JSONRPC2Error';

/**
 * JSON-RPC 2.0 Request Object Specification:
 * 
 * A rpc call is represented by sending a Request object to a Server. The Request object has the following members:
 * - jsonrpc: A String specifying the version of the JSON-RPC protocol. MUST be exactly "2.0".
 * - method: A String containing the name of the method to be invoked. Method names that begin with the word rpc followed by a period character (U+002E or ASCII 46) are reserved for rpc-internal methods and extensions and MUST NOT be used for anything else.
 * - params: A Structured value that holds the parameter values to be used during the invocation of the method. This member MAY be omitted.
 * - id: An identifier established by the Client that MUST contain a String, Number, or NULL value if included. If it is not included it is assumed to be a notification. The value SHOULD normally not be Null [1] and Numbers SHOULD NOT contain fractional parts [2]
 */
export type JSONRPCRequest = z.infer<typeof JSONRPCRequestSchema>;
export const JSONRPCRequestSchema = z.object({
  /**
   * JSON-RPC 2.0 Specification:
   * 
   * A String specifying the version of the JSON-RPC protocol. MUST be exactly "2.0".
   */
  jsonrpc: z.literal('2.0'),

  /**
   * JSON-RPC 2.0 Specification:
   * 
   * A String containing the name of the method to be invoked. Method names that begin with the word rpc followed by a period character (U+002E or ASCII 46) are reserved for rpc-internal methods and extensions and MUST NOT be used for anything else.
   */
  method: z.string(),

  /**
   * JSON-RPC 2.0 Specification:
   * 
   * A Structured value that holds the parameter values to be used during the invocation of the method. This member MAY be omitted.
   * 
   * If present, parameters for the rpc call MUST be provided as a Structured value. Either by-position through an Array or by-name through an Object.
   * - by-position: params MUST be an Array, containing the values in the Server expected order.
   * - by-name: params MUST be an Object, with member names that match the Server expected parameter names. The absence of expected names MAY result in an error being generated. The names MUST match exactly, including case, to the method's expected parameters.
   */
  params: z.union([z.array(z.any()), z.record(z.string(), z.any())]).optional(),

  /**
   * JSON-RPC 2.0 Specification:
   * 
   * An identifier established by the Client that MUST contain a String, Number, or NULL value if included. If it is not included it is assumed to be a notification. The value SHOULD normally not be Null [1] and Numbers SHOULD NOT contain fractional parts [2]
   * The Server MUST reply with the same value in the Response object if included. This member is used to correlate the context between the two objects.
   *
   * [1] The use of Null as a value for the id member in a Request object is discouraged, because this specification uses a value of Null for Responses with an unknown id. Also, because JSON-RPC 1.0 uses an id value of Null for Notifications this could cause confusion in handling.
   * [2] Fractional parts may be problematic, since many decimal fractions cannot be represented exactly as binary fractions.
   * 
   * ---
   * 
   * A Notification is a Request object without an "id" member. A Request object that is a Notification signifies the Client's lack of interest in the corresponding Response object, and as such no Response object needs to be returned to the client. The Server MUST NOT reply to a Notification, including those that are within a batch request.
   * Notifications are not confirmable by definition, since they do not have a Response object to be returned. As such, the Client would not be aware of any errors (like e.g. "Invalid params","Internal error").
   */
  id: z.union([z.number(), z.string(), z.null()]).optional(),
});

/**
 * JSON-RPC 2.0 Response Object Specification:
 * 
 * When a rpc call is made, the Server MUST reply with a Response, except for in the case of Notifications. The Response is expressed as a single JSON Object, with the following members:
 * - jsonrpc: A String specifying the version of the JSON-RPC protocol. MUST be exactly "2.0".
 * - result: This member is REQUIRED on success. This member MUST NOT exist if there was an error invoking the method. The value of this member is determined by the method invoked on the Server.
 * - error: This member is REQUIRED on error. This member MUST NOT exist if there was no error invoking the method. The value of this member is determined by the method invoked on the Server.
 * - id: This member is REQUIRED. The value of this member is provided by the Client in the Request object and MUST be identical to the value of the same member in the Request.
 */
export type JSONRPCResponse = z.infer<typeof JSONRPCResponseSchema>;
export const JSONRPCResponseSchema = z.object({
  /**
   * JSON-RPC 2.0 Specification:
   * 
   * A String specifying the version of the JSON-RPC protocol. MUST be exactly "2.0".
   */
  jsonrpc: z.literal('2.0'),

  /**
   * JSON-RPC 2.0 Specification:
   * 
   * This member is REQUIRED on success.
   * This member MUST NOT exist if there was an error invoking the method.
   * The value of this member is determined by the method invoked on the Server.
   */
  result: z.any().optional(),

  /**
   * JSON-RPC 2.0 Specification:
   * 
   * This member is REQUIRED on error.
   * This member MUST NOT exist if there was no error triggered during invocation.
   * The value for this member MUST be an Object as defined in section 5.1. [Implemented in JSONRPC2Error]
   */
  error: z.instanceof(JSONRPC2Error).transform(e => e.toJSON()).optional(),

  /**
   * JSON-RPC 2.0 Specification:
   * 
   * This member is REQUIRED.
   * It MUST be the same as the value of the id member in the Request Object.
   * If there was an error in detecting the id in the Request object (e.g. Parse error/Invalid Request), it MUST be Null.
   */
  id: z.union([z.number(), z.string(), z.null()]),
});

/**
 * JSON-RPC 2.0 Specification:
 * 
 * To send several Request objects at the same time, the Client MAY send an Array filled with Request objects.
 * The Server should respond with an Array containing the corresponding Response objects, after all of the batch Request objects have been processed. A Response object SHOULD exist for each Request object, except that there SHOULD NOT be any Response objects for notifications. The Server MAY process a batch rpc call as a set of concurrent tasks, processing them in any order and with any width of parallelism.
 */
export type JSONRPCRequestBatch = z.infer<typeof JSONRPCRequestBatchSchema>;
export const JSONRPCRequestBatchSchema = z.array(JSONRPCRequestSchema);

/**
 * JSON-RPC 2.0 Specification:
 * 
 * The Response objects being returned from a batch call MAY be returned in any order within the Array. The Client SHOULD match contexts between the set of Request objects and the resulting set of Response objects based on the id member within each Object.
 */
export type JSONRPCResponseBatch = z.infer<typeof JSONRPCResponseBatchSchema>;
export const JSONRPCResponseBatchSchema = z.array(JSONRPCResponseSchema);
