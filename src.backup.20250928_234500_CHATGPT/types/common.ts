// Common type definitions to replace any usage

// For unknown objects from external sources
export type UnknownObject = Record<string, unknown>;

// For JSON-parseable data
export type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
export type JsonObject = { [key: string]: JsonValue };
export type JsonArray = JsonValue[];

// For form/input events
export type InputChangeEvent = React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>;
export type FormSubmitEvent = React.FormEvent<HTMLFormElement>;

// For API responses
export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  message?: string;
}

// For storage operations
export type StorageValue = JsonValue | undefined;

// For financial calculations
export type NumericValue = number | string | { toString(): string };

// For DOM elements
export type AnyElement = HTMLElement | SVGElement;

// For event handlers
export type EventHandler<T = Event> = (event: T) => void;
export type AsyncEventHandler<T = Event> = (event: T) => Promise<void>;

// For Redux actions
export interface Action<T = string, P = unknown> {
  type: T;
  payload?: P;
}

// For error handling
export interface AppError {
  code?: string;
  message: string;
  details?: unknown;
}

// Type guards
export function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isJsonArray(value: unknown): value is JsonArray {
  return Array.isArray(value);
}

export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

export function hasProperty<K extends string>(
  obj: unknown,
  key: K
): obj is Record<K, unknown> {
  return typeof obj === 'object' && obj !== null && key in obj;
}