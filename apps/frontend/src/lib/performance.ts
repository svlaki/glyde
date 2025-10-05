// Performance monitoring utilities

interface PerformanceMetric {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
}

class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric> = new Map();

  // Start timing a performance metric
  start(name: string): void {
    this.metrics.set(name, {
      name,
      startTime: performance.now(),
    });
  }

  // End timing and log the result
  end(name: string): number | null {
    const metric = this.metrics.get(name);
    if (!metric) {
      console.warn(`Performance metric "${name}" not found`);
      return null;
    }

    const endTime = performance.now();
    const duration = endTime - metric.startTime;

    metric.endTime = endTime;
    metric.duration = duration;

    // Log slow operations (> 100ms)
    if (duration > 100) {
      console.warn(`Slow operation detected: ${name} took ${duration.toFixed(2)}ms`);
    } else {
      console.log(`Performance: ${name} took ${duration.toFixed(2)}ms`);
    }

    return duration;
  }

  // Get all metrics
  getMetrics(): PerformanceMetric[] {
    return Array.from(this.metrics.values());
  }

  // Clear all metrics
  clear(): void {
    this.metrics.clear();
  }
}

export const perfMonitor = new PerformanceMonitor();

// Higher-order function to measure performance
export function measurePerformance<T extends (...args: any[]) => any>(
  fn: T,
  name?: string
): T {
  return ((...args: Parameters<T>) => {
    const metricName = name || fn.name || 'anonymous';
    perfMonitor.start(metricName);
    
    try {
      const result = fn(...args);
      
      // Handle async functions
      if (result instanceof Promise) {
        return result.finally(() => {
          perfMonitor.end(metricName);
        });
      }
      
      perfMonitor.end(metricName);
      return result;
    } catch (error) {
      perfMonitor.end(metricName);
      throw error;
    }
  }) as T;
}

// React hook for measuring component render performance
export function usePerformanceMonitor(componentName: string) {
  const startTime = performance.now();
  
  return {
    endRender: () => {
      const duration = performance.now() - startTime;
      if (duration > 16) { // More than one frame (60fps)
        console.warn(`Slow render detected: ${componentName} took ${duration.toFixed(2)}ms`);
      }
    }
  };
}

// Debounce utility with performance tracking
export function debounceWithPerformance<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  name?: string
): T {
  let timeout: NodeJS.Timeout;
  
  return ((...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      const metricName = name || `debounced-${func.name}`;
      perfMonitor.start(metricName);
      
      try {
        const result = func(...args);
        perfMonitor.end(metricName);
        return result;
      } catch (error) {
        perfMonitor.end(metricName);
        throw error;
      }
    }, wait);
  }) as T;
}
