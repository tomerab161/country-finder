import Fastify from 'fastify';
import type { ZodTypeAny } from 'zod/v3';
import type { CountryRepository } from './countries.js';
import { intersectionRequestSchema } from './schemas.js';

export function buildApp(repository: CountryRepository) {
  const app = Fastify({ logger: true });
  app.setValidatorCompiler(({ schema }) => (data) => {
    const result = (schema as ZodTypeAny).safeParse(data);
    return result.success ? { value: result.data } : { error: result.error };
  });

  app.post('/countries/intersections', {
    schema: {
      body: intersectionRequestSchema,
      response: {
        200: {
          type: 'array',
          items: { type: 'string' },
        },
      },
    },
  }, async (request) => repository.findIntersectingCountryCodes(
    intersectionRequestSchema.parse(request.body).geometry,
  ));

  return app;
}
