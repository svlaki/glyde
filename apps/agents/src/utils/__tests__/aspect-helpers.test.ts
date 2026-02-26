import {
  validateAspectInput,
  validateUserId,
  validateAspectId,
} from '../../utils/aspect-helpers.js';

// ---------------------------------------------------------------------------
// validateAspectInput
// ---------------------------------------------------------------------------

describe('validateAspectInput', () => {
  it('does not throw when name and color are valid', () => {
    expect(() =>
      validateAspectInput({ name: 'Work', color: '#3b82f6' })
    ).not.toThrow();
  });

  it('does not throw when only name is provided and is valid', () => {
    expect(() => validateAspectInput({ name: 'Health' })).not.toThrow();
  });

  it('does not throw when only color is provided and is valid', () => {
    expect(() => validateAspectInput({ color: '#ff0000' })).not.toThrow();
  });

  it('does not throw when both fields are omitted', () => {
    expect(() => validateAspectInput({})).not.toThrow();
  });

  it('throws when name is an empty string', () => {
    expect(() => validateAspectInput({ name: '' })).toThrow(
      'Aspect name cannot be empty'
    );
  });

  it('throws when name is only whitespace', () => {
    expect(() => validateAspectInput({ name: '   ' })).toThrow(
      'Aspect name cannot be empty'
    );
  });

  it('throws when color is not a valid hex color', () => {
    expect(() => validateAspectInput({ color: 'red' })).toThrow(
      'Valid hex color required'
    );
  });

  it('throws when color is a 3-char hex (only 6-char hex allowed)', () => {
    expect(() => validateAspectInput({ color: '#f00' })).toThrow(
      'Valid hex color required'
    );
  });

  it('throws when color is missing the # prefix', () => {
    expect(() => validateAspectInput({ color: '3b82f6' })).toThrow(
      'Valid hex color required'
    );
  });

  it('throws when color has invalid hex characters', () => {
    expect(() => validateAspectInput({ color: '#zzzzzz' })).toThrow(
      'Valid hex color required'
    );
  });

  it('accepts uppercase hex letters', () => {
    expect(() => validateAspectInput({ color: '#AABB00' })).not.toThrow();
  });

  it('accepts mixed-case hex letters', () => {
    expect(() => validateAspectInput({ color: '#aAbBcC' })).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// validateUserId
// ---------------------------------------------------------------------------

describe('validateUserId', () => {
  it('does not throw for a valid string user ID', () => {
    expect(() => validateUserId('user-abc-123')).not.toThrow();
  });

  it('throws for an empty string', () => {
    expect(() => validateUserId('')).toThrow('Invalid user ID');
  });

  it('throws for a non-string value (number)', () => {
    expect(() => validateUserId(42 as unknown as string)).toThrow(
      'Invalid user ID'
    );
  });

  it('throws for null', () => {
    expect(() => validateUserId(null as unknown as string)).toThrow(
      'Invalid user ID'
    );
  });

  it('throws for undefined', () => {
    expect(() => validateUserId(undefined as unknown as string)).toThrow(
      'Invalid user ID'
    );
  });
});

// ---------------------------------------------------------------------------
// validateAspectId
// ---------------------------------------------------------------------------

describe('validateAspectId', () => {
  it('does not throw for a valid string aspect ID', () => {
    expect(() => validateAspectId('aspect-456')).not.toThrow();
  });

  it('throws for an empty string', () => {
    expect(() => validateAspectId('')).toThrow('Invalid aspect ID');
  });

  it('throws for a non-string value (number)', () => {
    expect(() => validateAspectId(123 as unknown as string)).toThrow(
      'Invalid aspect ID'
    );
  });

  it('throws for null', () => {
    expect(() => validateAspectId(null as unknown as string)).toThrow(
      'Invalid aspect ID'
    );
  });

  it('throws for undefined', () => {
    expect(() => validateAspectId(undefined as unknown as string)).toThrow(
      'Invalid aspect ID'
    );
  });
});
