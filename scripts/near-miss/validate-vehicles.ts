import process from "node:process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { NEAR_MISS_TUNING } from "../../src/games/near-miss/engine/tuning";
import { NEAR_MISS_VEHICLE_CLASSES, NEAR_MISS_VEHICLE_CONFIGS } from "../../src/games/near-miss/engine/vehicleConfig";
import { validateVehiclePipeline } from "./lib/vehicleValidator";

async function main() {
  const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const issues = await validateVehiclePipeline({
    rootDir,
    configs: NEAR_MISS_VEHICLE_CONFIGS,
    vehicleClasses: NEAR_MISS_VEHICLE_CLASSES,
    packetMaxOccupancyLengthScale: NEAR_MISS_TUNING.trafficMaxOccupancyLengthScale
  });

  for (const currentIssue of issues) {
    const output = `${currentIssue.severity.toUpperCase()} [${currentIssue.code}] ${currentIssue.message}`;
    (currentIssue.severity === "error" ? console.error : console.warn)(output);
  }

  const errorCount = issues.filter((currentIssue) => currentIssue.severity === "error").length;
  const warningCount = issues.length - errorCount;
  console.log(`Near Miss vehicle validation: ${errorCount} error(s), ${warningCount} warning(s).`);
  if (errorCount > 0) process.exitCode = 1;
}

void main();
