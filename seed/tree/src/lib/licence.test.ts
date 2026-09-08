import { describe, expect, it } from "vitest";

import { licenceWarning } from "./licence";

// The five marks, the grace and the lapse, in the CLI's words. BO_0209_005
describe("licence warning", () => {
  const expires = "2026-12-31T23:59:59Z";
  const daysBefore = (days: number): Date => new Date(Date.parse(expires) - days * 24 * 60 * 60 * 1000 - 1000);

  it("Given no licence, Then there is nothing to say", () => {
    expect(licenceWarning(undefined, new Date())).toBeNull();
    expect(licenceWarning("", new Date())).toBeNull();
    expect(licenceWarning("not a date", new Date())).toBeNull();
  });

  it("Given a licence, Then the marks warn and the days between them stay quiet", () => {
    for (const mark of [60, 30, 14, 7, 1]) {
      expect(licenceWarning(expires, daysBefore(mark))).toBe(`the licence expires in ${mark} days, on 2026-12-31`);
    }
    expect(licenceWarning(expires, daysBefore(45))).toBeNull();
    expect(licenceWarning(expires, daysBefore(2))).toBeNull();
    expect(licenceWarning(expires, daysBefore(200))).toBeNull();
  });

  it("Given an expired licence, Then the grace is counted down and the lapse named", () => {
    const after = (days: number): Date => new Date(Date.parse(expires) + days * 24 * 60 * 60 * 1000 + 1000);
    expect(licenceWarning(expires, after(0))).toBe(
      "the licence expired on 2026-12-31; in grace, 30 days left before every human other than the owner drops to staging",
    );
    expect(licenceWarning(expires, after(29))).toBe(
      "the licence expired on 2026-12-31; in grace, 1 days left before every human other than the owner drops to staging",
    );
    expect(licenceWarning(expires, after(31))).toBe(
      "the licence expired on 2026-12-31 and its grace has ended; every human other than the owner may stage but not establish",
    );
  });
});
