# country-finder

Fastify service that returns the countries intersected by a GeoJSON `Polygon` or `MultiPolygon`.

## Setup

```sh
npm install
npm test
npm run build
npm run dev
npm run seed
```

The server listens on `http://localhost:3000` by default.

MongoDB connection settings can be configured with `MONGODB_URI`, `MONGODB_DATABASE`, and `MONGODB_COUNTRIES_COLLECTION`. The `countries` collection must contain `countryCode`, `countryName`, and GeoJSON `area` fields, with a `2dsphere` index on `area`.

With MongoDB running locally, seed the collection with:

```sh
npm run seed
```

The seed script downloads country GeoJSON, creates the `area` `2dsphere` index, and upserts the countries by `countryCode`. Set `COUNTRIES_GEOJSON_URL` to use a different compatible GeoJSON source.

## API

`POST /countries/intersections`

Request body:

```json
{
	"geometry": {
		"type": "Polygon",
		"coordinates": [[
			[-74.1, 40.6],
			[-73.9, 40.6],
			[-73.9, 40.8],
			[-74.1, 40.8],
			[-74.1, 40.6]
		]]
	}
}
```

Response:

```json
["US"]
```

Coordinates use the GeoJSON `[longitude, latitude]` order. Rings must be closed.