/**
 * Core type definitions for batch operations
 * World-class TypeScript with zero compromises
 */

/**
 * Base operation data that all batch operations must extend
 */
export interface BaseOperationData {
  timestamp?: number;
  userId?: string;
  source?: 'manual' | 'automated' | 'bulk';
}

/**
 * Specific operation data types for type safety
 */
export interface CategorizeOperationData extends BaseOperationData {
  categoryId: string;
  subcategoryId?: string;
  rules?: {
    applyToFuture?: boolean;
    createRule?: boolean;
  };
}

export interface TagOperationData extends BaseOperationData {
  tags: string[];
  mode: 'add' | 'replace' | 'remove';
}

export interface DeleteOperationData extends BaseOperationData {
  confirmationToken?: string;
  softDelete?: boolean;
}

export interface ExportOperationData extends BaseOperationData {
  format: 'csv' | 'json' | 'excel' | 'pdf';
  includeAttachments?: boolean;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

export interface MergeOperationData extends BaseOperationData {
  targetTransactionId: string;
  mergeStrategy: 'sum' | 'replace' | 'average';
}

export interface DuplicateOperationData extends BaseOperationData {
  count?: number;
  offsetDays?: number;
}

export interface ApproveOperationData extends BaseOperationData {
  approvalLevel?: 'reviewed' | 'approved' | 'reconciled';
  notes?: string;
}

/**
 * Union type of all possible operation data types
 * This ensures type safety across all batch operations
 */
export type OperationData =
  | CategorizeOperationData
  | TagOperationData
  | DeleteOperationData
  | ExportOperationData
  | MergeOperationData
  | DuplicateOperationData
  | ApproveOperationData
  | BaseOperationData;

/**
 * Type guard functions for runtime type checking
 */
export const isCategorizeOperation = (data: OperationData): data is CategorizeOperationData => {
  return 'categoryId' in data;
};

export const isTagOperation = (data: OperationData): data is TagOperationData => {
  return 'tags' in data && Array.isArray(data.tags);
};

export const isDeleteOperation = (data: OperationData): data is DeleteOperationData => {
  return 'softDelete' in data || 'confirmationToken' in data;
};

export const isExportOperation = (data: OperationData): data is ExportOperationData => {
  return 'format' in data;
};

/**
 * Generic batch operation handler type with proper type constraints
 */
export type BatchOperationHandler<T extends OperationData = OperationData> = (
  operation: BatchOperation,
  data?: T
) => void | Promise<void>;

/**
 * Batch operation definition with strict typing
 */
export interface BatchOperation {
  id: string;
  label: string;
  icon?: string;
  variant?: 'primary' | 'secondary' | 'danger';
  requiresConfirmation?: boolean;
  minimumSelection?: number;
  maximumSelection?: number;
  dataType?: keyof typeof OperationDataTypeMap;
}

/**
 * Map operation IDs to their specific data types for compile-time safety
 */
export const OperationDataTypeMap = {
  categorize: {} as CategorizeOperationData,
  tag: {} as TagOperationData,
  delete: {} as DeleteOperationData,
  export: {} as ExportOperationData,
  merge: {} as MergeOperationData,
  duplicate: {} as DuplicateOperationData,
  approve: {} as ApproveOperationData,
} as const;

/**
 * Helper type to extract data type from operation ID
 */
export type OperationDataType<K extends keyof typeof OperationDataTypeMap> = 
  typeof OperationDataTypeMap[K];

/**
 * Strongly typed operation handler that ensures data matches operation type
 */
export type TypedOperationHandler = <K extends keyof typeof OperationDataTypeMap>(
  operation: BatchOperation & { id: K },
  data?: OperationDataType<K>
) => void | Promise<void>;