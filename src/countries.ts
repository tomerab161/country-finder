import type { Geometry } from 'geojson';
import type { Collection } from 'mongodb';

export type CountryDocument = {
  countryCode: string;
  countryName: string;
  area: Geometry;
};

export interface CountryRepository {
  findIntersectingCountryCodes(geometry: Geometry): Promise<string[]>;
}

export class MongoCountryRepository implements CountryRepository {
  public constructor(private readonly collection: Collection<CountryDocument>) {}

  public async findIntersectingCountryCodes(geometry: Geometry): Promise<string[]> {
    const countries = await this.collection.find(
      { area: { $geoIntersects: { $geometry: geometry } } },
      { projection: { _id: 0, countryCode: 1 } },
    ).sort({ countryCode: 1 }).toArray();

    return countries.map((country) => country.countryCode);
  }
}
