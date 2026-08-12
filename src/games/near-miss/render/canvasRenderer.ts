import { drawRoad } from "./road";
import type { CrashVehicleMotion, NearMissRuntimeState } from "../engine/gameLoop";
import { NEAR_MISS_TUNING as TUNING } from "../engine/tuning";
import {
  getPlayerVehicleTransform,
  getTrafficVehicleTransform,
  getVehicleCollisionPolygons,
  getVehicleNearMissPolygons,
  type VehicleZonePolygon
} from "../engine/vehicleGeometry";
import { getVehicleConfig, NEAR_MISS_VEHICLE_CONFIGS, PLAYER_VEHICLE_ID } from "../engine/vehicleConfig";

const vehicleImages = new Map<string, HTMLImageElement>();

if (typeof window !== "undefined") {
  for (const config of NEAR_MISS_VEHICLE_CONFIGS) {
    const image = new Image();
    image.src = config.spritePath;
    vehicleImages.set(config.id, image);
  }
}

export function renderNearMiss(ctx: CanvasRenderingContext2D, state: NearMissRuntimeState) {
  drawRoad(ctx, state.laneSystem, state.width, state.height, state.stripeOffset);

  for (const car of state.traffic) {
    const crashMotion = getTrafficCrashMotion(state, car.id);
    ctx.save();
    ctx.globalAlpha = TUNING.trafficRenderAlpha;
    drawTrafficVehicle(ctx, car.x, car.y, car.width, car.height, car.vehicleConfigId, crashMotion);
    ctx.restore();
  }

  drawMainCar(ctx, state);

  if (state.debug) {
    drawDebugOverlays(ctx, state);
  }

  for (const feedback of state.feedbacks) {
    const age = feedback.age / feedback.life;
    const isScorePopup = feedback.variant === "score";
    ctx.save();
    ctx.globalAlpha = Math.max(0, (isScorePopup ? 0.72 : 1) - age);
    ctx.fillStyle = feedback.tone === "danger" ? "#ff4d5a" : "#facc15";
    ctx.font = isScorePopup ? "700 13px Arial, Helvetica, sans-serif" : "800 16px Arial, Helvetica, sans-serif";
    ctx.textAlign = "center";
    ctx.shadowColor = feedback.tone === "danger" ? "rgba(255, 77, 90, 0.5)" : "rgba(250, 204, 21, 0.45)";
    ctx.shadowBlur = isScorePopup ? 6 : 12;
    ctx.fillText(feedback.text, feedback.x, feedback.y - age * (isScorePopup ? 18 : 26));
    ctx.restore();
  }
}

function drawTrafficVehicle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  vehicleConfigId: string,
  crashMotion: CrashVehicleMotion | null = null
) {
  const vehicleConfig = getVehicleConfig(vehicleConfigId);
  const vehicleImage = vehicleImages.get(vehicleConfig.id);
  const transform = getTrafficVehicleTransform(applyCrashMotion({ x, y, width, height }, crashMotion), vehicleConfig, crashMotion?.yawDeg || 0);

  ctx.translate(transform.centerX, transform.centerY);
  ctx.rotate(transform.yawRadians);
  ctx.translate(-transform.centerX, -transform.centerY);
  ctx.shadowColor = vehicleConfig.vehicleClass === "van-truck" ? "rgba(60, 255, 143, 0.18)" : "rgba(65, 171, 232, 0.2)";
  ctx.shadowBlur = 12;

  if (vehicleImage?.complete && vehicleImage.naturalWidth > 0) {
    drawImageInBounds(ctx, vehicleImage, transform.bounds);
    return;
  }

  drawMissingVehicleAsset(ctx, transform.bounds);
}

function drawMainCar(ctx: CanvasRenderingContext2D, state: NearMissRuntimeState) {
  const vehicleConfig = getVehicleConfig(PLAYER_VEHICLE_ID);
  const vehicleImage = vehicleImages.get(vehicleConfig.id);
  const player = getCrashAdjustedPlayer(state);
  const transform = getPlayerVehicleTransform(player);

  ctx.save();
  ctx.translate(transform.centerX, transform.centerY);
  ctx.rotate(transform.yawRadians);
  ctx.translate(-transform.centerX, -transform.centerY);
  ctx.shadowColor = "rgba(255, 77, 90, 0.46)";
  ctx.shadowBlur = 22;

  if (vehicleImage?.complete && vehicleImage.naturalWidth > 0) {
    drawImageInBounds(ctx, vehicleImage, transform.bounds);
  } else {
    drawMissingVehicleAsset(ctx, transform.bounds);
  }

  ctx.restore();
}

