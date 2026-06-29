declare module "expo-location" {
  export const Accuracy: Record<string, number>;
  export function getForegroundPermissionsAsync(): Promise<{ status: string }>;
  export function requestForegroundPermissionsAsync(): Promise<{
    status: string;
  }>;
  export function getCurrentPositionAsync(
    options?: Record<string, unknown>,
  ): Promise<{
    coords: {
      latitude: number;
      longitude: number;
      altitude?: number | null;
    };
  }>;
  export function reverseGeocodeAsync(coords: {
    latitude: number;
    longitude: number;
  }): Promise<
    {
      city?: string | null;
      district?: string | null;
      subregion?: string | null;
      region?: string | null;
      country?: string | null;
      isoCountryCode?: string | null;
    }[]
  >;
  export function geocodeAsync(
    address: string
  ): Promise<
    {
      latitude: number;
      longitude: number;
      altitude?: number | null;
    }[]
  >;
}
