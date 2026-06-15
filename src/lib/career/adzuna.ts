import { readLocalValue, writeLocalValue } from "../storage/local";
import type { TargetRole, WorkModePreference } from "./careerState";

export type AdzunaListing = {
  category: string | null;
  company: string;
  contractTime: string | null;
  contractType: string | null;
  created: string;
  description: string;
  id: string;
  location: string;
  redirectUrl: string;
  salaryMax: number | null;
  salaryMin: number | null;
  title: string;
};

export type AdzunaSearchParams = {
  appId?: string;
  appKey?: string;
  country: string;
  location: string;
  proxyUrl?: string;
  query: string;
  resultsPerPage?: number;
  role: TargetRole;
  useCache?: boolean;
  workMode: WorkModePreference;
};

export type AdzunaSearchResult = {
  cachedAt: string;
  cacheKey: string;
  count: number;
  fromCache: boolean;
  listings: AdzunaListing[];
};

type RawAdzunaJob = {
  category?: { label?: string };
  company?: { display_name?: string };
  contract_time?: string;
  contract_type?: string;
  created?: string;
  description?: string;
  id?: string;
  location?: { display_name?: string };
  redirect_url?: string;
  salary_max?: number;
  salary_min?: number;
  title?: string;
};

type RawAdzunaResponse = {
  count?: number;
  results?: RawAdzunaJob[];
};

type AdzunaCacheEntry = {
  cachedAt: string;
  count: number;
  listings: AdzunaListing[];
};

const cacheKey = "nebula-hub:career-os:adzuna-cache:v1";
const cacheTtlMs = 30 * 60 * 1000;

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function getSearchCacheKey({
  country,
  location,
  query,
  role,
  workMode,
}: Pick<AdzunaSearchParams, "country" | "location" | "query" | "role" | "workMode">) {
  return [
    country,
    role,
    workMode,
    normalizeText(location).toLowerCase(),
    normalizeText(query).toLowerCase(),
  ].join("::");
}

function readAdzunaCache() {
  return readLocalValue<Record<string, AdzunaCacheEntry>>(cacheKey, {});
}

function writeAdzunaCache(cache: Record<string, AdzunaCacheEntry>) {
  writeLocalValue(cacheKey, cache);
}

function isFresh(cachedAt: string) {
  const time = new Date(cachedAt).getTime();
  return Number.isFinite(time) && Date.now() - time < cacheTtlMs;
}

function cleanDescription(description?: string) {
  return (
    description
      ?.replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim() || "No description snippet provided."
  );
}

function normalizeListing(job: RawAdzunaJob): AdzunaListing {
  return {
    category: job.category?.label ?? null,
    company: job.company?.display_name?.trim() || "Unknown company",
    contractTime: job.contract_time ?? null,
    contractType: job.contract_type ?? null,
    created: job.created ?? "",
    description: cleanDescription(job.description),
    id: job.id ?? `adzuna:${job.redirect_url ?? job.title ?? Date.now()}`,
    location: job.location?.display_name?.trim() || "Location not listed",
    redirectUrl: job.redirect_url ?? "",
    salaryMax: typeof job.salary_max === "number" ? job.salary_max : null,
    salaryMin: typeof job.salary_min === "number" ? job.salary_min : null,
    title: job.title?.trim() || "Untitled AWS role",
  };
}

async function readAdzunaError(response: Response) {
  try {
    const data = (await response.json()) as { error?: string; message?: string };
    return data.error || data.message || `Adzuna returned ${response.status}.`;
  } catch {
    return `Adzuna returned ${response.status}.`;
  }
}

export async function searchAdzunaListings({
  appId = "",
  appKey = "",
  country,
  location,
  proxyUrl,
  query,
  resultsPerPage = 10,
  role,
  useCache = true,
  workMode,
}: AdzunaSearchParams): Promise<AdzunaSearchResult> {
  const normalizedCountry = country.trim().toLowerCase() || "us";
  const normalizedQuery = normalizeText(query);
  const normalizedLocation = normalizeText(location);
  const searchCacheKey = getSearchCacheKey({
    country: normalizedCountry,
    location: normalizedLocation,
    query: normalizedQuery,
    role,
    workMode,
  });
  const cache = readAdzunaCache();
  const cached = cache[searchCacheKey];

  if (useCache && cached && isFresh(cached.cachedAt)) {
    return {
      ...cached,
      cacheKey: searchCacheKey,
      fromCache: true,
    };
  }

  const normalizedProxy = proxyUrl?.trim();
  const usesSecureProxy = Boolean(normalizedProxy && !normalizedProxy.startsWith("/adzuna-api"));
  const endpoint = `/v1/api/jobs/${normalizedCountry}/search/1`;
  const baseUrl = normalizedProxy
    ? `${normalizedProxy.replace(/\/$/, "")}${usesSecureProxy ? "" : endpoint}`
    : `https://api.adzuna.com${endpoint}`;
  const url = new URL(baseUrl, window.location.origin);

  if (!usesSecureProxy) {
    url.searchParams.set("app_id", appId);
    url.searchParams.set("app_key", appKey);
  }

  url.searchParams.set("country", normalizedCountry);
  url.searchParams.set("results_per_page", String(resultsPerPage));
  url.searchParams.set("sort_by", "date");
  url.searchParams.set("what", normalizedQuery);

  if (normalizedLocation) {
    url.searchParams.set("where", normalizedLocation);
  }

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(await readAdzunaError(response));
  }

  const data = (await response.json()) as RawAdzunaResponse;
  const listings = (data.results ?? [])
    .map(normalizeListing)
    .filter((listing) => listing.redirectUrl);
  const nextEntry = {
    cachedAt: new Date().toISOString(),
    count: data.count ?? listings.length,
    listings,
  };

  writeAdzunaCache({
    ...cache,
    [searchCacheKey]: nextEntry,
  });

  return {
    ...nextEntry,
    cacheKey: searchCacheKey,
    fromCache: false,
  };
}
