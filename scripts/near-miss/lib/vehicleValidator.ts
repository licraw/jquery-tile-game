import { readFile } from "node:fs/promises";
import path from "node:path";

export type ValidationSeverity = "error" | "warning";

export type ValidationIssue = {
  severity: ValidationSeverity;
  code: string;
  message: string;
};

export type ValidatorConfig = {
  id: unknown;
  label?: unknown;
  vehicleClass: unknown;
  spritePath: unknown;
  spriteAspectRatio: unknown;
  occupancyLengthScale: unknown;
  nearMissGrowX: unknown;
  nearMissGrowY: unknown;
  collisionZones: unknown;
};

export type ValidateVehiclePipelineOptions = {
  rootDir: string;
  configs: readonly ValidatorConfig[];
  vehicleClasses: readonly string[];
  packetMaxOccupancyLengthScale: number;
  sourceDir?: string;
  runtimeDir?: string;
};

const SPRITE_PATH_PREFIX = "/games/near-miss/vehicles/";
const SVG_FILE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*\.svg$/;
const EXPECTED_SOURCE_BY_RUNTIME: Readonly<Record<string, string>> = {
  "boxtruck.svg": "boxtruck.svg",
  "player-sports-car.svg": "redcar.svg",
  "traffic-sedan-blue.svg": "blue-sedan.svg",
  "traffic-sedan-gold.svg": "gold-sedan.svg",
  "traffic-sedan.svg": "gold-sedan.svg"
};

type SvgInspection = {
  width?: number;
  height?: number;
  viewBox?: readonly [number, number, number, number];
  issues: ValidationIssue[];
};

function issue(severity: ValidationSeverity, code: string, message: string): ValidationIssue {
  return { severity, code, message };
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function readNumericAttribute(root: string, name: string): number | undefined {
  const match = root.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, "i"));
  if (!match || !/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(match[1].trim())) return undefined;
  const value = Number(match[1]);
  return value > 0 ? value : undefined;
}

