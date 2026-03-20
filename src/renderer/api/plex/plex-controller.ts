import { z } from 'zod';

import { pxApiClient } from '/@/renderer/api/plex/plex-api';
import { getServerUrl } from '/@/renderer/utils/normalize-server-url';
import { pxNormalize } from '/@/shared/api/plex/plex-normalize';
import { plexType, PX_TRACK_RATING_FAVORITE } from '/@/shared/api/plex/plex-types';
import {
    AlbumListSort,
    AlbumArtistListSort,
    albumArtistListSortMap,
    albumListSortMap,
    Folder,
    genreListSortMap,
    ImageArgs,
    ImageRequest,
    InternalControllerEndpoint,
    LibraryItem,
    playlistListSortMap,
    ServerType,
    SongListSort,
    songListSortMap,
    SortOrder,
    sortOrderMap,
} from '/@/shared/types/domain-types';

const getPlexImageRequest = ({
    apiClientProps: { server },
    baseUrl,
    query,
}: {
    apiClientProps: { server: any };
    baseUrl?: string;
    query: { id: string; size?: number };
}): ImageRequest | null => {
    const { id, size } = query;

    if (!server) {
        return null;
    }

    const url = baseUrl || getServerUrl(server);
    if (!url) {
        return null;
    }

    const mediaPath = /^https?:\/\//.test(id)
        ? id
        : `${url}${id.startsWith('/') ? id : `/library/metadata/${id}/thumb`}`;
    const separator = mediaPath.includes('?') ? '&' : '?';
    const imageSource = `${mediaPath}${separator}X-Plex-Token=${server.credential}`;

    return {
        cacheKey: ['plex', server.id, baseUrl || '', id, size || ''].join(':'),
        headers: { 'X-Plex-Token': server.credential },
        url: imageSource,
    };
};

const getLibraryId = (musicFolderId?: string | string[]): string | undefined => {
    if (!musicFolderId) return undefined;
    if (Array.isArray(musicFolderId)) {
        return musicFolderId[0];
    }
    return musicFolderId;
};

const getPlexAlbumSort = (sortBy?: AlbumListSort, sortOrder?: SortOrder) => {
    const plexSortOrder = sortOrder ? sortOrderMap.plex[sortOrder] : undefined;

    if (sortBy === 'playCount') {
        return `viewCount:${plexSortOrder || sortOrderMap.plex[SortOrder.DESC]}`;
    }

    if (sortBy === 'recentlyPlayed') {
        return `lastViewedAt:${plexSortOrder || sortOrderMap.plex[SortOrder.DESC]}`;
    }

    const mappedSort = sortBy ? albumListSortMap.plex[sortBy] : undefined;
    if (!mappedSort) {
        return undefined;
    }

    if (mappedSort === 'random') {
        return mappedSort;
    }

    return `${mappedSort}:${plexSortOrder || sortOrderMap.plex[SortOrder.ASC]}`;
};

const getPlexSongSort = (sortBy?: SongListSort, sortOrder?: SortOrder) => {
    const plexSortOrder = sortOrder ? sortOrderMap.plex[sortOrder] : undefined;

    if (sortBy === 'recentlyPlayed') {
        return `lastViewedAt:${plexSortOrder || sortOrderMap.plex[SortOrder.DESC]}`;
    }

    const mappedSort = sortBy ? songListSortMap.plex[sortBy] : undefined;
    if (!mappedSort) {
        return undefined;
    }

    if (mappedSort === 'random') {
        return mappedSort;
    }

    return `${mappedSort}:${plexSortOrder || sortOrderMap.plex[SortOrder.ASC]}`;
};

