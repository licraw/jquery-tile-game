import { mkdtemp, mkdir, copyFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { inspectRuntimeSvg, validateVehiclePipeline, type ValidatorConfig } from "../lib/vehicleValidator";

const fixtureDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../__fixtures__");
const temporaryDirectories: string[] = [];

afterEach(async () => {
  const { rm } = await import("node:fs/promises");
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function fixture(name: string) {
  const { readFile } = await import("node:fs/promises");
  return readFile(path.join(fixtureDir, name), "utf8");
}

function config(overrides: Partial<ValidatorConfig> = {}): ValidatorConfig {
  return {
    id: "traffic-test-blue",
    label: "Test Blue",
    vehicleClass: "sedan",
    spritePath: "/games/near-miss/vehicles/traffic-test-blue.svg",
    spriteAspectRatio: 128 / 192,
    occupancyLengthScale: 1,
    nearMissGrowX: 13,
    nearMissGrowY: 11,
    collisionZones: [{ id: "body", x: 0, y: 0, width: 0.5, height: 0.8 }],
    ...overrides
  };
}

async function pipeline(overrides: Partial<ValidatorConfig> = {}, runtimeFixture = "valid.svg") {
  const rootDir = await mkdtemp(path.join(tmpdir(), "near-miss-validator-"));
  temporaryDirectories.push(rootDir);
  const sourceDir = path.join(rootDir, "source");
  const runtimeDir = path.join(rootDir, "runtime");
  await Promise.all([mkdir(sourceDir), mkdir(runtimeDir)]);
  await copyFile(path.join(fixtureDir, runtimeFixture), path.join(runtimeDir, "traffic-test-blue.svg"));
  await writeFile(path.join(sourceDir, "traffic-test-blue.svg"), await fixture("valid.svg"));
  return validateVehiclePipeline({
    rootDir,
    sourceDir,
    runtimeDir,
    configs: [config(overrides)],
    vehicleClasses: ["sedan"],
    packetMaxOccupancyLengthScale: 1.28
  });
}

describe("inspectRuntimeSvg", () => {
  it("accepts a numeric SVG baseline", async () => {
    expect(inspectRuntimeSvg(await fixture("valid.svg")).issues).toEqual([]);
  });

  it.each([
    ["missing-dimensions.svg", "svg-dimensions"],
    ["mismatched-viewbox.svg", "svg-viewbox-mismatch"],
    ["embedded-script.svg", "svg-script"],
    ["external-image.svg", "svg-image"]
  ])("rejects %s", async (name, code) => {
    expect(inspectRuntimeSvg(await fixture(name)).issues.map((currentIssue) => currentIssue.code)).toContain(code);
  });
});

describe("validateVehiclePipeline", () => {
  it("accepts a representative valid registry and asset", async () => {
    expect((await pipeline()).filter((currentIssue) => currentIssue.severity === "error")).toEqual([]);
  });

  it("rejects an aspect ratio mismatch", async () => {
    expect((await pipeline({}, "aspect-mismatch.svg")).map((currentIssue) => currentIssue.code)).toContain("aspect-ratio");
  });

  it("rejects a missing public SVG", async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), "near-miss-validator-"));
    temporaryDirectories.push(rootDir);
    const sourceDir = path.join(rootDir, "source");
    const runtimeDir = path.join(rootDir, "runtime");
    await Promise.all([mkdir(sourceDir), mkdir(runtimeDir)]);
    const issues = await validateVehiclePipeline({ rootDir, sourceDir, runtimeDir, configs: [config()], vehicleClasses: ["sedan"], packetMaxOccupancyLengthScale: 1.28 });
    expect(issues.map((currentIssue) => currentIssue.code)).toContain("missing-runtime-svg");
  });

  it("rejects invalid classes and malformed collision zones", async () => {
    const issues = await pipeline({ vehicleClass: "spaceship", collisionZones: [{ id: "bad", x: 0, y: 0, width: 0, height: Number.NaN }] });
    expect(issues.map((currentIssue) => currentIssue.code)).toEqual(expect.arrayContaining(["invalid-vehicle-class", "malformed-collision-zone"]));
  });

  it("warns without failing for an unregistered compatibility asset", async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), "near-miss-validator-"));
    temporaryDirectories.push(rootDir);
    const sourceDir = path.join(rootDir, "source");
    const runtimeDir = path.join(rootDir, "runtime");
    await Promise.all([mkdir(sourceDir), mkdir(runtimeDir)]);
    await copyFile(path.join(fixtureDir, "valid.svg"), path.join(runtimeDir, "traffic-sedan.svg"));
    const issues = await validateVehiclePipeline({ rootDir, sourceDir, runtimeDir, configs: [], vehicleClasses: ["sedan"], packetMaxOccupancyLengthScale: 1.28 });
    expect(issues).toContainEqual(expect.objectContaining({ severity: "warning", code: "unregistered-runtime-svg" }));
    expect(issues.some((currentIssue) => currentIssue.severity === "error")).toBe(false);
  });

  it("reports duplicate ids and sprite paths", async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), "near-miss-validator-"));
    temporaryDirectories.push(rootDir);
    const sourceDir = path.join(rootDir, "source");
    const runtimeDir = path.join(rootDir, "runtime");
    await Promise.all([mkdir(sourceDir), mkdir(runtimeDir)]);
    await copyFile(path.join(fixtureDir, "valid.svg"), path.join(runtimeDir, "traffic-test-blue.svg"));
    const duplicate = config();
    const issues = await validateVehiclePipeline({ rootDir, sourceDir, runtimeDir, configs: [duplicate, duplicate], vehicleClasses: ["sedan"], packetMaxOccupancyLengthScale: 1.28 });
    expect(issues.map((currentIssue) => currentIssue.code)).toEqual(expect.arrayContaining(["duplicate-id", "duplicate-sprite-path", "shared-runtime-file"]));
  });
});
