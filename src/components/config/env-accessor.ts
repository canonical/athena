type EnvAccessorOptions = {
  prefixes?: string[];
  allowEmpty?: boolean;
};

type EnvAccessor = {
  getEnv: (key: string, defaultValue?: string) => string;
  getNumber: (key: string, defaultValue?: number) => number;
  getBoolean: (key: string, defaultValue?: boolean | string) => boolean;
  getJson: <T>(key: string, defaultValue?: T | string) => T;
  getList: (key: string, separator?: string, defaultValue?: string[]) => string[];
};

const defaultPrefixes: string[] = [];

const buildCandidateKeys = (key: string, prefixes: string[]): string[] => {
  const normalizedKey = key.trim();
  const normalizedPrefixes = prefixes.map((prefix) => prefix.trim()).filter((prefix) => prefix.length > 0);
  const uniquePrefixes = Array.from(new Set(normalizedPrefixes));
  const baseKey = normalizedKey.length > 0 ? normalizedKey : key;
  const expanded = uniquePrefixes.map((prefix) => `${prefix}_${baseKey}`);

  return normalizedKey.length > 0 ? [...expanded, normalizedKey] : expanded;
};

const resolveEnvValue = (key: string, prefixes: string[], allowEmpty: boolean): string | undefined => {
  for (const candidateKey of buildCandidateKeys(key, prefixes)) {
    const candidate = process.env[candidateKey];

    if (candidate === undefined || candidate === null) {
      continue;
    }

    const normalizedCandidate = String(candidate).trim();

    if (allowEmpty || normalizedCandidate.length > 0) {
      return normalizedCandidate;
    }
  }

  return undefined;
};

const parseBoolean = (value: string): boolean | undefined => {
  const normalizedValue = value.trim().toLowerCase();

  if ([`1`, `true`, `yes`, `on`].includes(normalizedValue)) {
    return true;
  }

  if ([`0`, `false`, `no`, `off`].includes(normalizedValue)) {
    return false;
  }

  return undefined;
};

export const createEnvAccessor = (options: EnvAccessorOptions = {}): EnvAccessor => {
  const prefixes = options.prefixes ?? defaultPrefixes;
  const allowEmpty = options.allowEmpty ?? false;

  const getEnv = (key: string, defaultValue?: string): string => {
    const resolvedValue = resolveEnvValue(key, prefixes, allowEmpty);

    if (resolvedValue !== undefined) {
      return resolvedValue;
    }

    if (defaultValue !== undefined) {
      const normalizedDefaultValue = String(defaultValue).trim();

      if (allowEmpty || normalizedDefaultValue.length > 0) {
        return normalizedDefaultValue;
      }
    }

    throw new Error(`Missing environment variable: ${key}`);
  };

  const getNumber = (key: string, defaultValue?: number): number => {
    const value = getEnv(key, defaultValue === undefined ? undefined : String(defaultValue));
    const parsedValue = Number(value);

    if (Number.isNaN(parsedValue)) {
      throw new Error(`Environment variable is not a number: ${key}`);
    }

    return parsedValue;
  };

  const getBoolean = (key: string, defaultValue?: boolean | string): boolean => {
    let normalizedDefaultValue: string | undefined;

    if (defaultValue !== undefined) {
      normalizedDefaultValue = typeof defaultValue === `string` ? defaultValue : defaultValue ? `true` : `false`;
    }

    const value = getEnv(key, normalizedDefaultValue);
    const parsedValue = parseBoolean(value);

    if (parsedValue === undefined) {
      throw new Error(`Environment variable is not a boolean: ${key}`);
    }

    return parsedValue;
  };

  const getJson = <T>(key: string, defaultValue?: T | string): T => {
    let normalizedDefaultValue: string | undefined;

    if (defaultValue !== undefined) {
      if (typeof defaultValue === `string`) {
        normalizedDefaultValue = defaultValue;
      } else {
        try {
          normalizedDefaultValue = JSON.stringify(defaultValue);
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          throw new Error(`Failed to stringify fallback for ${key}. ${reason}`);
        }
      }
    }

    const value = getEnv(key, normalizedDefaultValue);

    try {
      return JSON.parse(value) as T;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`Environment variable is not valid JSON: ${key}. ${reason}`);
    }
  };

  const getList = (key: string, separator = `,`, defaultValue?: string[]): string[] => {
    const value = getEnv(key, defaultValue === undefined ? undefined : defaultValue.join(separator));

    return value
      .split(separator)
      .map((listValue) => listValue.trim())
      .filter((listValue) => listValue.length > 0);
  };

  return {
    getEnv,
    getNumber,
    getBoolean,
    getJson,
    getList,
  };
};
