declare module "@paypal/checkout-server-sdk" {
  export namespace core {
    export class LiveEnvironment {
      constructor(clientId: string, clientSecret: string);
    }
    export class SandboxEnvironment {
      constructor(clientId: string, clientSecret: string);
    }
    export class PayPalHttpClient {
      constructor(environment: LiveEnvironment | SandboxEnvironment);
      execute<T>(request: unknown): Promise<{ result: T }>;
    }
  }
  export namespace orders {
    export class OrdersCreateRequest {
      prefer(value: string): void;
      requestBody(body: unknown): void;
    }
    export class OrdersCaptureRequest {
      constructor(orderId: string);
      requestBody(body: unknown): void;
    }
  }
}
