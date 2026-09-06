import requiredEnv from "../../config/required-env.json";

export interface AppEnv {
  readonly databaseUrl: string;
  readonly garage: {
    readonly endpoint: string;
    readonly region: string;
    readonly bucket: string;
    readonly accessKeyId: string;
    readonly secretAccessKey: string;
  };
  /** The agent this instance hands goals to. */
  readonly hermes: {
    readonly url: string;
    readonly apiKey: string;
  };
}

export class MissingEnvError extends Error {
  readonly missing: readonly string[];

  constructor(missing: readonly string[]) {
    super(
      `Missing required environment ${missing.length === 1 ? "variable" : "variables"}: ${missing.join(", ")}`,
    );
    this.name = "MissingEnvError";
    this.missing = missing;
  }
}

export function findMissing(
  source: Record<string, string | undefined>,
  names: readonly string[] = requiredEnv.app,
): string[] {
  return names.filter((name) => (source[name] ?? "").trim() === "");
}

export function readAppEnv(
  source: Record<string, string | undefined> = process.env,
): AppEnv {
  const missing = findMissing(source);
  if (missing.length > 0) {
    throw new MissingEnvError(missing);
  }

  const read = (name: string): string => {
    const value = source[name];
    if (value === undefined) {
      throw new MissingEnvError([name]);
    }
    return value;
  };

  return {
    databaseUrl: read("CALLIOPA_DATABASE_URL"),
    garage: {
      endpoint: read("CALLIOPA_GARAGE_ENDPOINT"),
      region: read("CALLIOPA_GARAGE_REGION"),
      bucket: read("CALLIOPA_GARAGE_BUCKET"),
      accessKeyId: read("CALLIOPA_GARAGE_ACCESS_KEY_ID"),
      secretAccessKey: read("CALLIOPA_GARAGE_SECRET_ACCESS_KEY"),
    },
    hermes: {
      url: read("CALLIOPA_HERMES_URL"),
      apiKey: read("CALLIOPA_HERMES_API_KEY"),
    },
  };
}

let cached: AppEnv | undefined;

export function appEnv(): AppEnv {
  cached ??= readAppEnv();
  return cached;
}
