import { describe, it, expect } from 'vitest';
import { resolveSchemaType, coerceValueForSchema } from '../../src/lib/state.js';

describe('resolveSchemaType', () => {
  it('should resolve orchestration.phase.number as ZodString', () => {
    expect(resolveSchemaType('orchestration.phase.number')).toBe('ZodString');
  });

  it('should resolve orchestration.phase.name as ZodString', () => {
    expect(resolveSchemaType('orchestration.phase.name')).toBe('ZodString');
  });

  it('should resolve orchestration.phase.hasUserGate as ZodBoolean', () => {
    expect(resolveSchemaType('orchestration.phase.hasUserGate')).toBe('ZodBoolean');
  });

  it('should resolve orchestration.step.index as ZodNumber', () => {
    expect(resolveSchemaType('orchestration.step.index')).toBe('ZodNumber');
  });

  it('should resolve orchestration.analyze.iteration as ZodNumber', () => {
    expect(resolveSchemaType('orchestration.analyze.iteration')).toBe('ZodNumber');
  });

  it('should resolve orchestration.analyze.completedAt as ZodNumber', () => {
    expect(resolveSchemaType('orchestration.analyze.completedAt')).toBe('ZodNumber');
  });

  it('should resolve schema_version as ZodString', () => {
    expect(resolveSchemaType('schema_version')).toBe('ZodString');
  });

  it('should resolve nested record paths (memory.archive_reviews.*.reviewed_at)', () => {
    expect(resolveSchemaType('memory.archive_reviews.0082.reviewed_at')).toBe('ZodString');
  });

  it('should return null for unknown top-level paths', () => {
    expect(resolveSchemaType('nonexistent')).toBeNull();
  });

  it('should return null for unknown nested paths', () => {
    expect(resolveSchemaType('orchestration.phase.nonexistent')).toBeNull();
  });

  it('should return null for paths that go too deep', () => {
    expect(resolveSchemaType('orchestration.phase.number.extra')).toBeNull();
  });

  it('should resolve array types as ZodArray', () => {
    expect(resolveSchemaType('orchestration.phase.goals')).toBe('ZodArray');
  });
});

describe('coerceValueForSchema', () => {
  describe('number → string coercion', () => {
    it('should coerce number to string for orchestration.phase.number', () => {
      expect(coerceValueForSchema('orchestration.phase.number', 1015)).toBe('1015');
    });

    it('should coerce number to string for orchestration.phase.name', () => {
      expect(coerceValueForSchema('orchestration.phase.name', 42)).toBe('42');
    });

    it('should not coerce if already a string', () => {
      expect(coerceValueForSchema('orchestration.phase.number', '1015')).toBe('1015');
    });
  });

  describe('string → number coercion', () => {
    it('should coerce numeric string to number for orchestration.step.index', () => {
      expect(coerceValueForSchema('orchestration.step.index', '2')).toBe(2);
    });

    it('should coerce numeric string for orchestration.analyze.iteration', () => {
      expect(coerceValueForSchema('orchestration.analyze.iteration', '3')).toBe(3);
    });

    it('should not coerce non-numeric strings', () => {
      expect(coerceValueForSchema('orchestration.step.index', 'abc')).toBe('abc');
    });

    it('should not coerce if already a number', () => {
      expect(coerceValueForSchema('orchestration.step.index', 2)).toBe(2);
    });
  });

  describe('string → boolean coercion', () => {
    it('should coerce "true" to true for boolean fields', () => {
      expect(coerceValueForSchema('orchestration.phase.hasUserGate', 'true')).toBe(true);
    });

    it('should coerce "false" to false for boolean fields', () => {
      expect(coerceValueForSchema('orchestration.phase.hasUserGate', 'false')).toBe(false);
    });

    it('should not coerce non-boolean strings', () => {
      expect(coerceValueForSchema('orchestration.phase.hasUserGate', 'yes')).toBe('yes');
    });

    it('should not coerce if already a boolean', () => {
      expect(coerceValueForSchema('orchestration.phase.hasUserGate', true)).toBe(true);
    });
  });

  describe('unknown paths (no coercion)', () => {
    it('should pass through values for unknown paths', () => {
      expect(coerceValueForSchema('unknown.path', 42)).toBe(42);
      expect(coerceValueForSchema('unknown.path', 'hello')).toBe('hello');
    });
  });

  describe('complex types (no coercion)', () => {
    it('should pass through arrays unchanged', () => {
      const arr = ['goal1', 'goal2'];
      expect(coerceValueForSchema('orchestration.phase.goals', arr)).toBe(arr);
    });

    it('should pass through objects unchanged', () => {
      const obj = { tasks_completed: 0, tasks_total: 0, percentage: 0 };
      expect(coerceValueForSchema('orchestration.progress', obj)).toBe(obj);
    });

    it('should pass through null unchanged', () => {
      expect(coerceValueForSchema('orchestration.phase.number', null)).toBeNull();
    });
  });
});