export function inspectRuntimeSvg(contents: string, displayPath = "SVG"): SvgInspection {
  const issues: ValidationIssue[] = [];
  const rootMatch = contents.match(/<svg\b[^>]*>/i);
  if (!rootMatch) {
    return { issues: [issue("error", "svg-root", `${displayPath}: missing <svg> root element.`)] };
  }

  const root = rootMatch[0];
  const width = readNumericAttribute(root, "width");
  const height = readNumericAttribute(root, "height");
  if (width === undefined || height === undefined) {
    issues.push(issue("error", "svg-dimensions", `${displayPath}: root width and height must be positive, unitless numbers.`));
  }

  const viewBoxMatch = root.match(/\bviewBox\s*=\s*["']([^"']+)["']/i);
  const viewBoxValues = viewBoxMatch?.[1].trim().split(/[\s,]+/).map(Number);
  const viewBox = viewBoxValues?.length === 4 && viewBoxValues.every(Number.isFinite)
    ? viewBoxValues as [number, number, number, number]
    : undefined;
  if (!viewBox || viewBox[2] <= 0 || viewBox[3] <= 0) {
    issues.push(issue("error", "svg-viewbox", `${displayPath}: viewBox must contain four numbers with positive width and height.`));
  } else if (width !== undefined && height !== undefined &&
    (viewBox[0] !== 0 || viewBox[1] !== 0 || viewBox[2] !== width || viewBox[3] !== height)) {
    issues.push(issue("error", "svg-viewbox-mismatch", `${displayPath}: viewBox must be \"0 0 ${width} ${height}\".`));
  }

  if (/<script\b/i.test(contents)) {
    issues.push(issue("error", "svg-script", `${displayPath}: scripts are not allowed.`));
  }
  if (/<image\b/i.test(contents)) {
    issues.push(issue("error", "svg-image", `${displayPath}: embedded or external <image> dependencies are not allowed.`));
  }
  if (/@font-face\b|<font\b|font-family\s*:/i.test(contents)) {
    issues.push(issue("error", "svg-font", `${displayPath}: external or embedded font dependencies are not allowed.`));
  }
  if (/\b(?:href|src)\s*=\s*["']\s*(?:https?:|\/\/|data:)/i.test(contents) || /url\(\s*["']?\s*(?:https?:|\/\/|data:)/i.test(contents)) {
    issues.push(issue("error", "svg-external-dependency", `${displayPath}: external URLs and data dependencies are not allowed.`));
  }
  if (/\b(?:href|src)\s*=\s*["'](?!\s*#)[^"']+["']/i.test(contents) || /@import\b/i.test(contents)) {
    issues.push(issue("error", "svg-external-dependency", `${displayPath}: referenced external SVG dependencies are not allowed.`));
  }
  if (/\bpreserveAspectRatio\s*=\s*["']none["']/i.test(root)) {
    issues.push(issue("error", "svg-preserve-aspect-ratio", `${displayPath}: preserveAspectRatio=\"none\" is not allowed.`));
  }

  return { width, height, viewBox, issues };
}

async function svgFiles(directory: string): Promise<string[]> {
  const { readdir } = await import("node:fs/promises");
  try {
    return (await readdir(directory, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".svg"))
      .map((entry) => entry.name)
      .sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

export async function validateVehiclePipeline(options: ValidateVehiclePipelineOptions): Promise<ValidationIssue[]> {
  const sourceDir = options.sourceDir ?? path.join(options.rootDir, "src/games/near-miss/ui");
  const runtimeDir = options.runtimeDir ?? path.join(options.rootDir, "public/games/near-miss/vehicles");
  const issues: ValidationIssue[] = [];
  const ids = new Map<unknown, number>();
  const spritePaths = new Map<unknown, number>();
  const referencedRuntimeFiles = new Set<string>();

  for (const config of options.configs) {
    ids.set(config.id, (ids.get(config.id) ?? 0) + 1);
    spritePaths.set(config.spritePath, (spritePaths.get(config.spritePath) ?? 0) + 1);
  }
  for (const [id, count] of ids) {
    if (count > 1) issues.push(issue("error", "duplicate-id", `Registry ID ${String(id)} is used by ${count} configs.`));
  }
  for (const [spritePath, count] of spritePaths) {
    if (count > 1) {
      issues.push(issue("error", "duplicate-sprite-path", `Sprite path ${String(spritePath)} is used by ${count} configs.`));
      issues.push(issue("warning", "shared-runtime-file", `Runtime sprite ${String(spritePath)} is referenced by multiple configs.`));
    }
  }

  const runtimeFiles = await svgFiles(runtimeDir);
  const sourceFiles = await svgFiles(sourceDir);
  const sourceSet = new Set(sourceFiles);

  for (const config of options.configs) {
    const configName = finiteString(config.id) ? config.id : "<invalid id>";
    if (!finiteString(config.id) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(config.id)) {
      issues.push(issue("warning", "registry-id-naming", `${configName}: registry ID does not use lowercase kebab-case.`));
    }
    if (!finiteString(config.spritePath) || !config.spritePath.startsWith(SPRITE_PATH_PREFIX) ||
      config.spritePath.includes("..") || path.posix.basename(config.spritePath) !== config.spritePath.slice(SPRITE_PATH_PREFIX.length) ||
      !config.spritePath.endsWith(".svg")) {
      issues.push(issue("error", "invalid-sprite-path", `${configName}: spritePath must be a direct SVG child of ${SPRITE_PATH_PREFIX}.`));
    } else {
      const filename = config.spritePath.slice(SPRITE_PATH_PREFIX.length);
      referencedRuntimeFiles.add(filename);
      const assetPath = path.join(runtimeDir, filename);
      try {
        const inspection = inspectRuntimeSvg(await readFile(assetPath, "utf8"), config.spritePath);
        issues.push(...inspection.issues);
        if (inspection.width !== undefined && inspection.height !== undefined) {
          if (!finiteNumber(config.spriteAspectRatio) || Math.abs(config.spriteAspectRatio - inspection.width / inspection.height) > 1e-6) {
            issues.push(issue("error", "aspect-ratio", `${configName}: spriteAspectRatio must equal SVG width / height (${inspection.width} / ${inspection.height}).`));
          }
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          issues.push(issue("error", "missing-runtime-svg", `${configName}: missing public SVG ${config.spritePath}.`));
        } else throw error;
      }

      if (!SVG_FILE_PATTERN.test(filename)) {
        issues.push(issue("warning", "runtime-naming", `${configName}: runtime filename ${filename} does not use lowercase kebab-case.`));
      }
      const expectedSource = EXPECTED_SOURCE_BY_RUNTIME[filename];
      if (expectedSource ? !sourceSet.has(expectedSource) : !sourceSet.has(filename)) {
        issues.push(issue("warning", "missing-source-counterpart", `${configName}: no apparent curated source asset was found for ${filename}.`));
      }
    }

    if (!finiteString(config.vehicleClass) || !options.vehicleClasses.includes(config.vehicleClass)) {
      issues.push(issue("error", "invalid-vehicle-class", `${configName}: invalid vehicleClass ${String(config.vehicleClass)}.`));
    }
    validateCollisionZones(configName, config.collisionZones, issues);
    if (finiteNumber(config.occupancyLengthScale) && config.occupancyLengthScale > options.packetMaxOccupancyLengthScale) {
      issues.push(issue("warning", "occupancy-length", `${configName}: occupancyLengthScale ${config.occupancyLengthScale} exceeds packet-spacing maximum ${options.packetMaxOccupancyLengthScale}.`));
    }
    for (const [property, value] of [["nearMissGrowX", config.nearMissGrowX], ["nearMissGrowY", config.nearMissGrowY]] as const) {
      if (finiteNumber(value) && (value < 11 || value > 18)) {
        issues.push(issue("warning", "near-miss-growth", `${configName}: ${property} ${value} is outside the current observed 11–18 px range.`));
      }
    }
  }

  for (const filename of runtimeFiles) {
    if (!referencedRuntimeFiles.has(filename)) {
      const compatibility = filename === "traffic-sedan.svg" ? " compatibility" : "";
      issues.push(issue("warning", "unregistered-runtime-svg", `Unregistered${compatibility} runtime SVG: ${filename}.`));
    }
  }
  const counterpartSources = new Set(Object.values(EXPECTED_SOURCE_BY_RUNTIME));
  for (const filename of sourceFiles) {
    const hasRuntime = runtimeFiles.includes(filename) || counterpartSources.has(filename);
    if (!hasRuntime) issues.push(issue("warning", "unmatched-source-svg", `Curated source SVG has no apparent runtime counterpart: ${filename}.`));
  }

  return issues;
}

function finiteString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function validateCollisionZones(configName: string, zones: unknown, issues: ValidationIssue[]) {
  if (!Array.isArray(zones) || zones.length === 0) {
    issues.push(issue("error", "missing-collision-zones", `${configName}: at least one collision zone is required.`));
    return;
  }
  zones.forEach((zone, index) => {
    if (!zone || typeof zone !== "object") {
      issues.push(issue("error", "malformed-collision-zone", `${configName}: collision zone ${index} must be an object.`));
      return;
    }
    const candidate = zone as Record<string, unknown>;
    if (!finiteString(candidate.id) || !finiteNumber(candidate.x) || !finiteNumber(candidate.y) ||
      !finiteNumber(candidate.width) || !finiteNumber(candidate.height)) {
      issues.push(issue("error", "malformed-collision-zone", `${configName}: collision zone ${index} requires a non-empty id and finite x, y, width, and height.`));
      return;
    }
    if (candidate.width <= 0 || candidate.height <= 0) {
      issues.push(issue("error", "non-positive-collision-zone", `${configName}: collision zone ${candidate.id} must have positive width and height.`));
    }
    const overflow = 0.1;
    if (candidate.x - candidate.width / 2 < -0.5 - overflow || candidate.x + candidate.width / 2 > 0.5 + overflow ||
      candidate.y - candidate.height / 2 < -0.5 - overflow || candidate.y + candidate.height / 2 > 0.5 + overflow) {
      issues.push(issue("warning", "collision-zone-overflow", `${configName}: collision zone ${candidate.id} extends significantly outside normalized sprite space.`));
    }
  });
}