export const PlexController: InternalControllerEndpoint = {
    addToPlaylist: async (args) => {
        throw new Error('Not implemented for Plex');
    },

    authenticate: async (url, body) => {
        const cleanServerUrl = url.replace(/\/$/, '');

        // body.token is the Plex token for token-based auth
        // body.username/password are for legacy auth (not used for Plex)
        const token = (body as any).token || body.password;

        if (!token) {
            throw new Error('Plex token is required');
        }

        // Verify token by making a request to the server
        const axiosClient = (await import('axios')).default;

        try {
            const response = await axiosClient.get(`${cleanServerUrl}/identity`, {
                headers: {
                    Accept: 'application/json',
                    'X-Plex-Token': token,
                },
            });

            const machineIdentifier =
                response.data?.MediaContainer?.machineIdentifier || 'plex-server';

            return {
                credential: token,
                isAdmin: true,
                userId: machineIdentifier,
                username: 'Plex User',
            };
        } catch (error) {
            throw new Error(
                'Failed to authenticate with Plex token. Please check your token and server URL.',
            );
        }
    },

    createFavorite: async (args) => {
        const { apiClientProps, query } = args;

        const apiClient = pxApiClient(apiClientProps);
        for (const id of query.id) {
            await apiClient.setRating(id, PX_TRACK_RATING_FAVORITE);
        }

        return null;
    },

    createInternetRadioStation: async (args) => {
        throw new Error('Not implemented for Plex');
    },

    createPlaylist: async (args) => {
        throw new Error('Not implemented for Plex');
    },

    deleteFavorite: async (args) => {
        const { apiClientProps, query } = args;

        const apiClient = pxApiClient(apiClientProps);
        for (const id of query.id) {
            await apiClient.setRating(id, 0);
        }

        return null;
    },

    deleteInternetRadioStation: async (args) => {
        throw new Error('Not implemented for Plex');
    },

    deletePlaylist: async (args) => {
        throw new Error('Not implemented for Plex');
    },

    getAlbumArtistDetail: async (args) => {
        const { apiClientProps, query } = args;
        const serverUrl = getServerUrl(apiClientProps.server);

        const apiClient = pxApiClient(apiClientProps);
        const res = await apiClient.getMetadata(query.id);

        if (res.status !== 200) {
            throw new Error('Failed to get album artist detail');
        }

        const artist = res.body?.MediaContainer?.Directory?.[0];
        if (!artist) {
            throw new Error('Artist not found');
        }

        return pxNormalize.albumArtist(
            artist,
            apiClientProps.server,
            serverUrl,
            apiClientProps.server?.credential,
        );
    },

    getAlbumArtistInfo: async (args) => {
        return null;
    },

    getAlbumArtistList: async (args) => {
        const { apiClientProps, query } = args;
        const serverUrl = getServerUrl(apiClientProps.server);
        const sectionId = getLibraryId(query.musicFolderId) || '1';

        const apiClient = pxApiClient(apiClientProps);
        const res = await apiClient.getArtistList({
            sectionId,
            size: query.limit || 50,
            start: query.startIndex || 0,
        });

        if (res.status !== 200) {
            throw new Error('Failed to get album artist list');
        }

        const container = res.body?.MediaContainer;
        const items = container?.Directory || [];

        return {
            items: items.map((item) =>
                pxNormalize.albumArtist(
                    item,
                    apiClientProps.server,
                    serverUrl,
                    apiClientProps.server?.credential,
                ),
            ),
            startIndex: query.startIndex,
            totalRecordCount: Number(container?.$.totalSize || items.length),
        };
    },

    getAlbumArtistListCount: async ({ apiClientProps, query }) =>
        PlexController.getAlbumArtistList({
            apiClientProps,
            query: { ...query, limit: 1, startIndex: 0 },
        }).then((result) => result?.totalRecordCount ?? 0),

    getAlbumDetail: async (args) => {
        const { apiClientProps, query } = args;
        const serverUrl = getServerUrl(apiClientProps.server);

        const apiClient = pxApiClient(apiClientProps);

        const albumRes = await apiClient.getAlbumTracks(query.id);
        if (albumRes.status !== 200) {
            throw new Error('Failed to get album detail');
        }

        const tracksContainer = albumRes.body?.MediaContainer;
        const tracks = tracksContainer?.Track || [];

        const songs = tracks.map((track) =>
            pxNormalize.song(
                track,
                apiClientProps.server,
                serverUrl,
                apiClientProps.server?.credential,
            ),
        );

        if (songs.length === 0) {
            throw new Error('Album not found');
        }

        const firstTrack = songs[0];
        return {
            _itemType: LibraryItem.ALBUM,
            _serverId: apiClientProps.server?.id || '',
            _serverType: ServerType.PLEX,
            albumArtistName: firstTrack.albumArtistName,
            albumArtists: firstTrack.albumArtists,
            artists: firstTrack.albumArtists,
            comment: null,
            createdAt: firstTrack.createdAt,
            duration: songs.reduce((acc, s) => acc + (s.duration || 0), 0),
            explicitStatus: null,
            genres: [],
            id: query.id,
            imageId: firstTrack.imageId,
            imageUrl: firstTrack.imageUrl,
            isCompilation: null,
            lastPlayedAt: null,
            mbzId: null,
            mbzReleaseGroupId: null,
            name: firstTrack.album || '',
            originalDate: firstTrack.releaseDate,
            originalYear: firstTrack.releaseYear,
            participants: null,
            playCount: songs.reduce((acc, s) => acc + (s.playCount || 0), 0),
            recordLabels: [],
            releaseDate: firstTrack.releaseDate,
            releaseType: null,
            releaseTypes: [],
            releaseYear: firstTrack.releaseYear,
            size: songs.reduce((acc, s) => acc + (s.size || 0), 0),
            songCount: songs.length,
            songs,
            sortName: firstTrack.album || '',
            tags: null,
            updatedAt: firstTrack.updatedAt,
            userFavorite: false,
            userRating: null,
            version: null,
        };
    },

    getAlbumList: async (args) => {
        const { apiClientProps, query } = args;
        const serverUrl = getServerUrl(apiClientProps.server);
        const sectionId = getLibraryId(query.musicFolderId) || '1';

        const apiClient = pxApiClient(apiClientProps);
        const res = await apiClient.getAlbumList({
            artistId: query.artistIds?.length === 1 ? query.artistIds[0] : undefined,
            sectionId,
            size: query.limit === -1 ? 100 : query.limit || 50,
            sort: getPlexAlbumSort(query.sortBy, query.sortOrder),
            start: query.startIndex || 0,
        });

        if (res.status !== 200) {
            throw new Error('Failed to get album list');
        }

        const container = res.body?.MediaContainer;
        const items = container?.Directory || [];

        return {
            items: items.map((item) =>
                pxNormalize.album(
                    item,
                    apiClientProps.server,
                    serverUrl,
                    apiClientProps.server?.credential,
                ),
            ),
            startIndex: query.startIndex,
            totalRecordCount: Number(container?.$.totalSize || items.length),
        };
    },

    getAlbumListCount: async ({ apiClientProps, query }) =>
        PlexController.getAlbumList({
            apiClientProps,
            query: { ...query, limit: 1, startIndex: 0 },
        }).then((result) => result?.totalRecordCount ?? 0),

    getAlbumRadio: async (args) => {
        const { apiClientProps, query } = args;
        const serverUrl = getServerUrl(apiClientProps.server);

        const apiClient = pxApiClient(apiClientProps);
        const res = await apiClient.getSimilarAlbums(query.albumId);

        if (res.status !== 200) {
            throw new Error('Failed to get album radio songs');
        }

        const container = res.body?.MediaContainer;
        const items = container?.Directory || [];

        return items
            .slice(0, query.count)
            .map((item) =>
                pxNormalize.album(
                    item,
                    apiClientProps.server,
                    serverUrl,
                    apiClientProps.server?.credential,
                ),
            );
    },

    getArtistList: async (args) => {
        const { apiClientProps, query } = args;
        const serverUrl = getServerUrl(apiClientProps.server);
        const sectionId = getLibraryId(query.musicFolderId) || '1';

        const apiClient = pxApiClient(apiClientProps);
        const res = await apiClient.getArtistList({
            sectionId,
            size: query.limit || 50,
            sort:
                query.sortBy && albumArtistListSortMap.plex[query.sortBy as AlbumArtistListSort]
                    ? `${albumArtistListSortMap.plex[query.sortBy as AlbumArtistListSort]}:${sortOrderMap.plex[query.sortOrder || SortOrder.ASC]}`
                    : undefined,
            start: query.startIndex || 0,
        });

        if (res.status !== 200) {
            throw new Error('Failed to get artist list');
        }

        const container = res.body?.MediaContainer;
        const items = container?.Directory || [];

        return {
            items: items.map((item) =>
                pxNormalize.albumArtist(
                    item,
                    apiClientProps.server,
                    serverUrl,
                    apiClientProps.server?.credential,
                ),
            ),
            startIndex: query.startIndex,
            totalRecordCount: Number(container?.$.totalSize || items.length),
        };
    },

    getArtistListCount: async ({ apiClientProps, query }) =>
        PlexController.getArtistList({
            apiClientProps,
            query: { ...query, limit: 1, startIndex: 0 },
        }).then((result) => result?.totalRecordCount ?? 0),

    getArtistRadio: async (args) => {
        return [];
    },

    getDownloadUrl: (args) => {
        const { apiClientProps, query } = args;
        const serverUrl = getServerUrl(apiClientProps.server);
        return `${serverUrl}/library/metadata/${query.id}/download?X-Plex-Token=${apiClientProps.server?.credential}`;
    },

    getFolder: async (args) => {
        throw new Error('Not implemented for Plex');
    },

    getGenreList: async (args) => {
        const { apiClientProps, query } = args;
        const serverUrl = getServerUrl(apiClientProps.server);
        const sectionId = getLibraryId(query.musicFolderId) || '1';

        const apiClient = pxApiClient(apiClientProps);
        const res = await apiClient.getGenreList({ sectionId });

        if (res.status !== 200) {
            throw new Error('Failed to get genre list');
        }

        const container = res.body?.MediaContainer;
        const items = (container?.Directory || []).filter((item) => item?.$);

        return {
            items: items.map((item) => pxNormalize.genre(item, apiClientProps.server)),
            startIndex: 0,
            totalRecordCount: items.length,
        };
    },

    getImageRequest: getPlexImageRequest,

    getImageUrl: (args) => getPlexImageRequest(args)?.url || null,

    getInternetRadioStations: async (args) => {
        return [];
    },

    getLyrics: async (args) => {
        return null;
    },

    getMusicFolderList: async (args) => {
        const { apiClientProps } = args;

        const apiClient = pxApiClient(apiClientProps);
        const res = await apiClient.getMusicFolderList();

        if (res.status !== 200) {
            throw new Error('Failed to get music folder list');
        }

        const container = res.body?.MediaContainer;
        const items = container?.Directory || [];

        return {
            items: items
                .filter((d) => d.$.type === 'artist')
                .map((d) => pxNormalize.musicFolder(d)),
            startIndex: 0,
            totalRecordCount: items.filter((d) => d.$.type === 'artist').length,
        };
    },

    getPlaylistDetail: async (args) => {
        const { apiClientProps, query } = args;
        const serverUrl = getServerUrl(apiClientProps.server);

        const apiClient = pxApiClient(apiClientProps);
        const playlistRes = await apiClient.getPlaylistList();

        if (playlistRes.status !== 200) {
            throw new Error('Failed to get playlist detail');
        }

        const playlists = playlistRes.body?.MediaContainer?.Playlist || [];
        const playlist = playlists.find((p) => p.$.ratingKey === query.id);

        if (!playlist) {
            throw new Error('Playlist not found');
        }

        return pxNormalize.playlist(
            playlist,
            apiClientProps.server,
            serverUrl,
            apiClientProps.server?.credential,
        );
    },

    getPlaylistList: async (args) => {
        const { apiClientProps, query } = args;
        const serverUrl = getServerUrl(apiClientProps.server);

        const apiClient = pxApiClient(apiClientProps);
        const res = await apiClient.getPlaylistList();

        if (res.status !== 200) {
            throw new Error('Failed to get playlist list');
        }

        const container = res.body?.MediaContainer;
        const items = container?.Playlist || [];

        return {
            items: items.map((item) =>
                pxNormalize.playlist(
                    item,
                    apiClientProps.server,
                    serverUrl,
                    apiClientProps.server?.credential,
                ),
            ),
            startIndex: 0,
            totalRecordCount: items.length,
        };
    },

    getPlaylistListCount: async ({ apiClientProps, query }) =>
        PlexController.getPlaylistList({
            apiClientProps,
            query: { ...query, limit: 1, startIndex: 0 },
        }).then((result) => result?.totalRecordCount ?? 0),

    getPlaylistSongList: async (args) => {
        const { apiClientProps, query } = args;
        const serverUrl = getServerUrl(apiClientProps.server);

        const apiClient = pxApiClient(apiClientProps);
        const res = await apiClient.getPlaylistTracks(query.id);

        if (res.status !== 200) {
            throw new Error('Failed to get playlist song list');
        }

        const container = res.body?.MediaContainer;
        const items = container?.Track || [];

        return {
            items: items.map((item) =>
                pxNormalize.song(
                    item,
                    apiClientProps.server,
                    serverUrl,
                    apiClientProps.server?.credential,
                ),
            ),
            startIndex: 0,
            totalRecordCount: items.length,
        };
    },

    getPlayQueue: async () => {
        throw new Error('Not supported');
    },

    getRandomSongList: async (args) => {
        const { apiClientProps, query } = args;
        const serverUrl = getServerUrl(apiClientProps.server);
        const sectionId = getLibraryId(query.musicFolderId) || '1';

        const apiClient = pxApiClient(apiClientProps);
        const res = await apiClient.getSongList({
            sectionId,
            size: query.limit || 50,
            start: 0,
        });

        if (res.status !== 200) {
            throw new Error('Failed to get random songs');
        }

        const container = res.body?.MediaContainer;
        const items = container?.Track || [];

        return {
            items: items.map((item) =>
                pxNormalize.song(
                    item,
                    apiClientProps.server,
                    serverUrl,
                    apiClientProps.server?.credential,
                ),
            ),
            startIndex: 0,
            totalRecordCount: items.length,
        };
    },

    getRoles: async () => [],

    getServerInfo: async (args) => {
        return {
            features: {},
            id: args.apiClientProps.server?.id,
            version: '1.0.0',
        };
    },

    getSimilarSongs: async (args) => {
        return [];
    },

    getSongDetail: async (args) => {
        const { apiClientProps, query } = args;
        const serverUrl = getServerUrl(apiClientProps.server);
        const sectionId = getLibraryId(query.musicFolderId) || '1';

        const apiClient = pxApiClient(apiClientProps);
        const res = await apiClient.getSongList({
            sectionId,
            size: 1,
            start: 0,
        });

        if (res.status !== 200) {
            throw new Error('Failed to get song detail');
        }

        const tracks = res.body?.MediaContainer?.Track || [];
        if (tracks.length === 0) {
            throw new Error('Song not found');
        }

        return pxNormalize.song(
            tracks[0],
            apiClientProps.server,
            serverUrl,
            apiClientProps.server?.credential,
        );
    },

    getSongList: async (args) => {
        const { apiClientProps, query } = args;
        const serverUrl = getServerUrl(apiClientProps.server);
        const sectionId = getLibraryId(query.musicFolderId) || '1';

        const apiClient = pxApiClient(apiClientProps);
        const singleAlbumId = query.albumIds?.length === 1 ? query.albumIds[0] : undefined;

        const res = singleAlbumId
            ? await apiClient.getAlbumTracks(singleAlbumId)
            : await apiClient.getSongList({
                  artistId:
                      (query.artistIds?.length === 1 ? query.artistIds[0] : undefined) ||
                      (query.albumArtistIds?.length === 1
                          ? query.albumArtistIds[0]
                          : undefined),
                  sectionId,
                  size: query.limit === -1 ? 100 : query.limit || 50,
                  sort: getPlexSongSort(query.sortBy, query.sortOrder),
                  start: query.startIndex || 0,
              });

        if (res.status !== 200) {
            throw new Error('Failed to get song list');
        }

        const container = res.body?.MediaContainer;
        let items = container?.Track || [];

        if (singleAlbumId) {
            const sorted = getPlexSongSort(query.sortBy, query.sortOrder);
            if (sorted === 'viewCount:desc') {
                items = [...items].sort(
                    (a, b) => Number(b.$.viewCount || 0) - Number(a.$.viewCount || 0),
                );
            }
        }

        const startIndex = query.startIndex || 0;
        const limit = query.limit === -1 ? items.length : query.limit || items.length;
        const pagedItems = singleAlbumId ? items.slice(startIndex, startIndex + limit) : items;

        return {
            items: pagedItems.map((item) =>
                pxNormalize.song(
                    item,
                    apiClientProps.server,
                    serverUrl,
                    apiClientProps.server?.credential,
                ),
            ),
            startIndex: query.startIndex,
            totalRecordCount: Number(container?.$.totalSize || items.length),
        };
    },

    getSongListCount: async ({ apiClientProps, query }) =>
        PlexController.getSongList({
            apiClientProps,
            query: { ...query, limit: 1, startIndex: 0 },
        }).then((result) => result?.totalRecordCount ?? 0),

    getStreamUrl: ({ apiClientProps: { server }, query }) => {
        const serverUrl = getServerUrl(server);
        // Plex audio playback needs the downloadable media endpoint; the `/media`
        // metadata route is not a playable source and returns 404 on some servers.
        return `${serverUrl}/library/metadata/${query.id}/download?X-Plex-Token=${server?.credential}`;
    },

    getTopSongs: async (args) => {
        const { apiClientProps, query } = args;
        const serverUrl = getServerUrl(apiClientProps.server);
        const sectionId = getLibraryId(query.musicFolderId) || '1';

        const apiClient = pxApiClient(apiClientProps);
        const res = await apiClient.getSongList({
            artistId: query.artistId,
            sectionId,
            size: query.count,
            sort: 'viewCount:desc',
            start: 0,
        });

        if (res.status !== 200) {
            throw new Error('Failed to get top songs');
        }

        const container = res.body?.MediaContainer;
        const items = container?.Track || [];

        return {
            items: items.map((item) =>
                pxNormalize.song(
                    item,
                    apiClientProps.server,
                    serverUrl,
                    apiClientProps.server?.credential,
                ),
            ),
            startIndex: 0,
            totalRecordCount: Number(container?.$.totalSize || items.length),
        };
    },

    getUserInfo: async (args) => {
        return {
            id: args.apiClientProps.server?.userId || '',
            isAdmin: true,
            name: args.apiClientProps.server?.username || '',
        };
    },

    movePlaylistItem: async (args) => {
        throw new Error('Not implemented for Plex');
    },

    removeFromPlaylist: async (args) => {
        throw new Error('Not implemented for Plex');
    },

    replacePlaylist: async (args) => {
        throw new Error('Not implemented for Plex');
    },

    savePlayQueue: async (args) => {
        return;
    },

    scrobble: async (args) => {
        const { apiClientProps, query } = args;
        const apiClient = pxApiClient(apiClientProps);

        for (const id of query.ids) {
            await apiClient.scrobble(id);
        }

        return null;
    },

    search: async (args) => {
        return {
            albumArtists: [],
            albums: [],
            genres: [],
            playlists: [],
            songs: [],
        };
    },

    setRating: async (args) => {
        const { apiClientProps, query } = args;
        const apiClient = pxApiClient(apiClientProps);

        await apiClient.setRating(query.item, query.rating);

        return null;
    },

    updateInternetRadioStation: async (args) => {
        throw new Error('Not implemented for Plex');
    },

    updatePlaylist: async (args) => {
        throw new Error('Not implemented for Plex');
    },
};
