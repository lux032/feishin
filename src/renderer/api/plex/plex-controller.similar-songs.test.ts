import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Regression test for the Plex sonic instant-mix.
 *
 * `getSimilarSongs` was a stub returning []; it now calls Plex's audio-analysis
 * nearest-neighbour endpoint and maps the result to Songs. This locks that
 * contract: the network boundary (`pxApiClient().getNearestTracks`) is mocked
 * with the parsed-XML shape Plex actually returns, and the REAL controller
 * transform + `pxNormalize.song` run against it.
 */

// Network boundary: control what the /nearest call returns.
const getNearestTracks = vi.fn();
vi.mock('/@/renderer/api/plex/plex-api', () => ({
    pxApiClient: () => ({ getNearestTracks }),
}));
// Avoid pulling i18next init into the test (getSimilarSongs doesn't use it).
vi.mock('/@/i18n/i18n', () => ({ default: { t: (key: string) => key } }));

import { PlexController } from '/@/renderer/api/plex/plex-controller';

const server = {
    credential: 'TOKEN',
    id: 'srv1',
    type: 'plex',
    url: 'https://music.fiber.house/plex',
} as any;
const apiClientProps = { server, signal: undefined } as any;

// A Plex track in the shape the fork's XMLParser produces (attributes under `$`,
// Track/Media/Part coerced to arrays by the parser's isArray config).
const track = (ratingKey: string, title: string, distance: number, artist = 'Artist') => ({
    $: {
        distance: String(distance),
        duration: '240000',
        grandparentTitle: artist,
        ratingKey,
        title,
        type: 'track',
    },
    Media: [
        {
            $: { audioChannels: '2', audioCodec: 'mp3', bitrate: '320', container: 'mp3' },
            Part: [
                {
                    $: {
                        container: 'mp3',
                        key: `/library/parts/${ratingKey}/1/file.mp3`,
                        size: '1000',
                    },
                },
            ],
        },
    ],
});
const nearestBody = (tracks: unknown[]) => ({
    MediaContainer: { $: { size: String(tracks.length) }, Track: tracks },
});
const call = (songId: string, count?: number) =>
    (PlexController.getSimilarSongs as any)({ apiClientProps, query: { count, songId } });

describe('PlexController.getSimilarSongs (sonic /nearest mix)', () => {
    beforeEach(() => getNearestTracks.mockReset());

    it('queries the sonic endpoint with the seed id + count and maps results in distance order', async () => {
        getNearestTracks.mockResolvedValue({
            body: nearestBody([
                track('11', 'A', 0.1),
                track('22', 'B', 0.12),
                track('33', 'C', 0.14),
            ]),
            status: 200,
        });

        const songs = await call('99', 5);

        expect(getNearestTracks).toHaveBeenCalledWith('99', { limit: 5 });
        expect(songs.map((s: any) => s.id)).toEqual(['11', '22', '33']); // order preserved
        expect(songs.map((s: any) => s.name)).toEqual(['A', 'B', 'C']);
        expect(songs.every((s: any) => s._serverType === 'plex')).toBe(true);
        // stream URL is built same-origin from SERVER_URL + Part.key + token
        expect(songs[0].streamUrl).toBe(
            'https://music.fiber.house/plex/library/parts/11/1/file.mp3?X-Plex-Token=TOKEN',
        );
    });

    it('excludes the seed track when Plex includes it in the neighbours', async () => {
        getNearestTracks.mockResolvedValue({
            body: nearestBody([track('99', 'seed', 0.0), track('11', 'A', 0.1)]),
            status: 200,
        });

        const songs = await call('99', 5);

        expect(songs.map((s: any) => s.id)).toEqual(['11']);
    });

    it('degrades to [] when sonic analysis is unavailable (non-200)', async () => {
        getNearestTracks.mockResolvedValue({ body: undefined, status: 404 });
        expect(await call('99', 5)).toEqual([]);
    });

    it('returns [] for an empty MediaContainer (no Track element)', async () => {
        getNearestTracks.mockResolvedValue({
            body: { MediaContainer: { $: { size: '0' } } },
            status: 200,
        });
        expect(await call('99', 5)).toEqual([]);
    });

    it('handles a single-track result without throwing', async () => {
        getNearestTracks.mockResolvedValue({
            body: nearestBody([track('11', 'A', 0.1)]),
            status: 200,
        });
        const songs = await call('99', 1);
        expect(songs).toHaveLength(1);
        expect(songs[0].id).toBe('11');
    });
});
