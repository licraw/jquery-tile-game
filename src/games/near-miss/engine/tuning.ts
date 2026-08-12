import type { CarBounds } from "@/games/shared/car/types";
import { getVehicleConfig, PLAYER_VEHICLE_ID, type NearMissVehicleConfig } from "./vehicleConfig";

// Near Miss tuning is intentionally centralized here. Prefer moving literals into
// this file before changing formulas in the game loop, spawner, or renderer.
export const NEAR_MISS_TUNING = {
  // Road/lane geometry. The road width formula itself lives in shared laneSystem.
  laneCount: 4,
  roadWidthScale: 0.95,
  debug: false,

  // Internal speed units. HUD mph is a simple display transform, not simulation.
  minSpeed: 190,
  cruiseSpeed: 285,
  maxSpeed: 880,
  baselineSpeedReserve: 80,
  speedRampPerSecond: 6.8,
  throttleAcceleration: 185,
  brakeDeceleration: 250,
  speedReturnRate: 1.8,
  displayedSpeedDivisor: 5.2,
  secondsPerHour: 3600,
  minimumDisplayedMiles: 0.1,

  // Player lateral controller. These numbers define the current handling feel.
  steerRiseRate: 13,
  lateralAccel: 15,
  activeLateralDamping: 7.5,
  coastLateralDamping: 11,
  counterSteerBonus: 7,
  maxLatSpeedLow: 3.15,
  maxLatSpeedHigh: 2.35,
  visualYawMaxDeg: 10,
  visualYawReturnRate: 11,
  visualYawSteerInfluence: 0.22,
  edgeDamping: 0.24,
  roadEdgePadding: 8,
  playerBottomMargin: 34,

  // Gameplay occupancy body sizing. Rendered sprite bounds are derived from
  // these bodies. Crash and near-miss zones live in vehicleConfig.ts.
  carWidthRatio: 0.48,
  carHeightRatio: 1.34,

  minNearMissRelativeSpeed: 62,
  minScreenApproachSpeed: 28,
  trafficNearSpeedDeadzoneMph: 3,
  trafficApproachCurveScaleMph: 45,
  trafficMaxApproachScreenSpeedMph: 70,
  trafficPullAwayCurveScaleMph: 15,
  trafficMaxPullAwayScreenSpeedMph: 12,

  // Traffic packet grammar. Offsets are lane-relative, y offsets are car-height-relative.
  laneSpawnMinGapCars: 0.75,
  laneSpawnMinGapPx: 32,
  laneOffsetAmount: 0.18,
  edgeLaneInwardBias: 0.1,
  corridorShiftFrequency: 3.5,
  spawnBlockedLaneLookaheadCars: 2.2,
  spawnIntervalFloor: 0.58,
  spawnIntervalBase: 1.16,
  spawnSpeedDivisor: 900,
  spawnDensityRampMax: 0.34,
  spawnDensityRampSeconds: 80,
  spawnJitterMin: 0.86,
  spawnJitterRange: 0.28,
  spawnDensityBandSeconds: 12,
  trafficMaxOccupancyLengthScale: 1.28,
  trafficWidthRandomBase: 0.9,
  trafficWidthRandomRange: 0.12,
  trafficHeightRandomBase: 0.94,
  trafficHeightRandomRange: 0.12,
  trafficMinCruiseMph: 60,
  trafficMaxCruiseMph: 80,
  trafficFollowingGapCars: 0.45,
  trafficFollowingGapMinPx: 20,
  trafficFollowingLookaheadSeconds: 0.7,
  trafficMinPhysicalGapPx: 6,
  trafficAccelMphPerSecond: 5,
  trafficBrakeMphPerSecond: 18,
  trafficEmergencyBrakeMphPerSecond: 35,
  trafficCompressionGapRatio: 0.55,
  trafficOffscreenPullAwayScreens: 1.1,
  subtleLaneOffsetFrequency: 0.7,
  subtleLaneOffsetPhaseStep: 1.9,
  subtleLaneOffsetScale: 0.55,

  // Anti-safe-channel pressure and lane-split scoring.
  safeChannelWindow: 1.2,
  safeChannelBand: 0.1,
  safeChannelScorePenalty: 0.82,
  safeChannelInstability: 0.42,
  safeChannelInstabilitySpeedOffset: 70,
  safeChannelInstabilityFrequency: 9.5,
  safeChannelComboDecayRate: 1.6,
  safeChannelRecoveryRate: 2,
  safeChannelTrafficRecoveryRate: 0.75,
  laneSplitBonusThreshold: 2,
  laneSplitBonus: 325,
  laneSplitCooldown: 1.1,
  laneSplitMinLateralSpeed: 0.38,
  laneSplitTrafficYRange: 126,
  laneSplitTrafficXRangeLanes: 0.78,

  // Run feedback and score glue values that are outside scoring.ts.
  missedCarComboWindowScale: 0.5,
  streakScoreStep: 40,
  feedbackCooldownMs: 650,
  maxActiveFeedbackMessages: 2,
  minimumScoreForCallout: 400,
  comboMilestoneInterval: 3,
  messageLifetimeMs: 950,
  scorePopupLifetimeMs: 620,

  // Road motion and render-only speed effects.
  stripeSpeedScale: 0.52,
  stripeRepeatDistance: 54,

  // Arcade crash aftermath. These values only drive the short post-impact
  // slide/spin phase before the existing game-over summary appears.
  crashMaxRelativeSpeed: 420,
  crashSpeedRatioFloor: 0.18,
  crashRearFactor: 1,
  crashSideFactor: 1.3,
  crashSpinAxisThreshold: 0.15,
  crashRearClipThreshold: -0.28,
  crashCornerBlendThreshold: 0.32,
  crashDurationLowSpeed: 1.05,
  crashDurationHighSpeed: 2,
  crashLinearDamping: 1.45,
  crashAngularDamping: 1.8,
  crashRoadPhase1Duration: 0.22,
  crashRoadPhase1TargetRatio: 0.76,
  crashRoadPhase2SlowdownRate: 0.48,
  crashRoadSlowdownRateLowSpeed: 2.8,
  crashRoadSlowdownRateHighSpeed: 1.65,
  crashMinRoadSpeedRatioLowSpeed: 0.18,
  crashMinRoadSpeedRatioHighSpeed: 0.42,
  crashSpeedMomentumThreshold: 780,
  crashMinPlayerSlideImpulse: 130,
  crashMinTrafficSlideImpulse: 105,
  crashScreenLiftImpulse: 150,
  maxCrashParticipants: 4,
  maxSecondaryImpacts: 3,
  secondaryCrashMinImpactSpeed: 85,
  secondaryRearEndMinApproachSpeed: 42,
  secondaryCrashImpulseScale: 0.58,
  secondaryCrashMaxImpulse: 260,
  secondaryCrashSpinScale: 0.72,
  secondaryCrashDampingOnImpact: 0.72,
  playerCrashImpulse: 275,
  trafficCrashImpulse: 240,
  playerSpinIntensity: 300,
  trafficSpinIntensity: 220,

  // Sprite overdraw. These define rendered SVG bounds used by rendering and
  // transformed local collision zones.
  trafficSpriteScaleX: 2.28,
  trafficSpriteScaleY: 1.42,
  playerSpriteScaleX: 2.08,
  playerSpriteScaleY: 1.2,
  trafficRenderAlpha: 0.86
};

