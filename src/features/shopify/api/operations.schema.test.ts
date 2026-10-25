import { buildClientSchema, parse, validate, type IntrospectionQuery } from "graphql";
import { describe, expect, it } from "vitest";
import schemaArtifact from "./fixtures/storefront-2026-10.schema.json";
import * as operations from "./operations";

describe("Shopify Storefront 2026-10 GraphQL documents", () => {
  it("validates every exported operation against the pinned offline schema", () => {
    expect(schemaArtifact.apiVersion).toBe("2026-10");
    expect(schemaArtifact.source).toBe("https://shopify.dev/storefront-graphql-direct-proxy/2026-10");

    const schema = buildClientSchema(schemaArtifact.data as unknown as IntrospectionQuery);
    const documents = Object.entries(operations as Record<string, unknown>).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string"
    );

    expect(documents.length).toBeGreaterThan(0);
    const failures = documents.flatMap(([name, source]) => {
      try {
        return validate(schema, parse(source)).map((error) => `${name}: ${error.message}`);
      } catch (error) {
        return [`${name}: ${error instanceof Error ? error.message : String(error)}`];
      }
    });

    expect(failures).toEqual([]);
  });
});
