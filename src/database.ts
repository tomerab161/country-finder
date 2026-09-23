import { MongoClient } from 'mongodb';
import { MongoCountryRepository, type CountryDocument } from './countries.js';

export async function connectCountryRepository(): Promise<{
  repository: MongoCountryRepository;
  close: () => Promise<void>;
}> {
  const client = new MongoClient(process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017');
  await client.connect();

  const database = client.db(process.env.MONGODB_DATABASE ?? 'country-finder');
  const collection = database.collection<CountryDocument>(
    process.env.MONGODB_COUNTRIES_COLLECTION ?? 'countries',
  );

  return {
    repository: new MongoCountryRepository(collection),
    close: () => client.close(),
  };
}