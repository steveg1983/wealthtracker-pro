import { captureException, addBreadcrumb } from '../lib/sentry';

export interface ApiError extends Error {
  status?: number;
  statusText?: string;
  url?: string;
  method?: string;
  responseBody?: unknown;
}

export class ApiErrorHandler {
  static handle(error: unknown, url: string, method: string = 'GET'): ApiError {
    const apiError: ApiError = error instanceof Error ? error : new Error(String(error));
    
    // Add additional context
    apiError.url = url;
    apiError.method = method;
    
    // Type guard for axios-like errors
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as any; // or create a proper type
      if (axiosError.response) {
        apiError.status = axiosError.response.status;
        apiError.statusText = axiosError.response.statusText;
        apiError.responseBody = axiosError.response.data;
      }
    }
    
    // Add breadcrumb for API error
    addBreadcrumb({
      category: 'api',
      message: `API ${method} ${url} failed`,
      level: 'error',
      data: {
        status: apiError.status,
        statusText: apiError.statusText,
        url,
        method,
      },
    });
    
    // Capture the exception
    captureException(apiError, {
      api: {
        url,
        method,
        status: apiError.status,
        statusText: apiError.statusText,
      },
    });
    
    return apiError;
  }
  
  static async handleResponse(response: Response): Promise<Response> {
    if (!response.ok) {
      const error: ApiError = new Error(`HTTP error! status: ${response.status}`);
      error.status = response.status;
      error.statusText = response.statusText;
      error.url = response.url;
      
      try {
        error.responseBody = await response.json();
      } catch {
        // Ignore JSON parse errors
      }
      
      throw error;
    }
    
    return response;
  }
}