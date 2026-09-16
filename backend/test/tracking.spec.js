import { describe, it, expect } from 'vitest';
import { progressSteps, nextStepText } from '../../frontend/src/tracking.js';

const requestAt = (status, statuses) => ({
  status,
  department: { name: 'IT' },
  history: statuses.map((status) => ({
    status,
    occurredAt: '2026-09-16T10:00:00Z',
    changedBy: { displayName: 'Staff' },
  })),
});
describe('Request progress', () => {
  it('shows submitted as current without implying staff have accepted it', () => {
    const steps = progressSteps(requestAt('Submitted', ['Submitted']));
    expect(steps.map((step) => step.state)).toEqual([
      'current',
      'pending',
      'pending',
      'pending',
    ]);
    expect(steps[1].event).toBeUndefined();
  });
  it('uses actual recorded dates and people for each reached stage', () => {
    const steps = progressSteps(
      requestAt('In Progress', ['Submitted', 'Assigned', 'In Progress']),
    );
    expect(steps.map((step) => step.state)).toEqual([
      'done',
      'done',
      'current',
      'pending',
    ]);
    expect(steps[1].event.changedBy.displayName).toBe('Staff');
    expect(steps[1].event.occurredAt).toBe('2026-09-16T10:00:00Z');
  });
  it('does not mark unreached steps completed after rejection', () => {
    expect(
      progressSteps(requestAt('Rejected', ['Submitted', 'Rejected'])).map(
        (step) => step.state,
      ),
    ).toEqual(['done', 'stopped', 'stopped', 'stopped']);
    expect(nextStepText(requestAt('Rejected', []))).toContain('rejected');
  });
  it('shows all reached stages after completion', () => {
    expect(
      progressSteps(
        requestAt('Completed', [
          'Submitted',
          'Assigned',
          'In Progress',
          'Completed',
        ]),
      ).map((step) => step.state),
    ).toEqual(['done', 'done', 'done', 'current']);
  });
});
