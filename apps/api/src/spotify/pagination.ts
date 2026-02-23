export async function fetchAllPages<T>(
    initialUrl: string,
    accessToken: string,
    limit = 50
): Promise<T[]> {
    let items: T[] = [];

    // Safely parse URL to handle existing query parameters
    const urlObj = new URL(initialUrl);
    if (!urlObj.searchParams.has('limit')) urlObj.searchParams.set('limit', limit.toString());
    if (!urlObj.searchParams.has('offset')) urlObj.searchParams.set('offset', '0');
    let nextUrl: string | null = urlObj.toString();

    let maxRetries = 3;

    while (nextUrl) {
        const res = await fetch(nextUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (res.status === 429) {
            if (maxRetries > 0) {
                maxRetries--;
                const retryAfter = res.headers.get("Retry-After");
                // Spotify Retry-After is in seconds. Fallback to 3 seconds if missing.
                const waitTimeMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 3000;
                console.warn(`[API] Rate limited (429) on pagination. Waiting ${waitTimeMs}ms before retrying. Retries left: ${maxRetries}`);
                await new Promise(resolve => setTimeout(resolve, waitTimeMs));
                continue; // Retry the same nextUrl
            }
        }

        if (!res.ok) {
            const body = await res.text();
            throw new Error(`Spotify API pagination failed (${res.status}): ${body}`);
        }

        const data = (await res.json()) as { items: T[]; next: string | null };
        items = items.concat(data.items);
        nextUrl = data.next; // Spotify returns the full URL for the next page, or null
    }

    return items;
}