function drawImageInBounds(ctx: CanvasRenderingContext2D, image: HTMLImageElement, bounds: { x: number; y: number; width: number; height: number }) {
  ctx.drawImage(image, bounds.x, bounds.y, bounds.width, bounds.height);
}

function drawMissingVehicleAsset(ctx: CanvasRenderingContext2D, bounds: { x: number; y: number; width: number; height: number }) {
  const width = Math.min(bounds.width, 28);
  const height = Math.min(bounds.height, 42);
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;

  ctx.save();
  ctx.strokeStyle = "rgba(255, 77, 90, 0.72)";
  ctx.lineWidth = 2;
  ctx.strokeRect(centerX - width / 2, centerY - height / 2, width, height);
  ctx.beginPath();
  ctx.moveTo(centerX - width / 2, centerY - height / 2);
  ctx.lineTo(centerX + width / 2, centerY + height / 2);
  ctx.stroke();
  ctx.restore();
}

function drawDebugOverlays(ctx: CanvasRenderingContext2D, state: NearMissRuntimeState) {
  const playerConfig = getVehicleConfig(PLAYER_VEHICLE_ID);
  const player = getCrashAdjustedPlayer(state);
  const playerTransform = getPlayerVehicleTransform(player);

  ctx.save();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(125, 211, 252, 0.58)";
  strokeBounds(ctx, player);
  ctx.strokeStyle = "rgba(216, 180, 254, 0.55)";
  strokeBounds(ctx, playerTransform.bounds);
  ctx.strokeStyle = "rgba(60, 255, 143, 0.85)";
  strokeZonePolygons(ctx, getVehicleCollisionPolygons(playerTransform));
  ctx.strokeStyle = "rgba(250, 204, 21, 0.55)";
  strokeZonePolygons(ctx, getVehicleNearMissPolygons(playerTransform));
  ctx.fillStyle = "rgba(244, 242, 238, 0.72)";
  ctx.font = "700 10px Arial, Helvetica, sans-serif";
  ctx.fillText(
    `${playerConfig.label} / ${playerConfig.vehicleClass} / yaw ${state.player.visualYaw.toFixed(1)}deg`,
    player.x,
    Math.max(12, player.y - 4)
  );

  for (const center of state.laneSystem.centers) {
    ctx.strokeStyle = "rgba(125, 211, 252, 0.26)";
    ctx.beginPath();
    ctx.moveTo(center, 0);
    ctx.lineTo(center, state.height);
    ctx.stroke();
  }

  for (let lane = 0; lane < state.laneSystem.lanes - 1; lane += 1) {
    const seamX = state.laneSystem.roadLeft + state.laneSystem.laneWidth * (lane + 1);
    ctx.strokeStyle = state.safeChannelActive ? "rgba(250, 204, 21, 0.68)" : "rgba(250, 204, 21, 0.22)";
    ctx.beginPath();
    ctx.moveTo(seamX, 0);
    ctx.lineTo(seamX, state.height);
    ctx.stroke();
  }

  for (const car of state.traffic) {
    const vehicleConfig = getVehicleConfig(car.vehicleConfigId);
    const crashMotion = getTrafficCrashMotion(state, car.id);
    const trafficBounds = applyCrashMotion(car, crashMotion);
    const trafficTransform = getTrafficVehicleTransform(trafficBounds, vehicleConfig, crashMotion?.yawDeg || 0);
    ctx.strokeStyle = "rgba(125, 211, 252, 0.5)";
    strokeBounds(ctx, trafficBounds);
    ctx.strokeStyle = "rgba(216, 180, 254, 0.5)";
    strokeBounds(ctx, trafficTransform.bounds);
    ctx.strokeStyle = "rgba(255, 77, 90, 0.75)";
    strokeZonePolygons(ctx, getVehicleCollisionPolygons(trafficTransform));
    ctx.strokeStyle = "rgba(250, 204, 21, 0.32)";
    strokeZonePolygons(ctx, getVehicleNearMissPolygons(trafficTransform));
    ctx.strokeStyle = "rgba(60, 255, 143, 0.45)";
    const corridorX = state.laneSystem.centers[car.corridorLane];
    ctx.beginPath();
    ctx.moveTo(corridorX, Math.max(0, car.y - 12));
    ctx.lineTo(corridorX, Math.min(state.height, car.y + car.height + 12));
    ctx.stroke();
    ctx.fillStyle = "rgba(244, 242, 238, 0.72)";
    ctx.font = "700 10px Arial, Helvetica, sans-serif";
    ctx.fillText(
      [
        `${vehicleConfig.label} / ${vehicleConfig.vehicleClass} / yaw ${(crashMotion?.yawDeg || 0).toFixed(1)}deg`,
        state.crash?.trafficMotionsById[car.id]
          ? [
              `hit ${state.crash.hitVehicleClass}`,
              state.crash.impactType,
              `n ${state.crash.normalX.toFixed(2)},${state.crash.normalY.toFixed(2)}`,
              `spin ${state.crash.spinSign}`,
              `rel ${(state.crash.relativeSpeedAtImpact / TUNING.displayedSpeedDivisor).toFixed(0)}`,
              `p ${Object.keys(state.crash.trafficMotionsById).length}`,
              `sec ${state.crash.secondaryImpactCount}`,
              state.crash.lastSecondaryImpact
                ? `last ${state.crash.lastSecondaryImpact.impactType} ${state.crash.lastSecondaryImpact.source}->${state.crash.lastSecondaryImpact.targetId} ${state.crash.lastSecondaryImpact.impactSpeed.toFixed(0)} lo ${state.crash.lastSecondaryImpact.lateralOverlap.toFixed(0)}`
                : "",
              `m ${vehicleConfig.crashMass} sr ${vehicleConfig.crashSpinResistance}/${vehicleConfig.crashSlideResistance}`,
              `av ${state.crash.player.angularVelocityDeg.toFixed(0)}/${state.crash.trafficMotionsById[car.id].angularVelocityDeg.toFixed(0)}`
            ]
              .filter(Boolean)
              .join(" ")
          : "",
        `${car.packetId} c${car.corridorLane}`,
        `v ${formatTrafficDebugSpeed(car.currentWorldSpeed)}/${formatTrafficDebugSpeed(car.desiredWorldSpeed)}`,
        `b ${car.blockedById ?? "-"} g ${car.followingGapPx === null ? "-" : car.followingGapPx.toFixed(0)}${car.emergencyCorrected ? " !" : ""}`
      ]
        .filter(Boolean)
        .join(" / "),
      trafficBounds.x,
      Math.max(12, trafficBounds.y - 4)
    );
  }
  ctx.restore();
}

