type Draft = {
  title: string;
  description: string;
  departmentSlug?: string;
  priority: string;
};
export function localReview(
  draft: Draft,
  departments: { slug: string; name: string }[],
) {
  const clean = (value: string) => value.trim().replace(/[\t ]+/g, ' ');
  const title = clean(draft.title);
  const description = clean(draft.description);
  const words = (value: string) => value.match(/[\p{L}\p{N}]+/gu) || [];
  const concerns: string[] = [];
  if (words(title).length < 2)
    concerns.push('Use a specific title with at least two words.');
  if (words(description).length < 6 || description.length < 25)
    concerns.push(
      'Describe the problem and the help you need in at least six words (25 characters).',
    );
  if (title.toLowerCase() === description.toLowerCase())
    concerns.push(
      'Add details to the description instead of repeating the title.',
    );
  if (
    /(.)\1{5,}/u.test(title + ' ' + description) ||
    /\b(?:asdf|qwerty|lorem ipsum)\b/i.test(title + ' ' + description)
  )
    concerns.push(
      'Replace placeholder or repeated text with the actual problem.',
    );
  const suggestedDepartmentSlug =
    draft.departmentSlug || departments[0]?.slug || '';
  if (!draft.departmentSlug)
    concerns.push('Choose the department that should handle this request.');
  return {
    improvedTitle: title,
    improvedDescription: description,
    suggestedDepartmentSlug,
    suggestedPriority: draft.priority,
    explanation:
      'Free local checks validate basic completeness and placeholder text. They do not understand meaning, verify facts, or detect every contradiction. The department reviews the actual issue.',
    concerns,
    source: 'local',
  };
}
