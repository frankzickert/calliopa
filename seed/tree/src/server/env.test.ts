import { describe, expect, it } from "vitest";

import requiredEnv from "../../config/required-env.json";

import { findMissing, MissingEnvError, readAppEnv } from "./env";

const complete: Record<string, string> = Object.fromEntries(
  requiredEnv.app.map((name) => [name, `value-for-${name}`]),
);

describe("application configuration", () => {
  it("Given every required variable is set, When configuration is read, Then typed values are returned", () => {
    const environment = readAppEnv(complete);

    expect(environment.databaseUrl).toBe(
      "value-for-CALLIOPA_DATABASE_URL",
    );
    expect(environment.garage.bucket).toBe(
      "value-for-CALLIOPA_GARAGE_BUCKET",
    );
  });

  it("Given several variables are absent, When configuration is read, Then every missing name is reported", () => {
    const source = { ...complete };
    delete source.CALLIOPA_DATABASE_URL;
    delete source.CALLIOPA_GARAGE_BUCKET;

    try {
      readAppEnv(source);
      expect.unreachable("incomplete configuration must throw");
    } catch (error) {
      expect(error).toBeInstanceOf(MissingEnvError);
      expect((error as MissingEnvError).missing).toEqual([
        "CALLIOPA_DATABASE_URL",
        "CALLIOPA_GARAGE_BUCKET",
      ]);
    }
  });

  it("Given a variable is blank, When configuration is checked, Then it is missing", () => {
    expect(
      findMissing({ ...complete, CALLIOPA_DATABASE_URL: "   " }),
    ).toEqual(["CALLIOPA_DATABASE_URL"]);
  });
});
