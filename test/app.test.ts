import type { Geometry } from 'geojson';
import { afterAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { MongoCountryRepository, type CountryDocument } from '../src/countries.js';

const queriedGeometries: Geometry[] = [];
const app = buildApp({
  findIntersectingCountryCodes: async (geometry) => {
    queriedGeometries.push(geometry);
    return ['US', 'GB'];
  },
});

afterAll(async () => app.close());

describe('country intersections', () => {
it('returns the country intersected by a polygon', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/countries/intersections',
    payload: {
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-74.1, 40.6],
          [-73.9, 40.6],
          [-73.9, 40.8],
          [-74.1, 40.8],
          [-74.1, 40.6],
        ]],
      },
    },
  });

  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual(['US', 'GB']);
  expect(queriedGeometries).toHaveLength(1);
});

it('returns all countries intersected by a multipolygon', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/countries/intersections',
    payload: {
      geometry: {
        type: 'MultiPolygon',
        coordinates: [
          [[[-74.1, 40.6], [-73.9, 40.6], [-73.9, 40.8], [-74.1, 40.8], [-74.1, 40.6]]],
          [[[-0.2, 51.4], [0.0, 51.4], [0.0, 51.6], [-0.2, 51.6], [-0.2, 51.4]]],
        ],
      },
    },
  });

  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual(['US', 'GB']);
  expect(queriedGeometries).toHaveLength(2);
});

it('rejects unsupported or malformed GeoJSON', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/countries/intersections',
    payload: {
      geometry: {
        type: 'Point',
        coordinates: [0, 0],
      },
    },
  });

  expect(response.statusCode).toBe(400);
});

it('rejects a self-intersecting multipolygon ring', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/countries/intersections',
    payload: {
      geometry: {
        type: 'MultiPolygon',
        coordinates: [[[
          [34.27, 31.25],
          [34.50, 31.80],
          [35.10, 33.09],
          [35.50, 32.70],
          [34.95, 29.50],
          [35.21, 31.00],
          [34.27, 31.25],
        ]]],
      },
    },
  });

  expect(response.statusCode).toBe(400);
  expect(response.body).toMatch(/must not self-intersect/);
});

it('queries MongoDB for country codes using a geospatial intersection', async () => {
  let receivedFilter: unknown;
  let receivedOptions: unknown;
  const cursor = {
    sort: () => cursor,
    toArray: async () => [{ countryCode: 'GB' }, { countryCode: 'US' }],
  };
  const collection = {
    find: (filter: unknown, options: unknown) => {
      receivedFilter = filter;
      receivedOptions = options;
      return cursor;
    },
  } as unknown as import('mongodb').Collection<CountryDocument>;

  const repository = new MongoCountryRepository(collection);
  const geometry = {
    type: 'Polygon' as const,
    coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]],
  };

  expect(await repository.findIntersectingCountryCodes(geometry)).toEqual(['GB', 'US']);
  expect(receivedFilter).toEqual({ area: { $geoIntersects: { $geometry: geometry } } });
  expect(receivedOptions).toEqual({ projection: { _id: 0, countryCode: 1 } });
});
});
