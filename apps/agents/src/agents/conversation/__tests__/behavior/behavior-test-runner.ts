/**
 * Behavior Test Runner
 *
 * Executes behavior tests by:
 * 1. Wrapping tools to capture invocations
 * 2. Running prompts through the ConversationAgent
 * 3. Validating tool calls against expectations
 */

import type {
  BehaviorTestCase,
  ExpectedToolCall,
} from './test-cases.js';
import type {
  CapturedToolCall,
} from './behavior-test-utils.js';

// =============================================================================
// RESULT TYPES
// =============================================================================

export interface ToolCallValidationResult {
  passed: boolean;
  toolName: string;
  expected: ExpectedToolCall;
  actual?: CapturedToolCall;
  errors: string[];
}

export interface BehaviorTestResult {
  testCase: BehaviorTestCase;
  passed: boolean;
  duration: number;
  response: string;
  capturedCalls: CapturedToolCall[];
  validations: {
    expectedTools: ToolCallValidationResult[];
    forbiddenTools: { name: string; called: boolean; passed: boolean }[];
    responseContains: { text: string; found: boolean; passed: boolean }[];
    responseNotContains: { text: string; found: boolean; passed: boolean }[];
  };
  errors: string[];
}

// =============================================================================
// VALIDATION FUNCTIONS
// =============================================================================

/**
 * Validates that an expected tool was called with correct arguments
 */