export function getPlayerBodySize(laneWidth: number) {
  const width = Math.min(62, laneWidth * NEAR_MISS_TUNING.carWidthRatio);

  return {
    width,
    height: width * NEAR_MISS_TUNING.carHeightRatio
  };
}

export function getTrafficBodySize(
  laneWidth: number,
  playerBody: Pick<CarBounds, "height">,
  vehicleConfig: Pick<NearMissVehicleConfig, "occupancyWidthLanes" | "occupancyLengthScale">,
  widthVariance = 1,
  heightVariance = 1
) {
  return {
    width: laneWidth * vehicleConfig.occupancyWidthLanes * widthVariance,
    height: playerBody.height * vehicleConfig.occupancyLengthScale * heightVariance
  };
}

export function getPlayerSpriteBounds(bounds: CarBounds) {
  return getRenderedSpriteBounds(
    bounds,
    getVehicleConfig(PLAYER_VEHICLE_ID),
    NEAR_MISS_TUNING.playerSpriteScaleX,
    NEAR_MISS_TUNING.playerSpriteScaleY
  );
}

export function getTrafficSpriteBounds(bounds: CarBounds, vehicleConfig: NearMissVehicleConfig) {
  return getRenderedSpriteBounds(bounds, vehicleConfig, NEAR_MISS_TUNING.trafficSpriteScaleX, NEAR_MISS_TUNING.trafficSpriteScaleY);
}

export function getRenderedSpriteBounds(
  bounds: CarBounds,
  vehicleConfig: Pick<NearMissVehicleConfig, "spriteAspectRatio" | "uniformVisualScale">,
  spriteScaleX: number,
  spriteScaleY: number
): CarBounds {
  const maxWidth = bounds.width * spriteScaleX * vehicleConfig.uniformVisualScale;
  const maxHeight = bounds.height * spriteScaleY * vehicleConfig.uniformVisualScale;
  const widthFromHeight = maxHeight * vehicleConfig.spriteAspectRatio;
  const width = Math.min(maxWidth, widthFromHeight);
  const height = width / vehicleConfig.spriteAspectRatio;

  return {
    x: bounds.x + bounds.width / 2 - width / 2,
    y: bounds.y + bounds.height / 2 - height / 2,
    width,
    height
  };
}

export function getBaselineSpeed(elapsedSeconds: number) {
  return Math.min(
    NEAR_MISS_TUNING.maxSpeed - NEAR_MISS_TUNING.baselineSpeedReserve,
    NEAR_MISS_TUNING.cruiseSpeed + elapsedSeconds * NEAR_MISS_TUNING.speedRampPerSecond
  );
}

export function getDisplayedSpeed(speed: number) {
  return speed / NEAR_MISS_TUNING.displayedSpeedDivisor;
}

export function internalSpeedFromMph(mph: number) {
  return mph * NEAR_MISS_TUNING.displayedSpeedDivisor;
}

export function getDisplayedDistanceMiles(distance: number) {
  return Math.max(
    NEAR_MISS_TUNING.minimumDisplayedMiles,
    distance / NEAR_MISS_TUNING.displayedSpeedDivisor / NEAR_MISS_TUNING.secondsPerHour
  );
}
