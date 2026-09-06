import { describe, expect, it } from "vitest";

import {
  bearerToken,
  formatToken,
  newSecret,
  parseToken,
  verifierFor,
  verifies,
} from "./api-clients.mjs";

const CREDENTIAL_ID = "3f2a91c2-1b4d-4e6a-9c8f-0a1b2c3d4e5f";

describe("credential secrets", () => {
  it("Given a new secret, When it is stored, Then only its digest is kept", () => {
    const secret = newSecret();
    const verifier = verifierFor(secret);

    expect(secret).toMatch(/^[0-9a-f]{64}$/u);
    expect(verifier).not.toContain(secret);
    expect(verifies(secret, verifier)).toBe(true);
  });

  it("Given a wrong secret, When it is verified, Then it fails", () => {
    expect(verifies(newSecret(), verifierFor(newSecret()))).toBe(false);
  });

  it("Given a malformed verifier, When it is compared, Then it fails rather than throws", () => {
    expect(verifies(newSecret(), "not-a-digest")).toBe(false);
  });
});

describe("token format", () => {
  it("Given an issued credential, When its token is parsed, Then both parts return", () => {
    const secret = newSecret();

    expect(parseToken(formatToken(CREDENTIAL_ID, secret))).toEqual({
      credentialId: CREDENTIAL_ID,
      secret,
    });
  });

  it("Given an unusable token, When it is parsed, Then nothing is returned", () => {
    for (const token of [
      "",
      "cak_",
      `cak_${CREDENTIAL_ID}`,
      `bad_${CREDENTIAL_ID}_${newSecret()}`,
      `cak_not-a-uuid_${newSecret()}`,
      `cak_${CREDENTIAL_ID}_short`,
      undefined,
    ]) {
      expect(parseToken(token)).toBeNull();
    }
  });

  it("Given an authorization header, When the scheme is Bearer, Then the token is taken", () => {
    expect(bearerToken("Bearer abc")).toBe("abc");
  });

  it("Given another scheme or no header, When read, Then nothing is taken", () => {
    for (const header of ["", "Basic abc", "Bearer", "bearer abc", null]) {
      expect(bearerToken(header)).toBeNull();
    }
  });
});
