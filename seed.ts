import type { Feature, FeatureCollection, Geometry, Polygon, MultiPolygon } from 'geojson';
import rewind from '@turf/rewind';
import { MongoClient } from 'mongodb';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CountryDocument } from './src/countries.js';

const defaultSourceUrl = 'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson';
type CountryGeometry = Polygon | MultiPolygon;
type CountryProperties = Record<string, unknown>;
type CountryFeatureCollection = FeatureCollection<CountryGeometry, CountryProperties>;

function isCountryGeometry(geometry: Geometry | null): geometry is CountryGeometry {
  return geometry?.type === 'Polygon' || geometry?.type === 'MultiPolygon';
}

function normalizeGeometry(geometry: CountryGeometry): CountryGeometry {
  const normalized = rewind(
    { type: 'Feature', properties: {}, geometry },
    { reverse: true },
  ) as Feature<CountryGeometry>;
  return normalized.geometry as CountryGeometry;
}

export function countryDocumentsFromGeoJson(data: CountryFeatureCollection): CountryDocument[] {
  return data.features.flatMap((country) => {
    const stringProperty = (keys: string[]) => keys
      .map((key) => country.properties?.[key])
      .find((value): value is string => typeof value === 'string' && value.length > 0);
    const code = stringProperty([
      'ISO_A2',
      'ISO_A2_EH',
      'ISO3166-1-Alpha-2',
      'ISO_A3',
      'ISO_A3_EH',
      'ISO3166-1-Alpha-3',
      'ADM0_A3',
    ]);
    const name = stringProperty(['ADMIN', 'NAME_EN', 'NAME', 'name']);

    if (!isCountryGeometry(country.geometry) || !code || code === '-99' || !name) {
      return [];
    }

    return [{
      countryCode: code.toUpperCase(),
      countryName: name,
      area: normalizeGeometry(country.geometry),
    }];
  });
}

async function loadCountryData(url: string): Promise<CountryFeatureCollection> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Unable to download country data: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<CountryFeatureCollection>;
}

async function seed() {
  const client = new MongoClient(process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017');
  const databaseName = process.env.MONGODB_DATABASE ?? 'country-finder';
  const collectionName = process.env.MONGODB_COUNTRIES_COLLECTION ?? 'countries';
  const sourceUrl = process.env.COUNTRIES_GEOJSON_URL ?? defaultSourceUrl;

  try {
    await client.connect();
    const collection = client.db(databaseName).collection<CountryDocument>(collectionName);
    const countries = countryDocumentsFromGeoJson(await loadCountryData(sourceUrl));

    if (countries.length === 0) {
      throw new Error(`No valid country features found in ${sourceUrl}`);
    }

    await collection.createIndex({ area: '2dsphere' });
    const result = await collection.bulkWrite(countries.map((country) => ({
      updateOne: {
        filter: { countryCode: country.countryCode },
        update: { $set: country },
        upsert: true,
      },
    })));

    console.log(`Seeded ${countries.length} countries into ${databaseName}.${collectionName}.`);
    console.log(`Inserted: ${result.upsertedCount}, updated: ${result.modifiedCount}.`);
  } finally {
    await client.close();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  seed().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
