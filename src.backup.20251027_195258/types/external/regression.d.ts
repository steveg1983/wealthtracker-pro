declare module 'regression' {
  export type RegressionDataPoint = [number, number];

  export interface RegressionResult {
    equation: number[];
    string: string;
    r2: number;
    predict(x: number): [number, number];
  }

  export interface RegressionOptions {
    precision?: number;
    order?: number;
  }

  export interface RegressionStatic {
    linear(points: RegressionDataPoint[], options?: RegressionOptions): RegressionResult;
    exponential(points: RegressionDataPoint[], options?: RegressionOptions): RegressionResult;
    logarithmic(points: RegressionDataPoint[], options?: RegressionOptions): RegressionResult;
    power(points: RegressionDataPoint[], options?: RegressionOptions): RegressionResult;
    polynomial(points: RegressionDataPoint[], options: RegressionOptions & { order: number }): RegressionResult;
  }

  const regression: RegressionStatic;
  export default regression;
}
