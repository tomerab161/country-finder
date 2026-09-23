import { buildApp } from './app.js';
import { connectCountryRepository } from './database.js';

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';

try {
  const { repository, close } = await connectCountryRepository();
  const app = buildApp(repository);
  app.addHook('onClose', close);
  await app.listen({ port, host });
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
