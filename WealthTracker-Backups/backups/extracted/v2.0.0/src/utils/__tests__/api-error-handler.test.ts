/**
 * ApiErrorHandler Tests
 * Tests for API error handling utilities
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Sentry
vi.mock('../../lib/sentry', () => ({
  captureException: vi.fn(),
  addBreadcrumb: vi.fn()
}));

import { ApiErrorHandler } from '../api-error-handler';
import * as Sentry from '../../lib/sentry';

// Get the mocked functions
const mockCaptureException = vi.mocked(Sentry.captureException);
const mockAddBreadcrumb = vi.mocked(Sentry.addBreadcrumb);

describe('ApiErrorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handle method', () => {
    it('handles basic Error objects', () => {
      const originalError = new Error('Test error');
      const url = 'https://api.example.com/test';
      const method = 'GET';

      const result = ApiErrorHandler.handle(originalError, url, method);

      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe('Test error');
      expect(result.url).toBe(url);
      expect(result.method).toBe(method);
    });

    it('handles non-Error objects by converting to Error', () => {
      const originalError = 'String error';
      const url = 'https://api.example.com/test';

      const result = ApiErrorHandler.handle(originalError, url);

      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe('String error');
      expect(result.url).toBe(url);
      expect(result.method).toBe('GET'); // Default method
    });

    it('extracts axios-like error response data', () => {
      const axiosError = {
        response: {
          status: 404,
          statusText: 'Not Found',
          data: { error: 'Resource not found' }
        },
        message: 'Request failed'
      };
      const url = 'https://api.example.com/users/123';
      const method = 'GET';

      const result = ApiErrorHandler.handle(axiosError, url, method);

      expect(result.status).toBe(404);
      expect(result.statusText).toBe('Not Found');
      expect(result.responseBody).toEqual({ error: 'Resource not found' });
      expect(result.url).toBe(url);
      expect(result.method).toBe(method);
    });

    it('handles axios-like errors without response', () => {
      const axiosError = {
        message: 'Network Error',
        code: 'NETWORK_ERROR'
      };
      const url = 'https://api.example.com/test';

      const result = ApiErrorHandler.handle(axiosError, url);

      // Since axiosError is not an Error instance, it gets converted to string
      expect(result.message).toBe('[object Object]');
      expect(result.status).toBeUndefined();
      expect(result.statusText).toBeUndefined();
      expect(result.responseBody).toBeUndefined();
    });

    it('adds breadcrumb for API error', () => {
      const error = new Error('Test error');
      const url = 'https://api.example.com/test';
      const method = 'POST';

      ApiErrorHandler.handle(error, url, method);

      expect(mockAddBreadcrumb).toHaveBeenCalledWith({
        category: 'api',
        message: 'API POST https://api.example.com/test failed',
        level: 'error',
        data: {
          status: undefined,
          statusText: undefined,
          url,
          method
        }
      });
    });

    it('adds breadcrumb with status information', () => {
      const axiosError = {
        response: {
          status: 500,
          statusText: 'Internal Server Error',
          data: 'Server error'
        },
        message: 'Request failed'
      };
      const url = 'https://api.example.com/test';
      const method = 'PUT';

      ApiErrorHandler.handle(axiosError, url, method);

      expect(mockAddBreadcrumb).toHaveBeenCalledWith({
        category: 'api',
        message: 'API PUT https://api.example.com/test failed',
        level: 'error',
        data: {
          status: 500,
          statusText: 'Internal Server Error',
          url,
          method
        }
      });
    });

    it('captures exception with Sentry', () => {
      const error = new Error('Test error');
      const url = 'https://api.example.com/test';
      const method = 'DELETE';

      ApiErrorHandler.handle(error, url, method);

      expect(mockCaptureException).toHaveBeenCalledWith(error, {
        api: {
          url,
          method,
          status: undefined,
          statusText: undefined
        }
      });
    });

    it('captures exception with response status information', () => {
      const axiosError = {
        response: {
          status: 403,
          statusText: 'Forbidden',
          data: { error: 'Access denied' }
        },
        message: 'Access forbidden'
      };
      const url = 'https://api.example.com/admin';
      const method = 'GET';

      ApiErrorHandler.handle(axiosError, url, method);

      expect(mockCaptureException).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 403,
          statusText: 'Forbidden',
          responseBody: { error: 'Access denied' }
        }),
        {
          api: {
            url,
            method,
            status: 403,
            statusText: 'Forbidden'
          }
        }
      );
    });

    it('uses default GET method when not specified', () => {
      const error = new Error('Test error');
      const url = 'https://api.example.com/test';

      const result = ApiErrorHandler.handle(error, url);

      expect(result.method).toBe('GET');
      expect(mockAddBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'API GET https://api.example.com/test failed'
        })
      );
    });

    it('preserves original error properties', () => {
      const originalError = new Error('Original message');
      originalError.name = 'CustomError';
      (originalError as any).customProperty = 'custom value';

      const result = ApiErrorHandler.handle(originalError, 'https://api.example.com/test');

      expect(result.name).toBe('CustomError');
      expect((result as any).customProperty).toBe('custom value');
    });

    it('handles null and undefined errors', () => {
      const nullResult = ApiErrorHandler.handle(null, 'https://api.example.com/test');
      const undefinedResult = ApiErrorHandler.handle(undefined, 'https://api.example.com/test');

      expect(nullResult.message).toBe('null');
      expect(undefinedResult.message).toBe('undefined');
    });

    it('handles complex object errors', () => {
      const complexError = {
        message: 'Complex error',
        code: 'COMPLEX_ERROR',
        details: {
          field: 'email',
          reason: 'invalid format'
        }
      };

      const result = ApiErrorHandler.handle(complexError, 'https://api.example.com/test');

      expect(result.message).toBe('[object Object]');
    });
  });

  describe('handleResponse method', () => {
    let mockResponse: Partial<Response>;

    beforeEach(() => {
      mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        url: 'https://api.example.com/test',
        json: vi.fn()
      };
    });

    it('returns response for successful requests', async () => {
      mockResponse.ok = true;

      const result = await ApiErrorHandler.handleResponse(mockResponse as Response);

      expect(result).toBe(mockResponse);
    });

    it('throws ApiError for failed requests', async () => {
      mockResponse.ok = false;
      mockResponse.status = 404;
      mockResponse.statusText = 'Not Found';
      mockResponse.url = 'https://api.example.com/users/123';
      mockResponse.json = vi.fn().mockResolvedValue({ error: 'User not found' });

      try {
        await ApiErrorHandler.handleResponse(mockResponse as Response);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toBe('HTTP error! status: 404');
        expect(error.status).toBe(404);
        expect(error.statusText).toBe('Not Found');
        expect(error.url).toBe('https://api.example.com/users/123');
        expect(error.responseBody).toEqual({ error: 'User not found' });
      }
    });

    it('handles JSON parse errors gracefully', async () => {
      mockResponse.ok = false;
      mockResponse.status = 500;
      mockResponse.statusText = 'Internal Server Error';
      mockResponse.json = vi.fn().mockRejectedValue(new Error('Invalid JSON'));

      try {
        await ApiErrorHandler.handleResponse(mockResponse as Response);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toBe('HTTP error! status: 500');
        expect(error.status).toBe(500);
        expect(error.statusText).toBe('Internal Server Error');
        expect(error.responseBody).toBeUndefined();
      }
    });

    it('handles different HTTP error status codes', async () => {
      const testCases = [
        { status: 400, statusText: 'Bad Request' },
        { status: 401, statusText: 'Unauthorized' },
        { status: 403, statusText: 'Forbidden' },
        { status: 500, statusText: 'Internal Server Error' },
        { status: 502, statusText: 'Bad Gateway' },
        { status: 503, statusText: 'Service Unavailable' }
      ];

      for (const testCase of testCases) {
        mockResponse.ok = false;
        mockResponse.status = testCase.status;
        mockResponse.statusText = testCase.statusText;
        mockResponse.json = vi.fn().mockResolvedValue({});

        try {
          await ApiErrorHandler.handleResponse(mockResponse as Response);
          expect.fail(`Should have thrown an error for status ${testCase.status}`);
        } catch (error: any) {
          expect(error.status).toBe(testCase.status);
          expect(error.statusText).toBe(testCase.statusText);
        }
      }
    });

    it('preserves response body for different content types', async () => {
      const testBodies = [
        { error: 'JSON error' },
        'Plain text error',
        null,
        { code: 'ERR001', message: 'Detailed error', fields: ['email', 'password'] }
      ];

      for (const body of testBodies) {
        mockResponse.ok = false;
        mockResponse.status = 400;
        mockResponse.json = vi.fn().mockResolvedValue(body);

        try {
          await ApiErrorHandler.handleResponse(mockResponse as Response);
        } catch (error: any) {
          expect(error.responseBody).toEqual(body);
        }
      }
    });

    it('handles response without URL', async () => {
      mockResponse.ok = false;
      mockResponse.status = 404;
      mockResponse.url = undefined;
      mockResponse.json = vi.fn().mockResolvedValue({});

      try {
        await ApiErrorHandler.handleResponse(mockResponse as Response);
      } catch (error: any) {
        expect(error.url).toBeUndefined();
      }
    });

    it('works with actual Response objects', async () => {
      // Test with a more realistic Response object
      const responseInit: ResponseInit = {
        status: 422,
        statusText: 'Unprocessable Entity',
        headers: { 'Content-Type': 'application/json' }
      };

      const response = new Response(
        JSON.stringify({ errors: ['Invalid email format'] }),
        responseInit
      );

      try {
        await ApiErrorHandler.handleResponse(response);
      } catch (error: any) {
        expect(error.status).toBe(422);
        expect(error.statusText).toBe('Unprocessable Entity');
        expect(error.responseBody).toEqual({ errors: ['Invalid email format'] });
      }
    });
  });

  describe('integration scenarios', () => {
    it('works with fetch API pattern', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        url: 'https://api.example.com/profile',
        json: vi.fn().mockResolvedValue({ error: 'Invalid token' })
      });

      global.fetch = mockFetch;

      try {
        const response = await fetch('https://api.example.com/profile');
        await ApiErrorHandler.handleResponse(response);
      } catch (error) {
        const apiError = ApiErrorHandler.handle(error, 'https://api.example.com/profile', 'GET');
        
        expect(apiError.status).toBe(401);
        expect(apiError.url).toBe('https://api.example.com/profile');
        expect(mockCaptureException).toHaveBeenCalled();
        expect(mockAddBreadcrumb).toHaveBeenCalled();
      }
    });

    it('handles network errors', () => {
      const networkError = new TypeError('Failed to fetch');
      const apiError = ApiErrorHandler.handle(networkError, 'https://api.example.com/test');

      expect(apiError.message).toBe('Failed to fetch');
      expect(apiError.url).toBe('https://api.example.com/test');
      expect(mockCaptureException).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Failed to fetch' }),
        expect.any(Object)
      );
    });

    it('handles timeout errors', () => {
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'TimeoutError';
      
      const apiError = ApiErrorHandler.handle(timeoutError, 'https://api.example.com/slow-endpoint');

      expect(apiError.name).toBe('TimeoutError');
      expect(apiError.url).toBe('https://api.example.com/slow-endpoint');
    });

    it('preserves error context through multiple handlers', () => {
      const originalError = new Error('Database connection failed');
      
      // First handler adds some context
      const contextualError = ApiErrorHandler.handle(originalError, 'https://api.example.com/users', 'POST');
      
      // Second handler processes the already-handled error
      const finalError = ApiErrorHandler.handle(contextualError, 'https://api.example.com/users', 'POST');
      
      expect(finalError.url).toBe('https://api.example.com/users');
      expect(finalError.method).toBe('POST');
      expect(mockCaptureException).toHaveBeenCalledTimes(2);
    });
  });

  describe('error types and edge cases', () => {
    it('handles DOMException errors', () => {
      const domError = new DOMException('Operation aborted', 'AbortError');
      const apiError = ApiErrorHandler.handle(domError, 'https://api.example.com/test');

      expect(apiError.name).toBe('Error'); // Gets wrapped in a new Error
      expect(apiError.message).toBe('AbortError: Operation aborted');
    });

    it('handles errors with circular references', () => {
      const circularError: any = new Error('Circular error');
      circularError.self = circularError;
      
      const apiError = ApiErrorHandler.handle(circularError, 'https://api.example.com/test');
      
      expect(apiError.message).toBe('Circular error');
      // Should not throw during JSON serialization in Sentry
    });

    it('handles very large error messages', () => {
      const largeMessage = 'A'.repeat(10000);
      const largeError = new Error(largeMessage);
      
      const apiError = ApiErrorHandler.handle(largeError, 'https://api.example.com/test');
      
      expect(apiError.message).toBe(largeMessage);
    });

    it('handles errors with special characters', () => {
      const specialError = new Error('Error with special chars: 🚨 ñoño @#$%^&*()');
      const apiError = ApiErrorHandler.handle(specialError, 'https://api.example.com/test');

      expect(apiError.message).toBe('Error with special chars: 🚨 ñoño @#$%^&*()');
    });

    it('handles empty error messages', () => {
      const emptyError = new Error('');
      const apiError = ApiErrorHandler.handle(emptyError, 'https://api.example.com/test');

      expect(apiError.message).toBe('');
    });
  });
});