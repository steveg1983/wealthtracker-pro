const formatKey = (key: string): string => key.trim();

export const getRequiredEnv = (key: string): string => {
  const normalized = formatKey(key);
  const value = process.env[normalized];
  if (!value) {
    throw new Error(`Missing required environment variable: ${normalized}`);
  }
  return value;
};

export const getOptionalEnv = (key: string): string | undefined => {
  const normalized = formatKey(key);
  return process.env[normalized];
};
