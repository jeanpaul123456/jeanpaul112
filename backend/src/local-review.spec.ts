import { localReview } from './local-review.js';
const departments = [{ slug: 'it', name: 'IT' }];
const draft = {
  title: 'Laptop will not start',
  description: 'My laptop does not start and I need help accessing my work.',
  departmentSlug: 'it',
  priority: 'High',
};
it('allows a complete request without changing its selected priority or department', () => {
  const review = localReview(draft, departments);
  expect(review.concerns).toEqual([]);
  expect(review.suggestedPriority).toBe('High');
  expect(review.source).toBe('local');
});
it('rejects short placeholder requests', () => {
  expect(
    localReview({ ...draft, title: 'asdf', description: 'asdf' }, departments)
      .concerns.length,
  ).toBeGreaterThan(0);
});
it('supports descriptive Arabic text without requiring English keywords', () => {
  expect(
    localReview(
      {
        ...draft,
        title: 'مشكلة في الكمبيوتر',
        description:
          'جهاز الكمبيوتر لا يعمل وأحتاج إلى المساعدة لإكمال عملي اليوم',
      },
      departments,
    ).concerns,
  ).toEqual([]);
});
