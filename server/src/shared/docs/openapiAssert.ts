/**
 * Lightweight OpenAPI 3 schema assertions for contract tests.
 * Uses the existing in-repo spec — no second document and no codegen toolchain.
 */

export type JsonSchema = {
  type?: string | readonly string[];
  properties?: Record<string, JsonSchema>;
  required?: readonly string[];
  enum?: readonly unknown[];
  items?: JsonSchema;
  $ref?: string;
  oneOf?: readonly JsonSchema[];
  allOf?: readonly JsonSchema[];
  nullable?: boolean;
  additionalProperties?: boolean | JsonSchema;
  format?: string;
};

export type OpenApiLike = {
  components?: {
    schemas?: Record<string, JsonSchema>;
  };
};

export function resolveRef(spec: OpenApiLike, ref: string): JsonSchema {
  const prefix = "#/components/schemas/";
  if (!ref.startsWith(prefix)) {
    throw new Error(`Unsupported $ref: ${ref}`);
  }
  const name = ref.slice(prefix.length);
  const schema = spec.components?.schemas?.[name];
  if (!schema) {
    throw new Error(`Missing schema: ${name}`);
  }
  return schema;
}

export function deref(spec: OpenApiLike, schema: JsonSchema): JsonSchema {
  if (schema.$ref) {
    return deref(spec, resolveRef(spec, schema.$ref));
  }
  return schema;
}

function typeName(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function matchesType(value: unknown, expected: string): boolean {
  if (expected === "integer") return typeof value === "number" && Number.isInteger(value);
  if (expected === "number") return typeof value === "number" && Number.isFinite(value);
  if (expected === "object") return typeName(value) === "object";
  if (expected === "array") return Array.isArray(value);
  if (expected === "string") return typeof value === "string";
  if (expected === "boolean") return typeof value === "boolean";
  if (expected === "null") return value === null;
  return false;
}

/**
 * Throws when `value` does not satisfy the OpenAPI schema.
 * Extra object properties are allowed unless additionalProperties is false.
 */
export function assertMatchesSchema(
  value: unknown,
  schema: JsonSchema,
  spec: OpenApiLike,
  path = "$"
): void {
  const resolved = deref(spec, schema);

  if (value === null) {
    if (resolved.nullable === true || resolved.type === "null") return;
    if (resolved.oneOf) {
      const ok = resolved.oneOf.some((candidate) => {
        try {
          assertMatchesSchema(value, candidate, spec, path);
          return true;
        } catch {
          return false;
        }
      });
      if (ok) return;
    }
    throw new Error(`${path}: expected non-null value`);
  }

  if (resolved.oneOf && resolved.oneOf.length > 0) {
    const errors: string[] = [];
    for (const candidate of resolved.oneOf) {
      try {
        assertMatchesSchema(value, candidate, spec, path);
        return;
      } catch (err) {
        errors.push(err instanceof Error ? err.message : String(err));
      }
    }
    throw new Error(`${path}: matched none of oneOf (${errors.join(" | ")})`);
  }

  if (resolved.allOf) {
    for (const part of resolved.allOf) {
      assertMatchesSchema(value, part, spec, path);
    }
  }

  if (resolved.enum && !resolved.enum.includes(value)) {
    throw new Error(`${path}: ${JSON.stringify(value)} not in enum ${JSON.stringify(resolved.enum)}`);
  }

  const expectedTypes = resolved.type
    ? Array.isArray(resolved.type)
      ? resolved.type
      : [resolved.type]
    : [];

  if (expectedTypes.length > 0 && !expectedTypes.some((expected) => matchesType(value, expected))) {
    throw new Error(`${path}: expected ${expectedTypes.join("|")}, got ${typeName(value)}`);
  }

  if (expectedTypes.includes("object") || resolved.properties || resolved.required) {
    if (typeName(value) !== "object") {
      throw new Error(`${path}: expected object, got ${typeName(value)}`);
    }
    const record = value as Record<string, unknown>;
    for (const key of resolved.required ?? []) {
      if (!(key in record)) {
        throw new Error(`${path}: missing required property "${key}"`);
      }
    }
    for (const [key, propertySchema] of Object.entries(resolved.properties ?? {})) {
      if (record[key] === undefined) continue;
      assertMatchesSchema(record[key], propertySchema, spec, `${path}.${key}`);
    }
    if (resolved.additionalProperties === false) {
      const allowed = new Set(Object.keys(resolved.properties ?? {}));
      for (const key of Object.keys(record)) {
        if (!allowed.has(key)) {
          throw new Error(`${path}: unexpected property "${key}"`);
        }
      }
    }
  }

  if (expectedTypes.includes("array") || resolved.items) {
    if (!Array.isArray(value)) {
      if (expectedTypes.includes("array")) {
        throw new Error(`${path}: expected array, got ${typeName(value)}`);
      }
      return;
    }
    if (resolved.items) {
      value.forEach((item, index) => {
        assertMatchesSchema(item, resolved.items as JsonSchema, spec, `${path}[${index}]`);
      });
    }
  }
}

export function assertErrorBody(body: unknown, spec: OpenApiLike): void {
  const schema = spec.components?.schemas?.Error;
  if (!schema) {
    throw new Error("OpenAPI is missing components.schemas.Error");
  }
  assertMatchesSchema(body, schema, spec, "error");
  if (typeof body !== "object" || body === null || !("error" in body) || typeof body.error !== "string") {
    throw new Error("error: documented Error schema must include a string error field in practice");
  }
}
