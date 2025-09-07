import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";

export function validateRequired(params: Record<string, any>, requiredFields: string[]): void {
  const missingFields = requiredFields.filter(field => !params[field]);
  
  if (missingFields.length > 0) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Missing required parameters: ${missingFields.join(', ')}`
    );
  }
}

export function validateEnum<T extends string>(
  value: string | undefined, 
  validValues: readonly T[], 
  fieldName: string
): T | undefined {
  if (!value) return undefined;
  
  if (!validValues.includes(value as T)) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Invalid ${fieldName}: ${value}. Valid values are: ${validValues.join(', ')}`
    );
  }
  
  return value as T;
}

export function sanitizeLimit(limit?: number, max = 200): number {
  if (!limit) return 100;
  return Math.min(Math.max(1, Number(limit)), max);
}

export function buildFilterParams(filter: Record<string, any> = {}): Record<string, string> {
  const params: Record<string, string> = {};
  
  Object.entries(filter).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        params[`filter[${key}]`] = value.join(',');
      } else {
        params[`filter[${key}]`] = String(value);
      }
    }
  });
  
  return params;
}

export function buildFieldParams(fields: Record<string, string[]> = {}): Record<string, string> {
  const params: Record<string, string> = {};
  
  Object.entries(fields).forEach(([key, value]) => {
    if (Array.isArray(value) && value.length > 0) {
      params[`fields[${key}]`] = value.join(',');
    }
  });
  
  return params;
}