export function validateToolCall(
  expected: ExpectedToolCall,
  capturedCalls: CapturedToolCall[]
): ToolCallValidationResult {
  const errors: string[] = [];

  // Find matching calls by name
  const matchingCalls = capturedCalls.filter(c => c.name === expected.name);

  if (matchingCalls.length === 0) {
    return {
      passed: false,
      toolName: expected.name,
      expected,
      errors: [`Tool '${expected.name}' was not called`],
    };
  }

  // If order is specified, check that specific call
  let callToValidate: CapturedToolCall | undefined;

  if (expected.order !== undefined) {
    // Find the call at the specified order position
    const callsAtOrder = capturedCalls.filter(c => c.order === expected.order);
    if (callsAtOrder.length === 0) {
      errors.push(
        `Tool '${expected.name}' was expected at order ${expected.order}, but no call was made at that position`
      );
    } else if (callsAtOrder[0].name !== expected.name) {
      errors.push(
        `Expected '${expected.name}' at order ${expected.order}, but '${callsAtOrder[0].name}' was called instead`
      );
    } else {
      callToValidate = callsAtOrder[0];
    }
  } else {
    // Use the first matching call
    callToValidate = matchingCalls[0];
  }

  if (!callToValidate) {
    return {
      passed: false,
      toolName: expected.name,
      expected,
      errors,
    };
  }

  // Validate exact args if specified
  if (expected.args) {
    for (const [key, expectedValue] of Object.entries(expected.args)) {
      const actualValue = callToValidate.args[key];

      if (expectedValue === undefined) {
        // Expect the key to be undefined or not present
        if (actualValue !== undefined) {
          errors.push(
            `Arg '${key}': expected undefined, got ${JSON.stringify(actualValue)}`
          );
        }
      } else if (actualValue === undefined) {
        errors.push(
          `Arg '${key}': expected ${JSON.stringify(expectedValue)}, but arg was not provided`
        );
      } else if (JSON.stringify(actualValue) !== JSON.stringify(expectedValue)) {
        errors.push(
          `Arg '${key}': expected ${JSON.stringify(expectedValue)}, got ${JSON.stringify(actualValue)}`
        );
      }
    }
  }

  // Validate arg matchers if specified
  if (expected.argMatchers) {
    for (const [key, matcher] of Object.entries(expected.argMatchers)) {
      const actualValue = callToValidate.args[key];

      try {
        if (!matcher(actualValue)) {
          errors.push(
            `Arg '${key}': value ${JSON.stringify(actualValue)} did not match custom validator`
          );
        }
      } catch (error) {
        errors.push(
          `Arg '${key}': matcher threw error: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }

  return {
    passed: errors.length === 0,
    toolName: expected.name,
    expected,
    actual: callToValidate,
    errors,
  };
}

/**
 * Validates that a forbidden tool was not called
 */
export function validateForbiddenTool(
  toolName: string,
  capturedCalls: CapturedToolCall[]
): { name: string; called: boolean; passed: boolean } {
  const wasCalled = capturedCalls.some(c => c.name === toolName);
  return {
    name: toolName,
    called: wasCalled,
    passed: !wasCalled,
  };
}

/**
 * Validates response contains expected text
 */
export function validateResponseContains(
  response: string,
  text: string
): { text: string; found: boolean; passed: boolean } {
  const found = response.toLowerCase().includes(text.toLowerCase());
  return {
    text,
    found,
    passed: found,
  };
}

/**
 * Validates response does not contain forbidden text
 */
export function validateResponseNotContains(
  response: string,
  text: string
): { text: string; found: boolean; passed: boolean } {
  const found = response.toLowerCase().includes(text.toLowerCase());
  return {
    text,
    found,
    passed: !found,
  };
}

// =============================================================================
// TEST EXECUTION
// =============================================================================

/**
 * Executes a single behavior test
 */
export async function runBehaviorTest(
  testCase: BehaviorTestCase,
  executePrompt: (prompt: string) => Promise<{ response: string; calls: CapturedToolCall[] }>
): Promise<BehaviorTestResult> {
  const startTime = Date.now();
  const errors: string[] = [];

  let response = '';
  let capturedCalls: CapturedToolCall[] = [];

  try {
    // Execute the prompt
    const result = await executePrompt(testCase.prompt);
    response = result.response;
    capturedCalls = result.calls;
  } catch (error) {
    errors.push(`Execution error: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Validate expected tools
  const expectedToolResults = testCase.expectedTools.map(expected =>
    validateToolCall(expected, capturedCalls)
  );

  // Check for extra tools if not allowed
  if (!testCase.allowExtraTools && testCase.expectedTools.length > 0) {
    const expectedToolNames = new Set(testCase.expectedTools.map(t => t.name));
    const extraCalls = capturedCalls.filter(c => !expectedToolNames.has(c.name));

    if (extraCalls.length > 0) {
      errors.push(
        `Extra tool calls not allowed: ${extraCalls.map(c => c.name).join(', ')}`
      );
    }
  }

  // Validate forbidden tools
  const forbiddenToolResults = (testCase.forbiddenTools || []).map(toolName =>
    validateForbiddenTool(toolName, capturedCalls)
  );

  // Validate response contains
  const responseContainsResults = (testCase.responseContains || []).map(text =>
    validateResponseContains(response, text)
  );

  // Validate response not contains
  const responseNotContainsResults = (testCase.responseNotContains || []).map(text =>
    validateResponseNotContains(response, text)
  );

  // Collect all errors
  for (const result of expectedToolResults) {
    if (!result.passed) {
      errors.push(...result.errors);
    }
  }

  for (const result of forbiddenToolResults) {
    if (!result.passed) {
      errors.push(`Forbidden tool '${result.name}' was called`);
    }
  }

  for (const result of responseContainsResults) {
    if (!result.passed) {
      errors.push(`Response should contain '${result.text}'`);
    }
  }

  for (const result of responseNotContainsResults) {
    if (!result.passed) {
      errors.push(`Response should NOT contain '${result.text}'`);
    }
  }

  const duration = Date.now() - startTime;

  return {
    testCase,
    passed: errors.length === 0,
    duration,
    response,
    capturedCalls,
    validations: {
      expectedTools: expectedToolResults,
      forbiddenTools: forbiddenToolResults,
      responseContains: responseContainsResults,
      responseNotContains: responseNotContainsResults,
    },
    errors,
  };
}

// =============================================================================
// RESULT FORMATTING
// =============================================================================

/**
 * Formats a test result for display
 */
export function formatTestResult(result: BehaviorTestResult): string {
  const lines: string[] = [];

  const status = result.passed ? 'PASS' : 'FAIL';
  lines.push(`${status} [${result.testCase.id}] ${result.testCase.name} (${result.duration}ms)`);

  if (result.capturedCalls.length > 0) {
    lines.push('  Tool calls:');
    for (const call of result.capturedCalls) {
      const argsPreview = JSON.stringify(call.args).slice(0, 80);
      lines.push(`    ${call.order + 1}. ${call.name}(${argsPreview}${argsPreview.length >= 80 ? '...' : ''})`);
    }
  } else {
    lines.push('  No tool calls made');
  }

  if (!result.passed) {
    lines.push('  Errors:');
    for (const error of result.errors) {
      lines.push(`    - ${error}`);
    }
  }

  return lines.join('\n');
}

/**
 * Formats multiple test results as a summary
 */
export function formatTestSummary(results: BehaviorTestResult[]): string {
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  const lines: string[] = [
    '',
    '='.repeat(60),
    `TEST SUMMARY: ${passed} passed, ${failed} failed (${totalDuration}ms)`,
    '='.repeat(60),
  ];

  // Group by category
  const byCategory = new Map<string, BehaviorTestResult[]>();
  for (const result of results) {
    const category = result.testCase.category;
    if (!byCategory.has(category)) {
      byCategory.set(category, []);
    }
    byCategory.get(category)!.push(result);
  }

  for (const [category, categoryResults] of byCategory) {
    const categoryPassed = categoryResults.filter(r => r.passed).length;
    const categoryTotal = categoryResults.length;
    lines.push(`\n${category}: ${categoryPassed}/${categoryTotal}`);

    for (const result of categoryResults) {
      const status = result.passed ? 'PASS' : 'FAIL';
      lines.push(`  [${status}] ${result.testCase.id}: ${result.testCase.name}`);
      if (!result.passed) {
        for (const error of result.errors.slice(0, 2)) {
          lines.push(`         ${error}`);
        }
        if (result.errors.length > 2) {
          lines.push(`         ... and ${result.errors.length - 2} more errors`);
        }
      }
    }
  }

  return lines.join('\n');
}

// =============================================================================
// TOOL WRAPPER
// =============================================================================

/**
 * Creates a wrapper for a tool that captures its invocations
 */
export function wrapToolForCapture(
  tool: any,
  tracker: {
    recordCall: (name: string, args: Record<string, any>, result?: any, error?: Error) => void;
  }
): any {
  // Get the original invoke function
  const originalInvoke = tool.invoke?.bind(tool) || tool.func?.bind(tool);

  if (!originalInvoke) {
    console.warn(`Tool ${tool.name} has no invoke or func method`);
    return tool;
  }

  // Create a wrapped version
  const wrappedInvoke = async (input: any, config?: any) => {
    const args = typeof input === 'object' ? input : { input };

    try {
      const result = await originalInvoke(input, config);
      tracker.recordCall(tool.name, args, result);
      return result;
    } catch (error) {
      tracker.recordCall(tool.name, args, undefined, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  };

  // Return a new tool-like object with the wrapped invoke
  return {
    ...tool,
    invoke: wrappedInvoke,
    func: wrappedInvoke,
  };
}

/**
 * Wraps all tools in a registry for capture
 */
export function wrapToolsForCapture(
  tools: any[],
  tracker: {
    recordCall: (name: string, args: Record<string, any>, result?: any, error?: Error) => void;
  }
): any[] {
  return tools.map(tool => wrapToolForCapture(tool, tracker));
}
