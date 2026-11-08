export interface GeoPoint {
  lat: number;
  lng: number;
  source: "gps";
}

export function formatGps(lat: number, lng: number): string {
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

/**
 * DF-44: resolve ONLY with a real device fix. On denial, timeout, or missing
 * geolocation support this REJECTS — callers must ask the user for a manual
 * location (address / map pin) instead of attaching synthesized coordinates.
 */
export function currentPosition(): Promise<GeoPoint> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported on this device. Please enter the location manually."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, source: "gps" }),
      (err) => reject(new Error(err.message || "Location permission denied. Please enter the location manually.")),
      { timeout: 6000, maximumAge: 60000 }
    );
  });
}
