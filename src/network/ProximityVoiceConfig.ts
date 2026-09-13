export interface ProximityVoiceConfig {
  /** Distance in meters where audio is at 100% full volume (0 to minDistance) */
  minDistance: number;
  /** Distance in meters where audio fades to 0% (beyond maxDistance is inaudible) */
  maxDistance: number;
  /** Volume rolloff factor */
  rolloffFactor: number;
  /** Minimum audible volume when within range (0.0 to 1.0) */
  minVolume: number;
  /** Maximum volume (0.0 to 1.0) */
  maxVolume: number;
  /** Global master voice volume (0.0 to 1.0) */
  globalVolume: number;
  /** Enable 3D spatial panning */
  spatialAudioEnabled: boolean;
}

export const DEFAULT_PROXIMITY_CONFIG: ProximityVoiceConfig = {
  minDistance: 15.0,  // 0 to 15 meters: full volume
  maxDistance: 150.0, // audible up to 150 meters with smooth falloff
  rolloffFactor: 1.0,
  minVolume: 0.1,     // subtle audible presence at edge of range
  maxVolume: 1.0,
  globalVolume: 1.0,
  spatialAudioEnabled: true
};

/**
 * Calculates smooth volume attenuation based on distance:
 * - 0 to 5m: full volume (1.0)
 * - 5 to 15m: gradually reduced volume (1.0 -> 0.4)
 * - 15 to 25m: low volume (0.4 -> 0.0)
 * - > 25m: 0.0 (inaudible)
 */
export function calculateProximityVolume(
  distance: number,
  config: ProximityVoiceConfig = DEFAULT_PROXIMITY_CONFIG
): number {
  if (distance <= config.minDistance) {
    return config.maxVolume * config.globalVolume;
  }
  if (distance >= config.maxDistance) {
    return 0.0;
  }

  const range = config.maxDistance - config.minDistance;
  const norm = (distance - config.minDistance) / range; // 0.0 at minDistance, 1.0 at maxDistance
  const falloff = Math.pow(1.0 - norm, config.rolloffFactor);
  const vol = config.minVolume + falloff * (config.maxVolume - config.minVolume);

  return Math.max(0.0, Math.min(1.0, vol * config.globalVolume));
}
