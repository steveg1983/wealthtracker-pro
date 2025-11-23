/**
 * CSRF (Cross-Site Request Forgery) Protection
 * Implements token-based CSRF protection for the application
 */

import CryptoJS from 'crypto-js';

/**
 * CSRF Token Manager
 * Generates and validates CSRF tokens for forms and API requests
 */
class CSRFProtection {
  private tokenKey = 'wt_csrf_token';
  private tokenExpiry = 24 * 60 * 60 * 1000; // 24 hours
  private tokenHeader = 'X-CSRF-Token';
  private tokenField = '_csrf';

  /**
   * Generate a new CSRF token
   */
  generateToken(): string {
    const timestamp = Date.now();
    const randomData = CryptoJS.lib.WordArray.random(128/8);
    const token = CryptoJS.SHA256(`${timestamp}-${randomData}`).toString();
    
    // Store token with expiry
    const tokenData = {
      token,
      expiry: timestamp + this.tokenExpiry,
      timestamp
    };
    
    sessionStorage.setItem(this.tokenKey, JSON.stringify(tokenData));
    
    return token;
  }

  /**
   * Get current CSRF token, generate new one if expired
   */
  getToken(): string {
    const storedData = sessionStorage.getItem(this.tokenKey);
    
    if (!storedData) {
      return this.generateToken();
    }
    
    try {
      const tokenData = JSON.parse(storedData);
      
      // Check if token is expired
      if (Date.now() > tokenData.expiry) {
        return this.generateToken();
      }
      
      return tokenData.token;
    } catch {
      return this.generateToken();
    }
  }

  /**
   * Validate a CSRF token
   */
  validateToken(token: string): boolean {
    if (!token) return false;
    
    const storedData = sessionStorage.getItem(this.tokenKey);
    if (!storedData) return false;
    
    try {
      const tokenData = JSON.parse(storedData);
      
      // Check expiry
      if (Date.now() > tokenData.expiry) {
        return false;
      }
      
      // Constant-time comparison to prevent timing attacks
      return this.constantTimeCompare(token, tokenData.token);
    } catch {
      return false;
    }
  }

  /**
   * Constant-time string comparison to prevent timing attacks
   */
  private constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    
    return result === 0;
  }

  /**
   * Add CSRF token to request headers
   */
  addTokenToHeaders(headers: HeadersInit = {}): HeadersInit {
    const token = this.getToken();
    
    if (headers instanceof Headers) {
      headers.set(this.tokenHeader, token);
    } else if (Array.isArray(headers)) {
      headers.push([this.tokenHeader, token]);
    } else {
      (headers as Record<string, string>)[this.tokenHeader] = token;
    }
    
    return headers;
  }

  /**
   * Add CSRF token to form data
   */
  addTokenToFormData(formData: FormData): FormData {
    const token = this.getToken();
    formData.append(this.tokenField, token);
    return formData;
  }

  /**
   * Create a hidden input field with CSRF token
   */
  createTokenInput(): HTMLInputElement {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = this.tokenField;
    input.value = this.getToken();
    return input;
  }

  /**
   * React hook for CSRF protection
   */
  useCSRFToken() {
    const token = this.getToken();
    
    return {
      token,
      tokenHeader: this.tokenHeader,
      tokenField: this.tokenField,
      addToHeaders: this.addTokenToHeaders.bind(this),
      addToFormData: this.addTokenToFormData.bind(this),
      validate: this.validateToken.bind(this)
    };
  }

  /**
   * Middleware for fetch requests
   */
  fetchWithCSRF(url: RequestInfo | URL, options: RequestInit = {}): Promise<Response> {
    // Only add CSRF token for same-origin requests
    const requestUrl = typeof url === 'string' ? url : url.toString();
    const isSameOrigin = requestUrl.startsWith('/') || 
                        requestUrl.startsWith(window.location.origin);
    
    if (!isSameOrigin) {
      return fetch(url, options);
    }
    
    // Add CSRF token to headers for state-changing methods
    const method = options.method?.toUpperCase() || 'GET';
    const stateMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
    
    if (stateMethods.includes(method)) {
      options.headers = this.addTokenToHeaders(options.headers);
    }
    
    return fetch(url, options);
  }

  /**
   * Axios interceptor for CSRF protection
   */
  createAxiosInterceptor() {
    return {
      request: (config: {
        url?: string;
        method?: string;
        headers?: Record<string, unknown>;
      }) => {
        // Only add CSRF token for same-origin requests
        const isSameOrigin = !config.url || 
                           config.url.startsWith('/') || 
                           config.url.startsWith(window.location.origin);
        
        if (!isSameOrigin) {
          return config;
        }
        
        // Add CSRF token to headers for state-changing methods
        const method = config.method?.toUpperCase() || 'GET';
        const stateMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
        
        if (stateMethods.includes(method)) {
          config.headers = config.headers || {};
          config.headers[this.tokenHeader] = this.getToken();
        }
        
        return config;
      }
    };
  }

  /**
   * Express/Node.js middleware for validating CSRF tokens
   */
  expressMiddleware() {
    return (
      req: { method: string; headers: Record<string, unknown>; body?: Record<string, unknown> } & { session?: { userId?: string } },
      _res: unknown,
      next: () => void
    ) => {
      // Skip CSRF check for safe methods
      const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
      if (safeMethods.includes(req.method)) {
        return next();
      }
      
      // Get token from header or body
      const token = req.headers[this.tokenHeader.toLowerCase()] || 
                   req.body?.[this.tokenField];
      
      if (!this.validateToken(token)) {
        return res.status(403).json({
          error: 'Invalid CSRF token'
        });
      }
      
      next();
    };
  }

  /**
   * Clear CSRF token (e.g., on logout)
   */
  clearToken(): void {
    sessionStorage.removeItem(this.tokenKey);
  }
}

// Create singleton instance
export const csrfProtection = new CSRFProtection();

// Export convenience functions
export const getCSRFToken = () => csrfProtection.getToken();
export const validateCSRFToken = (token: string) => csrfProtection.validateToken(token);
export const fetchWithCSRF = csrfProtection.fetchWithCSRF.bind(csrfProtection);

// React hook
export const useCSRFToken = () => {
  const token = getCSRFToken();
  
  return {
    token,
    headers: { 'X-CSRF-Token': token },
    field: '_csrf',
    inputHTML: `<input type="hidden" name="_csrf" value="${token}" />`
  };
};

// Helper to add CSRF token to all forms automatically
export const setupCSRFForForms = () => {
  if (typeof document === 'undefined') return;
  
  document.addEventListener('submit', (e) => {
    const form = e.target as HTMLFormElement;
    
    // Skip if form already has CSRF token
    if (form.querySelector('input[name="_csrf"]')) return;
    
    // Skip for GET forms
    if (form.method.toUpperCase() === 'GET') return;
    
    // Add CSRF token
    const tokenInput = csrfProtection.createTokenInput();
    form.appendChild(tokenInput);
  });
};

// Double Submit Cookie Pattern as additional protection
export const setupDoubleSubmitCookie = () => {
  const token = getCSRFToken();
  
  // Set CSRF token as a cookie
  document.cookie = `csrf_token=${token}; path=/; SameSite=Strict`;
  
  // The server should verify that the cookie value matches the header/form value
};

export default csrfProtection;
