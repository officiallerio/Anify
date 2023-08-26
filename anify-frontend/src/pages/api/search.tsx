import { type ServerResponse } from "http";
import { env } from "~/env.mjs";
import { type Anime, type Manga, type Format, type MediaStatus } from "~/types";

export default async function handler(request: Request, response: ServerResponse) {
    if (!request.body.query) {
        response.writeHead(400, { "Content-Type": "application/json" });
        response.write(JSON.stringify({ message: "Missing query." }));
        response.end();
        return;
    }

    if (!request.body.type) {
        response.writeHead(400, { "Content-Type": "application/json" });
        response.write(JSON.stringify({ message: "Missing type (anime/manga)." }));
        response.end();
        return;
    }

    const perPage: number = request.body.perPage ?? 10;
    const page: number = request.body.page ?? 0;
    
    const genres: string[] = request.body.genres ?? [];
    const genresExcluded: string[] = request.body.genresExcluded ?? [];
    const tags: string[] = request.body.tags ?? [];
    const tagsExcluded: string[] = request.body.tagsExcluded ?? [];

    const formats: string[] = request.body.formats ?? [];

    let filter = formats.length > 0 ? `(format = ${formats.join(" OR format = ")})` : "";
    filter += genres.length > 0 ? ` AND (genres = ${genres.join(" OR genres = ")})` : "";
    filter += genresExcluded.length > 0 ? ` AND NOT (genres = ${genresExcluded.join(" OR genres = ")})` : "";
    filter += tags.length > 0 ? ` AND (tags = ${tags.join(" OR tags = ")})` : "";
    filter += tagsExcluded.length > 0 ? ` AND NOT (tags = ${tagsExcluded.join(" OR tags = ")})` : "";

    if (env.USE_MEILISEARCH === "true") {
        try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const data: SearchResult = await (await fetch(`${env.MEILISEARCH_URL}/indexes/${request.body.type}/search`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${env.MEILISEARCH_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    q: request.body.query,
                    limit: perPage,
                    offset: page * perPage,
                    filter
                })
            })).json();
    
            if (data.hits.length === 0) throw new Error("No results found.");
    
            response.writeHead(200, { "Content-Type": "application/json" });
            response.write(JSON.stringify(data));
            response.end();
        } catch (e) {
            const data = await (await fetch(`${env.BACKEND_URL}/search-advanced?apikey=${env.API_KEY}`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${env.MEILISEARCH_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    type: request.body.type === "manga" ? formats.includes("NOVEL") ? "novel" : "manga" : "anime",
                    query: request.body.query,
                    format: formats,
                    page,
                    perPage,
                    genres,
                    genresExcluded,
                    tags,
                    tagsExcluded,
                    year: 0,
                })
            })).json() as Anime[] | Manga[];
    
            const newData = {
                hits: data,
                query: request.body.query,
                processingTimeMs: 0,
                limit: perPage,
                offset: page * perPage,
                estimatedTotalHits: data.length,
            }
    
            response.writeHead(200, { "Content-Type": "application/json" });
            response.write(JSON.stringify(newData));
            response.end();
        }
    } else {
        const data = await (await fetch(`${env.BACKEND_URL}/search-advanced?apikey=${env.API_KEY}`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${env.MEILISEARCH_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                type: request.body.type === "manga" ? formats.includes("NOVEL") ? "novel" : "manga" : "anime",
                query: request.body.query,
                format: formats,
                page,
                perPage,
                genres,
                genresExcluded,
                tags,
                tagsExcluded,
                year: 0,
            })
        })).json() as Anime[] | Manga[];

        const newData = {
            hits: data,
            query: request.body.query,
            processingTimeMs: 0,
            limit: perPage,
            offset: page * perPage,
            estimatedTotalHits: data.length,
        }

        response.writeHead(200, { "Content-Type": "application/json" });
        response.write(JSON.stringify(newData));
        response.end();
    }
}

interface Request {
    body: {
        query: string;
        type: string;
        perPage?: number;
        page?: number;
        genres?: string[];
        genresExcluded?: string[];
        tags?: string[];
        tagsExcluded?: string[];
        formats?: string[];
    }
}

interface Title {
    native: string;
    romaji: string;
    english: string;
}

export interface SearchItem {
    title: Title;
    description: string;
    synonyms: string[];
    id: string;
    coverImage: string;
    bannerImage: string;
    year: number;
    genres: string[];
    tags: string[];
    status: MediaStatus;
    season: string;
    format: Format;
    rating: {
        mal: number;
        kitsu: number;
        anilist: number;
        simkl?: number;
    };
    popularity: {
        mal: number;
        kitsu: number;
        anilist: number;
        simkl?: number;
    };
    color: string;
    mappings: {
        id: string;
        providerId: string;
        similarity: number;
        providerType: string;
    }[];
}

export interface SearchResult {
    hits: SearchItem[];
    query: string;
    processingTimeMs: number;
    limit: number;
    offset: number;
    estimatedTotalHits: number;
}