declare module 'express' {
  export type Request = any;
  export type Response = any;
  export type NextFunction = (...args: any[]) => void;
}

declare module 'express-serve-static-core' {
  export type Request = any;
  export type Response = any;
  export type NextFunction = (...args: any[]) => void;
}
