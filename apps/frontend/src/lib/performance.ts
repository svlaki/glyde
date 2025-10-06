// Performance monitoring utilities

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