function getCrashAdjustedPlayer(state: NearMissRuntimeState) {
  const crashMotion = state.crash?.player || null;

  if (!crashMotion) {
    return state.player;
  }

  return {
    ...state.player,
    x: state.player.x + crashMotion.offsetX,
    y: state.player.y + crashMotion.offsetY,
    visualYaw: state.player.visualYaw + crashMotion.yawDeg
  };
}

function formatTrafficDebugSpeed(speed: number) {
  return (speed / TUNING.displayedSpeedDivisor).toFixed(0);
}

function getTrafficCrashMotion(state: NearMissRuntimeState, trafficId: number) {
  return state.crash?.trafficMotionsById[trafficId] || null;
}

function applyCrashMotion<T extends { x: number; y: number }>(bounds: T, crashMotion: CrashVehicleMotion | null): T {
  if (!crashMotion) {
    return bounds;
  }

  return {
    ...bounds,
    x: bounds.x + crashMotion.offsetX,
    y: bounds.y + crashMotion.offsetY
  };
}

function strokeBounds(ctx: CanvasRenderingContext2D, bounds: { x: number; y: number; width: number; height: number }) {
  ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
}

function strokeZonePolygons(ctx: CanvasRenderingContext2D, polygons: readonly VehicleZonePolygon[]) {
  for (const polygon of polygons) {
    ctx.beginPath();
    ctx.moveTo(polygon.points[0].x, polygon.points[0].y);

    for (let index = 1; index < polygon.points.length; index += 1) {
      ctx.lineTo(polygon.points[index].x, polygon.points[index].y);
    }

    ctx.closePath();
    ctx.stroke();
  }
}
