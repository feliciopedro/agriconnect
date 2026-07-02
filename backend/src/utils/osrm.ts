import { calculateDistanceKm } from './distance';

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface RouteMatrix {
  distances: number[][]; // in meters
  durations: number[][]; // in seconds
}

/**
 * OpenStreetMap OSRM Distance Matrix Client with automatic Haversine fallback.
 */
export class OSRMClient {
  private static getApiBaseUrl(): string {
    const url = process.env.OSRM_API_URL || 'http://router.project-osrm.org';
    return url.replace(/\/$/, ''); // Remove trailing slash
  }

  /**
   * Fetches driving distance and duration matrices for a list of coordinates.
   * Order of coordinates determines row/column indexing.
   */
  public static async getDistanceMatrix(coordinates: Coordinate[]): Promise<RouteMatrix> {
    const count = coordinates.length;
    if (count === 0) {
      return { distances: [], durations: [] };
    }

    const apiBase = this.getApiBaseUrl();
    const isMock = apiBase.includes('mock') || process.env.NODE_ENV === 'test';

    if (!isMock) {
      try {
        // Format coordinates: lon,lat;lon,lat;...
        const coordString = coordinates
          .map((c) => `${c.longitude},${c.latitude}`)
          .join(';');

        const url = `${apiBase}/table/v1/driving/${coordString}?annotations=distance,duration`;
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000); // 4-second timeout limit

        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (response.ok) {
          const body = await response.json();
          if (body.code === 'Ok' && body.distances && body.durations) {
            // Some OSRM instances might return null for unreachable coordinates, coerce to infinity or high value
            const distances = body.distances.map((row: any) =>
              row.map((val: any) => (val === null ? 999999 : val))
            );
            const durations = body.durations.map((row: any) =>
              row.map((val: any) => (val === null ? 999999 : val))
            );
            return { distances, durations };
          }
        }
      } catch (error: any) {
        console.warn(`[OSRM] Failed fetching matrix from API, falling back to Haversine logic: ${error.message}`);
      }
    }

    // Fallback: Haversine-based distance matrix (Road curvature factor: 1.3, speed: 45 km/h = 12.5 m/s)
    const ROAD_CURVATURE_FACTOR = 1.3;
    const DRIVING_SPEED_MPS = 12.5; // 45 km/h in meters/second

    const distances: number[][] = Array(count).fill(0).map(() => Array(count).fill(0));
    const durations: number[][] = Array(count).fill(0).map(() => Array(count).fill(0));

    for (let i = 0; i < count; i++) {
      for (let j = 0; j < count; j++) {
        if (i === j) {
          distances[i][j] = 0;
          durations[i][j] = 0;
        } else {
          const distKm = calculateDistanceKm(
            coordinates[i].latitude,
            coordinates[i].longitude,
            coordinates[j].latitude,
            coordinates[j].longitude
          );
          const roadDistMeters = Math.round(distKm * 1000 * ROAD_CURVATURE_FACTOR);
          const durationSeconds = Math.round(roadDistMeters / DRIVING_SPEED_MPS);

          distances[i][j] = roadDistMeters;
          durations[i][j] = durationSeconds;
        }
      }
    }

    return { distances, durations };
  }

  /**
   * Fetches the single route distance (meters) and duration (seconds) between origin and destination.
   */
  public static async getRoute(origin: Coordinate, destination: Coordinate): Promise<{ distanceMeters: number; durationSeconds: number }> {
    const matrix = await this.getDistanceMatrix([origin, destination]);
    if (matrix.distances.length >= 2) {
      return {
        distanceMeters: matrix.distances[0][1],
        durationSeconds: matrix.durations[0][1],
      };
    }
    return { distanceMeters: 0, durationSeconds: 0 };
  }
}
