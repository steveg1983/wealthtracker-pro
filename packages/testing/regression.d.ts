declare module 'regression' {
  export type RegressionKind = 'linear' | 'exponential' | 'logarithmic' | 'power' | 'polynomial';

  export interface RegressionPoint {
    0: number;
    1: number;
  }

  export type RegressionDataPoint = [number, number];

  export interface RegressionResult {
    readonly equation: number[];
    readonly string: string;
    readonly r2: number;
    readonly points: RegressionDataPoint[];
    predict(value: number): RegressionDataPoint;
  }

  export interface RegressionOptions {
    order?: number;
    precision?: number;
  }

  export function linear(data: RegressionDataPoint[], options?: RegressionOptions): RegressionResult;
  export function exponential(data: RegressionDataPoint[], options?: RegressionOptions): RegressionResult;
  export function logarithmic(data: RegressionDataPoint[], options?: RegressionOptions): RegressionResult;
  export function power(data: RegressionDataPoint[], options?: RegressionOptions): RegressionResult;
  export function polynomial(data: RegressionDataPoint[], options?: RegressionOptions): RegressionResult;

  const regression: {
    linear: typeof linear;
    exponential: typeof exponential;
    logarithmic: typeof logarithmic;
    power: typeof power;
    polynomial: typeof polynomial;
  };

  export default regression;
}
