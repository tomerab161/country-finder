import { z } from 'zod/v3';

const coordinateSchema = z.array(z.number().finite()).min(2).max(3);

type Coordinate = [number, number, ...number[]];

function orientation(first: Coordinate, second: Coordinate, third: Coordinate): number {
  return (second[0] - first[0]) * (third[1] - first[1])
    - (second[1] - first[1]) * (third[0] - first[0]);
}

function segmentsIntersect(
  firstStart: Coordinate,
  firstEnd: Coordinate,
  secondStart: Coordinate,
  secondEnd: Coordinate,
): boolean {
  const firstTurn = orientation(firstStart, firstEnd, secondStart);
  const secondTurn = orientation(firstStart, firstEnd, secondEnd);
  const thirdTurn = orientation(secondStart, secondEnd, firstStart);
  const fourthTurn = orientation(secondStart, secondEnd, firstEnd);

  return (firstTurn > 0 && secondTurn < 0 || firstTurn < 0 && secondTurn > 0)
    && (thirdTurn > 0 && fourthTurn < 0 || thirdTurn < 0 && fourthTurn > 0);
}

const linearRingSchema = z.array(coordinateSchema).min(4).superRefine((ring, context) => {
  const first = ring[0];
  const last = ring[ring.length - 1];

  if (first && last && (first[0] !== last[0] || first[1] !== last[1])) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Linear rings must be closed',
    });
  }

  for (let firstIndex = 0; firstIndex < ring.length - 1; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < ring.length - 1; secondIndex += 1) {
      const adjacent = secondIndex === firstIndex + 1;
      const closingPair = firstIndex === 0 && secondIndex === ring.length - 2;

      if (!adjacent && !closingPair && segmentsIntersect(
        ring[firstIndex] as Coordinate,
        ring[firstIndex + 1] as Coordinate,
        ring[secondIndex] as Coordinate,
        ring[secondIndex + 1] as Coordinate,
      )) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Linear rings must not self-intersect',
        });
        return;
      }
    }
  }
});

const polygonSchema = z.object({
  type: z.literal('Polygon'),
  coordinates: z.array(linearRingSchema).min(1),
});

const multiPolygonSchema = z.object({
  type: z.literal('MultiPolygon'),
  coordinates: z.array(z.array(linearRingSchema).min(1)).min(1),
});

export const geometrySchema = z.discriminatedUnion('type', [polygonSchema, multiPolygonSchema]);

export const intersectionRequestSchema = z.object({
  geometry: geometrySchema,
});

export type IntersectionRequest = z.infer<typeof intersectionRequestSchema>;
