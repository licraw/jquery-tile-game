export type NearMissVehicleClass = "sports-coupe" | "sedan" | "van-truck";

export type NearMissVehicleCollisionZone = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type NearMissVehicleConfig = {
  id: string;
  label: string;
  vehicleClass: NearMissVehicleClass;
  spritePath: string;
  spriteAspectRatio: number;
  uniformVisualScale: number;
  occupancyWidthLanes: number;
  occupancyLengthScale: number;
  nearMissGrowX: number;
  nearMissGrowY: number;
  crashMass: number;
  crashSpinResistance: number;
  crashSlideResistance: number;
  collisionZones: NearMissVehicleCollisionZone[];
  spawnWeight: number;
};

export const PLAYER_VEHICLE_ID = "player-sports-coupe";
export const DEFAULT_TRAFFIC_VEHICLE_ID = "traffic-sedan-blue";

export const NEAR_MISS_VEHICLE_CONFIGS = [
  {
    id: PLAYER_VEHICLE_ID,
    label: "Sports Coupe",
    vehicleClass: "sports-coupe",
    spritePath: "/games/near-miss/vehicles/player-sports-car.svg",
    spriteAspectRatio: 128 / 192,
    uniformVisualScale: 1,
    occupancyWidthLanes: 0.48,
    occupancyLengthScale: 1,
    nearMissGrowX: 18,
    nearMissGrowY: 11,
    crashMass: 0.7,
    crashSpinResistance: 1,
    crashSlideResistance: 1,
    collisionZones: [
      { id: "center-body", x: 0, y: 0.03, width: 0.48, height: 0.6 },
      { id: "front-taper", x: 0, y: -0.31, width: 0.38, height: 0.27 },
      { id: "rear-taper", x: 0, y: 0.35, width: 0.42, height: 0.23 }
    ],
    spawnWeight: 0
  },
  {
    id: "traffic-sedan-blue",
    label: "Blue Sedan",
    vehicleClass: "sedan",
    spritePath: "/games/near-miss/vehicles/traffic-sedan-blue.svg",
    spriteAspectRatio: 128 / 192,
    uniformVisualScale: 0.9,
    occupancyWidthLanes: 0.46,
    occupancyLengthScale: 1,
    nearMissGrowX: 13,
    nearMissGrowY: 11,
    crashMass: 1,
    crashSpinResistance: 1,
    crashSlideResistance: 1,
    collisionZones: [
      { id: "center-cabin", x: 0, y: 0.04, width: 0.56, height: 0.54 },
      { id: "front-taper", x: 0, y: -0.3, width: 0.44, height: 0.25 },
      { id: "rear-taper", x: 0, y: 0.32, width: 0.48, height: 0.23 }
    ],
    spawnWeight: 50
  },
  {
    id: "traffic-sedan-gold",
    label: "Gold Sedan",
    vehicleClass: "sedan",
    spritePath: "/games/near-miss/vehicles/traffic-sedan-gold.svg",
    spriteAspectRatio: 128 / 192,
    uniformVisualScale: 0.9,
    occupancyWidthLanes: 0.46,
    occupancyLengthScale: 1,
    nearMissGrowX: 13,
    nearMissGrowY: 11,
    crashMass: 1,
    crashSpinResistance: 1,
    crashSlideResistance: 1,
    collisionZones: [
      { id: "center-cabin", x: 0, y: 0.04, width: 0.56, height: 0.54 },
      { id: "front-taper", x: 0, y: -0.3, width: 0.44, height: 0.25 },
      { id: "rear-taper", x: 0, y: 0.32, width: 0.48, height: 0.23 }
    ],
    spawnWeight: 50
  },
  {
    id: "traffic-box-truck",
    label: "Box Truck",
    vehicleClass: "van-truck",
    spritePath: "/games/near-miss/vehicles/boxtruck.svg",
    spriteAspectRatio: 128 / 224,
    uniformVisualScale: 1.22,
    occupancyWidthLanes: 0.9,
    occupancyLengthScale: 1.28,
    nearMissGrowX: 16,
    nearMissGrowY: 13,
    crashMass: 1.75,
    crashSpinResistance: 2.55,
    crashSlideResistance: 1.18,
    collisionZones: [
      { id: "cargo-box", x: 0, y: 0.18, width: 0.68, height: 0.58 },
      { id: "cab", x: 0, y: -0.28, width: 0.56, height: 0.31 },
      { id: "rear-bumper", x: 0, y: 0.46, width: 0.64, height: 0.08 }
    ],
    spawnWeight: 12
  }
] as const satisfies readonly NearMissVehicleConfig[];

export function getVehicleConfig(id: string): NearMissVehicleConfig {
  const config = NEAR_MISS_VEHICLE_CONFIGS.find((entry) => entry.id === id);
  const fallbackConfig = NEAR_MISS_VEHICLE_CONFIGS.find((entry) => entry.id === DEFAULT_TRAFFIC_VEHICLE_ID);

  if (!config && !fallbackConfig) {
    throw new Error("Near Miss vehicle registry is missing its default traffic vehicle.");
  }

  return config || fallbackConfig!;
}

export function getSpawnableTrafficVehicleConfigs() {
  return NEAR_MISS_VEHICLE_CONFIGS.filter((config) => config.spawnWeight > 0 && config.id !== PLAYER_VEHICLE_ID);
}
