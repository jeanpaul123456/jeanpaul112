import { AiController } from './ai.controller.js';
import { PrismaService } from './database/prisma.service.js';

const draft = {
  title: 'Laptop issue',
  description: 'Screen stays black.',
  departmentSlug: 'it',
  priority: 'Medium',
};
const suggestion = {
  improvedTitle: 'Laptop screen stays black',
  improvedDescription: 'My laptop screen stays black. Please help.',
  suggestedDepartmentSlug: 'it',
  suggestedPriority: 'Medium',
  explanation: 'IT handles device issues.',
  concerns: ['When did this begin?'],
};
const db = {
  employee: { findUnique: vi.fn(async () => ({ id: 'employee' })) },
  department: { findMany: vi.fn(async () => [{ slug: 'it', name: 'IT' }]) },
};
const controller = new AiController(db as unknown as PrismaService);
function provider(value = suggestion) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      json: async () => ({
        status: 'completed',
        output: [
          {
            type: 'message',
            content: [{ type: 'output_text', text: JSON.stringify(value) }],
          },
        ],
      }),
    })),
  );
}
beforeEach(() => {
  vi.stubEnv('REQUEST_REVIEW_MODE', 'openai');
  vi.stubEnv('OPENAI_API_KEY', 'test-key');
  provider();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it('requires an employee before sending any content to AI', async () => {
  await expect(controller.review(undefined, draft)).rejects.toThrow(
    'Choose a valid employee',
  );
  expect(fetch).not.toHaveBeenCalled();
});
it('rejects invalid drafts before provider use', async () => {
  await expect(
    controller.review('employee', { ...draft, description: '' }),
  ).rejects.toThrow('Enter a title');
  expect(fetch).not.toHaveBeenCalled();
});
it('returns validated suggestions and sends only the draft and department catalog', async () => {
  expect(
    await controller.review('employee', {
      ...draft,
      email: 'private@example.com',
    }),
  ).toEqual(suggestion);
  const body = JSON.parse(
    (vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string,
  );
  expect(body.store).toBe(false);
  expect(body.input).not.toContain('private@example.com');
  expect(body.text.format.strict).toBe(true);
});
it('rejects invented departments from model output', async () => {
  provider({ ...suggestion, suggestedDepartmentSlug: 'unknown' });
  await expect(controller.review('employee', draft)).rejects.toThrow(
    'AI could not review',
  );
});
it('handles missing configuration without calling the provider', async () => {
  vi.stubEnv('OPENAI_API_KEY', '');
  await expect(controller.review('employee', draft)).rejects.toThrow(
    'not configured',
  );
  expect(fetch).not.toHaveBeenCalled();
});
it('handles provider failure without exposing secrets', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      throw new Error('secret-provider-details');
    }),
  );
  await expect(controller.review('employee', draft)).rejects.toThrow(
    'Your draft is unchanged',
  );
});

it('reviews through Gemini without sending identity or using OpenAI', async () => {
  vi.stubEnv('REQUEST_REVIEW_MODE', 'gemini');
  vi.stubEnv('GEMINI_API_KEY', 'gemini-test');
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            finishReason: 'STOP',
            content: { parts: [{ text: JSON.stringify(suggestion) }] },
          },
        ],
      }),
    })),
  );
  expect(
    await controller.review('employee', {
      ...draft,
      email: 'private@example.com',
    }),
  ).toEqual(suggestion);
  const [url, options] = vi.mocked(fetch).mock.calls[0];
  expect(url).toContain('generativelanguage.googleapis.com');
  expect(JSON.stringify(options)).not.toContain('private@example.com');
});
it('keeps the draft on Gemini quota exhaustion', async () => {
  vi.stubEnv('REQUEST_REVIEW_MODE', 'gemini');
  vi.stubEnv('GEMINI_API_KEY', 'gemini-test');
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: false, status: 429 })),
  );
  await expect(controller.review('employee', draft)).rejects.toThrow('quota');
});
it('requires a Gemini key instead of falling back to a paid provider', async () => {
  vi.stubEnv('REQUEST_REVIEW_MODE', 'gemini');
  vi.stubEnv('GEMINI_API_KEY', '');
  await expect(controller.review('employee', draft)).rejects.toThrow(
    'GEMINI_API_KEY',
  );
  expect(fetch).not.toHaveBeenCalled();
});
it('rejects malformed Gemini output', async () => {
  vi.stubEnv('REQUEST_REVIEW_MODE', 'gemini');
  vi.stubEnv('GEMINI_API_KEY', 'gemini-test');
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          { finishReason: 'STOP', content: { parts: [{ text: '{}' }] } },
        ],
      }),
    })),
  );
  await expect(controller.review('employee', draft)).rejects.toThrow(
    'could not review',
  );
});

it('reports a Gemini timeout distinctly and never persists a request', async () => {
  vi.stubEnv('REQUEST_REVIEW_MODE', 'gemini');
  vi.stubEnv('GEMINI_API_KEY', 'gemini-test');
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      throw new DOMException('Timed out', 'TimeoutError');
    }),
  );
  try {
    await controller.submit('employee', draft);
    throw new Error('Expected timeout');
  } catch (error: any) {
    expect(error.getStatus()).toBe(504);
    expect(error.message).toContain('60 seconds');
  }
});

it('uses a bounded minimal-thinking request for the supported Flash-Lite model', async () => {
  vi.stubEnv('REQUEST_REVIEW_MODE', 'gemini');
  vi.stubEnv('GEMINI_API_KEY', 'test');
  vi.stubEnv('GEMINI_MODEL', 'gemini-3.5-flash-lite');
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            finishReason: 'STOP',
            content: { parts: [{ text: JSON.stringify(suggestion) }] },
          },
        ],
      }),
    })),
  );
  await controller.review('employee', draft);
  const payload = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
  expect(payload.generationConfig.thinkingConfig.thinkingLevel).toBe('minimal');
  expect(payload.generationConfig.maxOutputTokens).toBe(4096);
});
it('never accepts a truncated response even when its partial JSON looks valid', async () => {
  vi.stubEnv('REQUEST_REVIEW_MODE', 'gemini');
  vi.stubEnv('GEMINI_API_KEY', 'test');
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            finishReason: 'MAX_TOKENS',
            content: {
              parts: [
                { text: JSON.stringify({ ...suggestion, concerns: [] }) },
              ],
            },
          },
        ],
      }),
    })),
  );
  await expect(controller.submit('employee', draft)).rejects.toThrow(
    'output limit',
  );
});
