import type { CTANPackage, CTANSearchResult } from "./types.js";

// ============================================
// CTAN Client
// ============================================

const CTAN_API_BASE = "https://ctan.org/json/2.0";

interface CTANPackageResponse {
    id: string;
    name: string;
    caption?: string;
    description?: { text?: string };
    version?: { number?: string };
    license?: string | string[];
    documentation?: { href?: string }[];
}

interface CTANSearchResponse {
    hits?: Array<{
        id: string;
        name: string;
        caption?: string;
    }>;
}

export class CTANClient {
    private baseUrl: string;
    private cache: Map<string, { data: any; timestamp: number }>;
    private cacheMaxAge: number;
    private cacheMaxSize: number;

    constructor(baseUrl?: string, cacheMaxAge?: number, cacheMaxSize?: number) {
        this.baseUrl = baseUrl || CTAN_API_BASE;
        this.cache = new Map();
        this.cacheMaxAge = cacheMaxAge || 24 * 60 * 60 * 1000; // 24 hours
        this.cacheMaxSize = cacheMaxSize || 500;
    }

    // === Search Packages ===

    async searchPackages(query: string, limit = 20): Promise<CTANSearchResult> {
        const cacheKey = `search:${query}:${limit}`;
        const cached = this.getFromCache<CTANSearchResult>(cacheKey);
        if (cached) return cached;

        try {
            const response = await fetch(
                `${this.baseUrl}/search/pkg?phrase=${encodeURIComponent(query)}`
            );

            if (!response.ok) {
                throw new Error(`CTAN search failed: ${response.status}`);
            }

            const data = await response.json() as CTANSearchResponse;

            const packages: CTANPackage[] = (data.hits || []).slice(0, limit).map((hit) => ({
                name: hit.name,
                caption: hit.caption || "",
                description: "",
            }));

            const result: CTANSearchResult = {
                packages,
                total: data.hits?.length || 0,
            };

            this.setCache(cacheKey, result);
            return result;
        } catch (error: any) {
            return {
                packages: [],
                total: 0,
            };
        }
    }

    // === Get Package Info ===

    async getPackageInfo(name: string): Promise<CTANPackage | null> {
        const cacheKey = `pkg:${name}`;
        const cached = this.getFromCache<CTANPackage>(cacheKey);
        if (cached) return cached;

        try {
            const response = await fetch(`${this.baseUrl}/pkg/${encodeURIComponent(name)}`);

            if (!response.ok) {
                if (response.status === 404) {
                    return null;
                }
                throw new Error(`CTAN request failed: ${response.status}`);
            }

            const data = await response.json() as CTANPackageResponse;

            const pkg: CTANPackage = {
                name: data.name || data.id,
                caption: data.caption || "",
                description: data.description?.text || "",
                version: data.version?.number,
                license: Array.isArray(data.license) ? data.license.join(", ") : data.license,
                documentationUrl: data.documentation?.[0]?.href,
            };

            this.setCache(cacheKey, pkg);
            return pkg;
        } catch (error: any) {
            return null;
        }
    }

    // === Get Popular Packages ===

    getPopularPackages(): CTANPackage[] {
        return [
            {
                name: "amsmath",
                caption: "AMS mathematical facilities",
                description: "Enhanced math typesetting for LaTeX",
            },
            {
                name: "graphicx",
                caption: "Enhanced graphics support",
                description: "Include and manipulate images",
            },
            {
                name: "hyperref",
                caption: "Hypertext links in LaTeX",
                description: "Create hyperlinks and PDF bookmarks",
            },
            {
                name: "tikz",
                caption: "TikZ drawing package",
                description: "Create graphics programmatically",
            },
            {
                name: "booktabs",
                caption: "Professional tables",
                description: "Publication-quality tables",
            },
            {
                name: "biblatex",
                caption: "Bibliographies in LaTeX",
                description: "Modern bibliography management",
            },
            {
                name: "geometry",
                caption: "Page dimensions",
                description: "Set page margins and layout",
            },
            {
                name: "listings",
                caption: "Source code listings",
                description: "Typeset source code with syntax highlighting",
            },
        ];
    }

    // === Cache Helpers ===

    private getFromCache<T>(key: string): T | null {
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < this.cacheMaxAge) {
            return cached.data as T;
        }
        return null;
    }

    private setCache(key: string, data: any): void {
        // Evict oldest entries if cache is too large
        if (this.cache.size >= this.cacheMaxSize) {
            const entries = Array.from(this.cache.entries())
                .sort(([, a], [, b]) => a.timestamp - b.timestamp);
            const toRemove = entries.slice(0, Math.floor(this.cacheMaxSize * 0.2));
            for (const [k] of toRemove) {
                this.cache.delete(k);
            }
        }
        this.cache.set(key, { data, timestamp: Date.now() });
    }

    clearCache(): void {
        this.cache.clear();
    }
}

// Export singleton
export const ctanClient = new CTANClient();
