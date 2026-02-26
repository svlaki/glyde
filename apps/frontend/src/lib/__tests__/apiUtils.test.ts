// Simple unit tests for API utilities
import { validateRequired, sanitizeString, formatErrorMessage, debounce } from '../apiUtils';

describe('API Utils', () => {
  describe('validateRequired', () => {
    it('should return null for valid data', () => {
      const data = { title: 'Test Goal', description: 'Test Description' };
      const result = validateRequired(data, ['title']);
      expect(result).toBeNull();
    });

    it('should return error for missing required field', () => {
      const data = { description: 'Test Description' };
      const result = validateRequired(data, ['title']);
      expect(result).toBe('title is required');
    });

    it('should return error for empty string', () => {
      const data = { title: '', description: 'Test Description' };
      const result = validateRequired(data, ['title']);
      expect(result).toBe('title is required');
    });

    it('should return error for whitespace-only string', () => {
      const data = { title: '   ', description: 'Test Description' };
      const result = validateRequired(data, ['title']);
      expect(result).toBe('title is required');
    });
  });

  describe('sanitizeString', () => {
    it('should remove HTML tags', () => {
      const input = '<script>alert("xss")</script>Hello';
      const result = sanitizeString(input);
      expect(result).toBe('scriptalert("xss")/scriptHello');
    });

    it('should trim whitespace', () => {
      const input = '  Hello World  ';
      const result = sanitizeString(input);
      expect(result).toBe('Hello World');
    });

    it('should limit string length', () => {
      const input = 'a'.repeat(2000);
      const result = sanitizeString(input, 100);
      expect(result).toHaveLength(100);
    });
  });

  describe('formatErrorMessage', () => {
    it('should return string as-is', () => {
      const result = formatErrorMessage('Simple error');
      expect(result).toBe('Simple error');
    });

    it('should extract message from Error object', () => {
      const error = new Error('Test error');
      const result = formatErrorMessage(error);
      expect(result).toBe('Test error');
    });

    it('should extract error from object', () => {
      const error = { error: 'Object error' };
      const result = formatErrorMessage(error);
      expect(result).toBe('Object error');
    });

    it('should return default message for unknown types', () => {
      const result = formatErrorMessage(null);
      expect(result).toBe('An unexpected error occurred');
    });
  });

  describe('debounce', () => {
    it('should delay function execution', () => {
      return new Promise<void>((resolve) => {
        let callCount = 0;
        const debouncedFn = debounce(() => {
          callCount++;
        }, 10);

        debouncedFn();
        debouncedFn();
        debouncedFn();

        setTimeout(() => {
          expect(callCount).toBe(1);
          resolve();
        }, 20);
      });
    });
  });
});
