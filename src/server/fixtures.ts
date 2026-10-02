// 读取并校验 fixtures/*.json。seed、validate-fixtures、授权预览共用。
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CatalogFixture, RatesFixture, ScenariosFixture } from "@/contracts/schemas";

function readJson(name: string): unknown {
  const raw = readFileSync(join(process.cwd(), "fixtures", name), "utf8");
  return JSON.parse(raw);
}

export function loadCatalog() {
  return CatalogFixture.parse(readJson("catalog.json"));
}
export function loadRates() {
  return RatesFixture.parse(readJson("rates.json"));
}
export function loadScenarios() {
  return ScenariosFixture.parse(readJson("scenarios.json"));
}

/** 预览场景只在进程内缓存一次（文件不会在运行时变化） */
let scenariosCache: ReturnType<typeof loadScenarios> | null = null;
export function getScenarios() {
  if (!scenariosCache) scenariosCache = loadScenarios();
  return scenariosCache;
}
