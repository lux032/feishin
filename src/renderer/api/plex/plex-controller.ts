import i18n from '/@/i18n/i18n';
import { pxApiClient } from '/@/renderer/api/plex/plex-api';
import { getServerUrl } from '/@/renderer/utils/normalize-server-url';
import {
    isPlexFavorite,
    normalizePlexUserRating,
    pxNormalize,
    toPlexUserRating,
} from '/@/shared/api/plex/plex-normalize';
import {
    PlexAlbum,
    PlexArtist,
    PlexFolderDirectory,
    PlexTrack,
    PX_TRACK_RATING_FAVORITE,
} from '/@/shared/api/plex/plex-types';
import { sortAlbumList, sortSongList } from '/@/shared/api/utils';
import {
    AlbumArtistListSort,
    albumArtistListSortMap,
    AlbumListSort,
    albumListSortMap,
    ArtistListSort,
    artistListSortMap,
    Folder,
    ImageArgs,
    ImageRequest,
    InternalControllerEndpoint,
    LibraryItem,
    LyricsResponse,
    ServerListItemWithCredential,
    ServerType,
    Song,
    SongListSort,
    songListSortMap,
    SortOrder,
    sortOrderMap,
} from '/@/shared/types/domain-types';
import { ServerFeature } from '/@/shared/types/features-types';

type PlexAlbumMetadataResponse = {
    MediaContainer?: {
        Directory?: PlexAlbum[];
    };
};

type PlexArtistMetadataResponse = {
    MediaContainer?: {
        Directory?: PlexArtist[];
    };
};

type PlexFavoriteSongJson = {
    addedAt?: number | string;
    duration?: number | string;
    grandparentRatingKey?: string;
    grandparentThumb?: string;
    grandparentTitle?: string;
    index?: number | string;
    lastViewedAt?: number | string;
    Media?: {
        audioChannels?: number | string;
        bitrate?: number | string;
        container?: string;
        id?: number | string;
        Part?: {
            container?: string;
            duration?: number | string;
            file?: string;
            id?: number | string;
            key?: string;
            size?: number | string;
        }[];
    }[];
    originallyAvailableAt?: string;
    parentIndex?: number | string;
    parentRatingKey?: string;
    parentThumb?: string;
    parentTitle?: string;
    rating?: number | string;
    ratingKey?: string;
    thumb?: string;
    title?: string;
    titleSort?: string;
    updatedAt?: number | string;
    userRating?: number | string;
    viewCount?: number | string;
    year?: number | string;
};

type PlexFavoriteSongListJsonResponse = {
    MediaContainer?: {
        Metadata?: PlexFavoriteSongJson[];
        size?: number | string;
        totalSize?: number | string;
    };
};

type PlexSongMetadataResponse = {
    MediaContainer?: {
        Track?: PlexTrack[];
    };
};

const PLEX_PAGE_SIZE = 200;
const PLEX_FAVORITE_SONG_PAGE_SIZE = 1000;

const getPlexTotalRecordCount = (
    container: undefined | { $?: { size?: string; totalSize?: string } },
    fallback: number,
) => {
    const totalSize = Number(container?.$?.totalSize);
    if (Number.isFinite(totalSize) && totalSize >= 0) {
        return totalSize;
    }

    const size = Number(container?.$?.size);
    if (Number.isFinite(size) && size >= 0) {
        return size;
    }

    return fallback;
};

const paginatePlexItems = <T>(items: T[], startIndex = 0, limit?: number) => {
    if (limit === -1) {
        return items;
    }

    const pageSize = limit ?? items.length;
    return items.slice(startIndex, startIndex + pageSize);
};

const fetchAllPlexPages = async <TItem, TBody>({
    errorMessage,
    fetchPage,
    getItems,
    getTotalCount,
}: {
    errorMessage: string;
    fetchPage: (start: number, size: number) => Promise<{ body: TBody; status: number }>;
    getItems: (body: TBody) => TItem[];
    getTotalCount: (body: TBody, pageItems: TItem[]) => number;
}) => {
    const items: TItem[] = [];
    let start = 0;
    let totalRecordCount = 0;

    while (true) {
        const res = await fetchPage(start, PLEX_PAGE_SIZE);

        if (res.status !== 200) {
            throw new Error(errorMessage);
        }

        const pageItems = getItems(res.body);
        items.push(...pageItems);
        totalRecordCount = getTotalCount(res.body, pageItems);

        if (pageItems.length === 0 || items.length >= totalRecordCount) {
            break;
        }

        start += pageItems.length;
    }

    return {
        items,
        totalRecordCount: totalRecordCount || items.length,
    };
};

const dedupePlexItemsById = <TItem extends { id: string }>(items: TItem[]) => {
    const byId = new Map<string, TItem>();

    for (const item of items) {
        if (!byId.has(item.id)) {
            byId.set(item.id, item);
        }
    }

    return Array.from(byId.values());
};

const getPlexFavoriteSongItems = (body: PlexFavoriteSongListJsonResponse) =>
    body?.MediaContainer?.Metadata || [];

const getPlexFavoriteSongTotalCount = (
    body: PlexFavoriteSongListJsonResponse,
    fallback: number,
) => {
    const totalSize = Number(body?.MediaContainer?.totalSize);
    if (Number.isFinite(totalSize) && totalSize >= 0) {
        return totalSize;
    }

    const size = Number(body?.MediaContainer?.size);
    if (Number.isFinite(size) && size >= 0) {
        return size;
    }

    return fallback;
};

const toPlexTrackFromFavoriteJson = (item: PlexFavoriteSongJson): PlexTrack => ({
    $: {
        addedAt: item.addedAt === undefined ? undefined : String(item.addedAt),
        duration: item.duration === undefined ? undefined : String(item.duration),
        grandparentRatingKey: item.grandparentRatingKey,
        grandparentThumb: item.grandparentThumb,
        grandparentTitle: item.grandparentTitle,
        index: item.index === undefined ? undefined : String(item.index),
        key: item.ratingKey ? `/library/metadata/${item.ratingKey}` : '',
        lastViewedAt: item.lastViewedAt === undefined ? undefined : String(item.lastViewedAt),
        originallyAvailableAt: item.originallyAvailableAt,
        parentIndex: item.parentIndex === undefined ? undefined : String(item.parentIndex),
        parentRatingKey: item.parentRatingKey,
        parentThumb: item.parentThumb,
        parentTitle: item.parentTitle,
        rating: item.rating === undefined ? undefined : String(item.rating),
        ratingKey: item.ratingKey || '',
        thumb: item.thumb,
        title: item.title || '',
        titleSort: item.titleSort,
        type: 'track',
        updatedAt: item.updatedAt === undefined ? undefined : String(item.updatedAt),
        userRating: item.userRating === undefined ? undefined : String(item.userRating),
        viewCount: item.viewCount === undefined ? undefined : String(item.viewCount),
        year: item.year === undefined ? undefined : String(item.year),
    },
    Media: (item.Media || []).map((media, index) => ({
        $: {
            audioChannels:
                media.audioChannels === undefined ? undefined : String(media.audioChannels),
            bitrate: media.bitrate === undefined ? undefined : String(media.bitrate),
            container: media.container,
            id: media.id === undefined ? String(index) : String(media.id),
        },
        Part: (media.Part || [])
            .filter((part): part is NonNullable<typeof part> => Boolean(part?.key))
            .map((part, partIndex) => ({
                $: {
                    container: part.container,
                    duration: part.duration === undefined ? undefined : String(part.duration),
                    file: part.file,
                    id: part.id === undefined ? String(partIndex) : String(part.id),
                    key: part.key || '',
                    size: part.size === undefined ? undefined : String(part.size),
                },
            })),
    })),
});

const getPlexFolderId = (key: string) => {
    const query = key.split('?')[1];

    if (!query) {
        return key;
    }

    const parentId = new URLSearchParams(query).get('parent');
    return parentId || key;
};

const normalizePlexFolder = (
    item: PlexFolderDirectory,
    server: null | ServerListItemWithCredential,
    parentId?: string,
): Folder => ({
    _itemType: LibraryItem.FOLDER,
    _serverId: server?.id || 'unknown',
    _serverType: ServerType.PLEX,
    children: {
        folders: [],
        songs: [],
    },
    id: getPlexFolderId(item.$.key),
    imageId: null,
    imageUrl: null,
    name: item.$.title,
    parentId,
});

const sortPlexFolders = (folders: Folder[], sortOrder?: SortOrder) => {
    const direction = sortOrder === SortOrder.DESC ? -1 : 1;

    return [...folders].sort((a, b) => a.name.localeCompare(b.name, undefined) * direction);
};

const filterPlexFolderSongs = (songs: Song[], searchTerm: string) => {
    const search = searchTerm.toLowerCase();

    return songs.filter((song) => {
        const name = song.name?.toLowerCase() || '';
        const album = song.album?.toLowerCase() || '';
        const artist = song.artistName?.toLowerCase() || '';

        return name.includes(search) || album.includes(search) || artist.includes(search);
    });
};

const filterPlexSongs = (songs: Song[], searchTerm?: string) => {
    if (!searchTerm) return songs;

    const search = searchTerm.toLowerCase();

    return songs.filter((song) => {
        const name = song.name?.toLowerCase() || '';
        const album = song.album?.toLowerCase() || '';
        const artist = song.artistName?.toLowerCase() || '';
        const albumArtist = song.albumArtistName?.toLowerCase() || '';

        return (
            name.includes(search) ||
            album.includes(search) ||
            artist.includes(search) ||
            albumArtist.includes(search)
        );
    });
};

const getPlexImageRequest = ({
    apiClientProps: { server },
    baseUrl,
    query,
}: ImageArgs): ImageRequest | null => {
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

const getPlexServerUrl = (server: null | ServerListItemWithCredential) =>
    getServerUrl(server) || '';

const getPlexToken = (server: null | ServerListItemWithCredential) => server?.credential || '';

const getPlexMachineIdentifier = (server: null | ServerListItemWithCredential) =>
    server?.userId || '';

const buildPlexPlaylistItemUri = (machineIdentifier: string, songIds: string[]) => {
    const ids = songIds
        .map((songId) => songId?.trim())
        .filter((songId): songId is string => Boolean(songId));

    if (!machineIdentifier || ids.length === 0) {
        throw new Error('Missing Plex playlist item identifiers');
    }

    return `server://${machineIdentifier}/com.plexapp.plugins.library/library/metadata/${ids.join(',')}`;
};

const getPlexTimelineState = (
    event?: 'pause' | 'start' | 'stop' | 'timeupdate' | 'unpause',
): 'paused' | 'playing' | 'stopped' => {
    if (event === 'pause') {
        return 'paused';
    }

    if (event === 'stop') {
        return 'stopped';
    }

    return 'playing';
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

    return `${mappedSort}:${plexSortOrder || sortOrderMap.plex[SortOrder.ASC]}`;
};

const getPlexArtistSort = (sortBy?: ArtistListSort, sortOrder?: SortOrder) => {
    const plexSortOrder = sortOrder ? sortOrderMap.plex[sortOrder] : undefined;
    const mappedSort = sortBy ? artistListSortMap.plex[sortBy] : undefined;

    if (!mappedSort) {
        return undefined;
    }

    return `${mappedSort}:${plexSortOrder || sortOrderMap.plex[SortOrder.ASC]}`;
};

const getPlexAlbumArtistSort = (sortBy?: AlbumArtistListSort, sortOrder?: SortOrder) => {
    const plexSortOrder = sortOrder ? sortOrderMap.plex[sortOrder] : undefined;
    const mappedSort = sortBy ? albumArtistListSortMap.plex[sortBy] : undefined;

    if (!mappedSort) {
        return undefined;
    }

    return `${mappedSort}:${plexSortOrder || sortOrderMap.plex[SortOrder.ASC]}`;
};

const sortPlexGenres = <
    TGenre extends {
        name: string;
    },
>(
    genres: TGenre[],
    sortOrder?: SortOrder,
) => {
    const direction = sortOrder === SortOrder.DESC ? -1 : 1;

    return [...genres].sort((a, b) => a.name.localeCompare(b.name, undefined) * direction);
};

const getPlexGenreArtistIds = async ({
    apiClient,
    genreId,
    sectionId,
}: {
    apiClient: ReturnType<typeof pxApiClient>;
    genreId: string;
    sectionId: string;
}) => {
    const result = await fetchAllPlexPages({
        errorMessage: 'Failed to get genre artists',
        fetchPage: (start, size) =>
            apiClient.getArtistList({
                genreId,
                sectionId,
                size,
                start,
            }),
        getItems: (body) => body?.MediaContainer?.Directory || [],
        getTotalCount: (body, pageItems) =>
            getPlexTotalRecordCount(body?.MediaContainer, pageItems.length),
    });

    return result.items.map((item) => item.$.ratingKey);
};

export const PlexController: InternalControllerEndpoint = {
    addToPlaylist: async (args) => {
        const { apiClientProps, body, query } = args;
        const machineIdentifier = getPlexMachineIdentifier(apiClientProps.server);

        const res = await pxApiClient(apiClientProps).addToPlaylist({
            playlistId: query.id,
            uri: buildPlexPlaylistItemUri(machineIdentifier, body.songId),
        });

        if (res.status !== 200) {
            throw new Error('Failed to add to playlist');
        }

        return null;
    },

    authenticate: async (url, body) => {
        const cleanServerUrl = url.replace(/\/$/, '');

        // body.token is the Plex token for token-based auth
        // body.username/password are for legacy auth (not used for Plex)
        const token = (body as any).token || body.password;

        if (!token) {
            throw new Error(
                i18n.t('error.plexTokenRequired', { postProcess: 'sentenceCase' }) as string,
            );
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
        } catch {
            throw new Error(
                i18n.t('error.plexTokenAuthenticationFailed', {
                    postProcess: 'sentenceCase',
                }) as string,
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

    createInternetRadioStation: async () => {
        throw new Error('Not implemented for Plex');
    },

    createPlaylist: async (args) => {
        const { apiClientProps, body } = args;

        const res = await pxApiClient(apiClientProps).createPlaylist({
            title: body.name,
        });

        if (res.status !== 200) {
            throw new Error('Failed to create playlist');
        }

        const playlistId = res.body?.MediaContainer?.Metadata?.[0]?.ratingKey;

        if (!playlistId) {
            throw new Error('Failed to create playlist');
        }

        return {
            id: String(playlistId),
        };
    },

    deleteFavorite: async (args) => {
        const { apiClientProps, query } = args;

        const apiClient = pxApiClient(apiClientProps);
        for (const id of query.id) {
            await apiClient.setRating(id, 0);
        }

        return null;
    },

    deleteInternetRadioStation: async () => {
        throw new Error('Not implemented for Plex');
    },

    deletePlaylist: async () => {
        throw new Error('Not implemented for Plex');
    },

    getAlbumArtistDetail: async (args) => {
        const { apiClientProps, query } = args;
        const serverUrl = getPlexServerUrl(apiClientProps.server);
        const token = getPlexToken(apiClientProps.server);

        const apiClient = pxApiClient(apiClientProps);
        const res = await apiClient.getMetadata<PlexArtistMetadataResponse>(query.id);

        if (res.status !== 200) {
            throw new Error('Failed to get album artist detail');
        }

        const artist = res.body?.MediaContainer?.Directory?.[0];
        if (!artist) {
            throw new Error('Artist not found');
        }

        return pxNormalize.albumArtist(artist, apiClientProps.server, serverUrl, token);
    },

    getAlbumArtistInfo: async () => {
        return null;
    },

    getAlbumArtistList: async (args) => {
        const { apiClientProps, query } = args;
        const serverUrl = getPlexServerUrl(apiClientProps.server);
        const token = getPlexToken(apiClientProps.server);
        const sectionId = getLibraryId(query.musicFolderId) || '1';

        const apiClient = pxApiClient(apiClientProps);
        const shouldFetchAllPages = query.favorite === true || query.limit === -1;

        const rawResult = shouldFetchAllPages
            ? await fetchAllPlexPages({
                  errorMessage: 'Failed to get album artist list',
                  fetchPage: (start, size) =>
                      apiClient.getArtistList({
                          searchTerm: query.searchTerm,
                          sectionId,
                          size,
                          sort: getPlexAlbumArtistSort(query.sortBy, query.sortOrder),
                          start,
                      }),
                  getItems: (body) => body?.MediaContainer?.Directory || [],
                  getTotalCount: (body, pageItems) =>
                      getPlexTotalRecordCount(body?.MediaContainer, pageItems.length),
              })
            : await apiClient
                  .getArtistList({
                      searchTerm: query.searchTerm,
                      sectionId,
                      size: query.limit || 50,
                      sort: getPlexAlbumArtistSort(query.sortBy, query.sortOrder),
                      start: query.startIndex || 0,
                  })
                  .then((res) => {
                      if (res.status !== 200) {
                          throw new Error('Failed to get album artist list');
                      }

                      const container = res.body?.MediaContainer;

                      return {
                          items: container?.Directory || [],
                          totalRecordCount: getPlexTotalRecordCount(
                              container,
                              (container?.Directory || []).length,
                          ),
                      };
                  });

        let items = rawResult.items.map((item) =>
            pxNormalize.albumArtist(item, apiClientProps.server, serverUrl, token),
        );

        if (query.favorite === true) {
            items = items.filter((item) => item.userFavorite);
        }

        const totalRecordCount = shouldFetchAllPages ? items.length : rawResult.totalRecordCount;

        return {
            items: shouldFetchAllPages
                ? paginatePlexItems(items, query.startIndex || 0, query.limit)
                : items,
            startIndex: query.startIndex,
            totalRecordCount,
        };
    },

    getAlbumArtistListCount: async ({ apiClientProps, query }) =>
        PlexController.getAlbumArtistList({
            apiClientProps,
            query: { ...query, limit: 1, startIndex: 0 },
        }).then((result) => result?.totalRecordCount ?? 0),

    getAlbumDetail: async (args) => {
        const { apiClientProps, query } = args;
        const serverUrl = getPlexServerUrl(apiClientProps.server);
        const token = getPlexToken(apiClientProps.server);

        const apiClient = pxApiClient(apiClientProps);

        // Run the album metadata and tracks fetches in parallel. For albums with many
        // tracks (e.g. OST/compilation albums with 100+ songs), the XML tracks response
        // can be several MB and parsing it via fast-xml-parser blocks the main thread
        // for seconds, freezing the UI. We use the JSON variant for tracks since V8's
        // native JSON.parse is dramatically faster than the XML parser.
        const [albumMetadataRes, tracksRes] = await Promise.all([
            apiClient.getMetadata<PlexAlbumMetadataResponse>(query.id),
            apiClient.getAlbumTracksJson(query.id),
        ]);

        if (tracksRes.status !== 200) {
            throw new Error('Failed to get album detail');
        }

        const albumMetadata = albumMetadataRes.body?.MediaContainer?.Directory?.[0];
        const jsonTracks = tracksRes.body?.MediaContainer?.Metadata || [];
        const tracks = jsonTracks.map(toPlexTrackFromFavoriteJson);

        const songs = tracks.map((track) =>
            pxNormalize.song(track, apiClientProps.server, serverUrl, token),
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
            originalYear: firstTrack.releaseYear ?? 0,
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
            userFavorite: isPlexFavorite(albumMetadata?.$.userRating),
            userRating: normalizePlexUserRating(albumMetadata?.$.userRating),
            version: null,
        };
    },

    getAlbumList: async (args) => {
        const { apiClientProps, query } = args;
        const serverUrl = getPlexServerUrl(apiClientProps.server);
        const token = getPlexToken(apiClientProps.server);
        const sectionId = getLibraryId(query.musicFolderId) || '1';

        const apiClient = pxApiClient(apiClientProps);
        const genreId = query.genreIds?.length === 1 ? query.genreIds[0] : undefined;
        const artistId = query.artistIds?.length === 1 ? query.artistIds[0] : undefined;
        const shouldFetchAllPages =
            query.favorite === true || query.limit === -1 || genreId !== undefined;

        if (genreId) {
            const genreArtistIds = await getPlexGenreArtistIds({
                apiClient,
                genreId,
                sectionId,
            });

            if (genreArtistIds.length === 0) {
                return {
                    items: [],
                    startIndex: query.startIndex,
                    totalRecordCount: 0,
                };
            }

            const albumResponses = await Promise.all(
                genreArtistIds.map((genreArtistId) =>
                    fetchAllPlexPages({
                        errorMessage: 'Failed to get album list',
                        fetchPage: (start, size) =>
                            apiClient.getAlbumList({
                                artistId: genreArtistId,
                                searchTerm: query.searchTerm,
                                sectionId,
                                size,
                                sort: getPlexAlbumSort(query.sortBy, query.sortOrder),
                                start,
                            }),
                        getItems: (body) => body?.MediaContainer?.Directory || [],
                        getTotalCount: (body, pageItems) =>
                            getPlexTotalRecordCount(body?.MediaContainer, pageItems.length),
                    }),
                ),
            );

            let items = dedupePlexItemsById(
                albumResponses
                    .flatMap((response) => response.items)
                    .map((item) =>
                        pxNormalize.album(item, apiClientProps.server, serverUrl, token),
                    ),
            );

            if (query.favorite === true) {
                items = items.filter((item) => item.userFavorite);
            }

            if (query.sortBy) {
                items = sortAlbumList(items, query.sortBy, query.sortOrder || SortOrder.ASC);
            }

            const totalRecordCount = items.length;

            return {
                items: paginatePlexItems(items, query.startIndex || 0, query.limit),
                startIndex: query.startIndex,
                totalRecordCount,
            };
        }

        const rawResult = shouldFetchAllPages
            ? await fetchAllPlexPages({
                  errorMessage: 'Failed to get album list',
                  fetchPage: (start, size) =>
                      apiClient.getAlbumList({
                          artistId,
                          searchTerm: query.searchTerm,
                          sectionId,
                          size,
                          sort: getPlexAlbumSort(query.sortBy, query.sortOrder),
                          start,
                      }),
                  getItems: (body) => body?.MediaContainer?.Directory || [],
                  getTotalCount: (body, pageItems) =>
                      getPlexTotalRecordCount(body?.MediaContainer, pageItems.length),
              })
            : await apiClient
                  .getAlbumList({
                      artistId,
                      searchTerm: query.searchTerm,
                      sectionId,
                      size: query.limit || 50,
                      sort: getPlexAlbumSort(query.sortBy, query.sortOrder),
                      start: query.startIndex || 0,
                  })
                  .then((res) => {
                      if (res.status !== 200) {
                          throw new Error('Failed to get album list');
                      }

                      const container = res.body?.MediaContainer;

                      return {
                          items: container?.Directory || [],
                          totalRecordCount: getPlexTotalRecordCount(
                              container,
                              (container?.Directory || []).length,
                          ),
                      };
                  });

        let items = rawResult.items.map((item) =>
            pxNormalize.album(item, apiClientProps.server, serverUrl, token),
        );

        if (query.favorite === true) {
            items = items.filter((item) => item.userFavorite);
        }

        const totalRecordCount = shouldFetchAllPages ? items.length : rawResult.totalRecordCount;

        return {
            items: shouldFetchAllPages
                ? paginatePlexItems(items, query.startIndex || 0, query.limit)
                : items,
            startIndex: query.startIndex,
            totalRecordCount,
        };
    },

    getAlbumListCount: async ({ apiClientProps, query }) =>
        PlexController.getAlbumList({
            apiClientProps,
            query: { ...query, limit: 1, startIndex: 0 },
        }).then((result) => result?.totalRecordCount ?? 0),

    getAlbumRadio: async (args) => {
        const { apiClientProps, query } = args;
        const serverUrl = getPlexServerUrl(apiClientProps.server);
        const token = getPlexToken(apiClientProps.server);

        const apiClient = pxApiClient(apiClientProps);
        const res = await apiClient.getSimilarAlbums(query.albumId);

        if (res.status !== 200) {
            throw new Error('Failed to get album radio songs');
        }

        const container = res.body?.MediaContainer;
        const albums = container?.Directory || [];
        const targetCount = query.count || albums.length;

        const trackResponses = await Promise.all(
            albums
                .slice(0, targetCount)
                .map((album) => apiClient.getAlbumTracks(album.$.ratingKey)),
        );

        return trackResponses
            .flatMap((response) =>
                response.status === 200 ? (response.body?.MediaContainer?.Track ?? []) : [],
            )
            .map((track) => pxNormalize.song(track, apiClientProps.server, serverUrl, token))
            .slice(0, targetCount);
    },

    getArtistList: async (args) => {
        const { apiClientProps, query } = args;
        const serverUrl = getPlexServerUrl(apiClientProps.server);
        const token = getPlexToken(apiClientProps.server);
        const sectionId = getLibraryId(query.musicFolderId) || '1';

        const apiClient = pxApiClient(apiClientProps);
        const res = await apiClient.getArtistList({
            searchTerm: query.searchTerm,
            sectionId,
            size: query.limit || 50,
            sort: getPlexArtistSort(query.sortBy, query.sortOrder),
            start: query.startIndex || 0,
        });

        if (res.status !== 200) {
            throw new Error('Failed to get artist list');
        }

        const container = res.body?.MediaContainer;
        const items = container?.Directory || [];

        return {
            items: items.map((item) =>
                pxNormalize.albumArtist(item, apiClientProps.server, serverUrl, token),
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

    getArtistRadio: async () => {
        return [];
    },

    getDownloadUrl: (args) => {
        const { apiClientProps, query } = args;
        const serverUrl = getServerUrl(apiClientProps.server);
        return `${serverUrl}/library/metadata/${query.id}/download?X-Plex-Token=${apiClientProps.server?.credential}`;
    },

    getFolder: async (args) => {
        const { apiClientProps, query } = args;
        const serverUrl = getPlexServerUrl(apiClientProps.server);
        const token = getPlexToken(apiClientProps.server);
        const sectionId = getLibraryId(query.musicFolderId) || '1';
        const isRootFolder = query.id === '0';

        const apiClient = pxApiClient(apiClientProps);
        const res = await apiClient.getFolder({
            parentId: isRootFolder ? undefined : query.id,
            sectionId,
        });

        if (res.status !== 200) {
            throw new Error('Failed to get folder');
        }

        const container = res.body?.MediaContainer;
        let folders = (container?.Directory || []).map((item) =>
            normalizePlexFolder(item, apiClientProps.server, isRootFolder ? undefined : query.id),
        );
        let songs = (container?.Track || []).map((item) =>
            pxNormalize.song(item, apiClientProps.server, serverUrl, token),
        );

        if (query.searchTerm) {
            const searchTerm = query.searchTerm.toLowerCase();
            folders = folders.filter((folder) => folder.name.toLowerCase().includes(searchTerm));
            songs = filterPlexFolderSongs(songs, searchTerm);
        }

        folders = sortPlexFolders(folders, query.sortOrder);

        if (songs.length > 0) {
            songs = sortSongList(
                songs,
                query.sortBy || SongListSort.NAME,
                query.sortOrder || SortOrder.ASC,
            );
        }

        return {
            _itemType: LibraryItem.FOLDER,
            _serverId: apiClientProps.server?.id || 'unknown',
            _serverType: ServerType.PLEX,
            children: {
                folders,
                songs,
            },
            id: query.id,
            name: isRootFolder ? '~' : query.id,
            parentId: undefined,
        };
    },

    getGenreList: async (args) => {
        const { apiClientProps, query } = args;
        const sectionId = getLibraryId(query.musicFolderId) || '1';

        const apiClient = pxApiClient(apiClientProps);
        const res = await apiClient.getGenreList({ sectionId });

        if (res.status !== 200) {
            throw new Error('Failed to get genre list');
        }

        const container = res.body?.MediaContainer;
        const items = (container?.Directory || []).filter((item) => item?.$);
        let genres = items.map((item) => pxNormalize.genre(item, apiClientProps.server));

        if (query.searchTerm) {
            const searchTerm = query.searchTerm.toLowerCase();
            genres = genres.filter((genre) => genre.name.toLowerCase().includes(searchTerm));
        }

        genres = sortPlexGenres(genres, query.sortOrder);

        const totalRecordCount = genres.length;
        genres = paginatePlexItems(genres, query.startIndex || 0, query.limit);

        return {
            items: genres,
            startIndex: query.startIndex || 0,
            totalRecordCount,
        };
    },

    getImageRequest: getPlexImageRequest,

    getImageUrl: (args) => getPlexImageRequest(args)?.url || null,

    getInternetRadioStations: async () => {
        return [];
    },

    getLyrics: async (): Promise<LyricsResponse> => {
        return '';
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
        const serverUrl = getPlexServerUrl(apiClientProps.server);
        const token = getPlexToken(apiClientProps.server);

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

        return pxNormalize.playlist(playlist, apiClientProps.server, serverUrl, token);
    },

    getPlaylistList: async (args) => {
        const { apiClientProps } = args;
        const serverUrl = getPlexServerUrl(apiClientProps.server);
        const token = getPlexToken(apiClientProps.server);

        const apiClient = pxApiClient(apiClientProps);
        const res = await apiClient.getPlaylistList();

        if (res.status !== 200) {
            throw new Error('Failed to get playlist list');
        }

        const container = res.body?.MediaContainer;
        const items = container?.Playlist || [];

        return {
            items: items.map((item) =>
                pxNormalize.playlist(item, apiClientProps.server, serverUrl, token),
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
        const serverUrl = getPlexServerUrl(apiClientProps.server);
        const token = getPlexToken(apiClientProps.server);

        const apiClient = pxApiClient(apiClientProps);
        const res = await apiClient.getPlaylistTracks(query.id);

        if (res.status !== 200) {
            throw new Error('Failed to get playlist song list');
        }

        const container = res.body?.MediaContainer;
        const items = container?.Track || [];

        return {
            items: items.map((item) =>
                pxNormalize.song(item, apiClientProps.server, serverUrl, token),
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
        const serverUrl = getPlexServerUrl(apiClientProps.server);
        const token = getPlexToken(apiClientProps.server);
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
                pxNormalize.song(item, apiClientProps.server, serverUrl, token),
            ),
            startIndex: 0,
            totalRecordCount: items.length,
        };
    },

    getRoles: async () => [],

    getServerInfo: async (args) => {
        return {
            features: { [ServerFeature.STAR_RATING]: [1] },
            id: args.apiClientProps.server?.id,
            version: '1.0.0',
        };
    },

    getSimilarSongs: async () => {
        return [];
    },

    getSongDetail: async (args) => {
        const { apiClientProps, query } = args;
        const serverUrl = getPlexServerUrl(apiClientProps.server);
        const token = getPlexToken(apiClientProps.server);

        const apiClient = pxApiClient(apiClientProps);
        const res = await apiClient.getMetadata<PlexSongMetadataResponse>(query.id);

        if (res.status !== 200) {
            throw new Error('Failed to get song detail');
        }

        const tracks = res.body?.MediaContainer?.Track || [];
        if (tracks.length === 0) {
            throw new Error('Song not found');
        }

        return pxNormalize.song(tracks[0], apiClientProps.server, serverUrl, token);
    },

    getSongList: async (args) => {
        const { apiClientProps, query } = args;
        const serverUrl = getPlexServerUrl(apiClientProps.server);
        const token = getPlexToken(apiClientProps.server);
        const sectionId = getLibraryId(query.musicFolderId) || '1';

        const apiClient = pxApiClient(apiClientProps);
        const genreId = query.genreIds?.length === 1 ? query.genreIds[0] : undefined;
        const singleAlbumId = query.albumIds?.length === 1 ? query.albumIds[0] : undefined;
        const singleArtistId =
            (query.artistIds?.length === 1 ? query.artistIds[0] : undefined) ||
            (query.albumArtistIds?.length === 1 ? query.albumArtistIds[0] : undefined);
        const shouldUseGlobalFavoriteSongs =
            query.favorite === true &&
            !query.searchTerm &&
            !genreId &&
            !singleAlbumId &&
            !singleArtistId;
        const shouldFetchAllPages =
            query.favorite === true || query.limit === -1 || genreId !== undefined;

        if (genreId) {
            const genreArtistIds = await getPlexGenreArtistIds({
                apiClient,
                genreId,
                sectionId,
            });

            if (genreArtistIds.length === 0) {
                return {
                    items: [],
                    startIndex: query.startIndex,
                    totalRecordCount: 0,
                };
            }

            const songResponses = await Promise.all(
                genreArtistIds.map((genreArtistId) =>
                    fetchAllPlexPages({
                        errorMessage: 'Failed to get song list',
                        fetchPage: (start, size) =>
                            apiClient.getSongList({
                                artistId: genreArtistId,
                                favorite: query.favorite,
                                searchTerm: query.searchTerm,
                                sectionId,
                                size,
                                sort: getPlexSongSort(query.sortBy, query.sortOrder),
                                start,
                            }),
                        getItems: (body) => body?.MediaContainer?.Track || [],
                        getTotalCount: (body, pageItems) =>
                            getPlexTotalRecordCount(body?.MediaContainer, pageItems.length),
                    }),
                ),
            );

            let items = dedupePlexItemsById(
                songResponses
                    .flatMap((response) => response.items)
                    .map((item) => pxNormalize.song(item, apiClientProps.server, serverUrl, token)),
            );

            if (query.favorite === true) {
                items = items.filter((item) => item.userFavorite);
            }

            if (query.sortBy) {
                items = sortSongList(items, query.sortBy, query.sortOrder || SortOrder.ASC);
            }

            const totalRecordCount = items.length;

            return {
                items: paginatePlexItems(items, query.startIndex || 0, query.limit),
                startIndex: query.startIndex,
                totalRecordCount,
            };
        }

        let rawResult;

        if (shouldUseGlobalFavoriteSongs) {
            rawResult = await apiClient
                .getGlobalFavoriteSongList({
                    size: query.limit || PLEX_FAVORITE_SONG_PAGE_SIZE,
                    sort: getPlexSongSort(query.sortBy, query.sortOrder),
                    start: query.startIndex || 0,
                })
                .then((res) => {
                    if (res.status !== 200) {
                        throw new Error('Failed to get song list');
                    }

                    const favoriteItems = getPlexFavoriteSongItems(res.body);

                    return {
                        items: favoriteItems.map(toPlexTrackFromFavoriteJson),
                        totalRecordCount: getPlexFavoriteSongTotalCount(
                            res.body,
                            favoriteItems.length,
                        ),
                    };
                })
                .catch(async () => {
                    const fallbackResult = await fetchAllPlexPages({
                        errorMessage: 'Failed to get song list',
                        fetchPage: (start, size) =>
                            apiClient.getSongList({
                                favorite: true,
                                searchTerm: query.searchTerm,
                                sectionId,
                                size,
                                sort: getPlexSongSort(query.sortBy, query.sortOrder),
                                start,
                            }),
                        getItems: (body) => body?.MediaContainer?.Track || [],
                        getTotalCount: (body, pageItems) =>
                            getPlexTotalRecordCount(body?.MediaContainer, pageItems.length),
                    });

                    return {
                        items: fallbackResult.items,
                        totalRecordCount: fallbackResult.items.length,
                    };
                });
        } else if (singleAlbumId) {
            rawResult = await apiClient.getAlbumTracksJson(singleAlbumId).then((res) => {
                if (res.status !== 200) {
                    throw new Error('Failed to get song list');
                }

                const jsonTracks = res.body?.MediaContainer?.Metadata || [];
                const items = jsonTracks.map(toPlexTrackFromFavoriteJson);

                return {
                    items,
                    totalRecordCount: items.length,
                };
            });
        } else if (shouldFetchAllPages) {
            rawResult = await fetchAllPlexPages({
                errorMessage: 'Failed to get song list',
                fetchPage: (start, size) =>
                    apiClient.getSongList({
                        artistId: singleArtistId,
                        favorite: query.favorite,
                        searchTerm: query.searchTerm,
                        sectionId,
                        size,
                        sort: getPlexSongSort(query.sortBy, query.sortOrder),
                        start,
                    }),
                getItems: (body) => body?.MediaContainer?.Track || [],
                getTotalCount: (body, pageItems) =>
                    getPlexTotalRecordCount(body?.MediaContainer, pageItems.length),
            });
        } else {
            rawResult = await apiClient
                .getSongList({
                    artistId: singleArtistId,
                    favorite: query.favorite,
                    searchTerm: query.searchTerm,
                    sectionId,
                    size: query.limit || 50,
                    sort: getPlexSongSort(query.sortBy, query.sortOrder),
                    start: query.startIndex || 0,
                })
                .then((res) => {
                    if (res.status !== 200) {
                        throw new Error('Failed to get song list');
                    }

                    const container = res.body?.MediaContainer;

                    return {
                        items: container?.Track || [],
                        totalRecordCount: getPlexTotalRecordCount(
                            container,
                            (container?.Track || []).length,
                        ),
                    };
                });
        }

        let items = rawResult.items.map((item) =>
            pxNormalize.song(item, apiClientProps.server, serverUrl, token),
        );

        if (singleAlbumId && query.searchTerm) {
            items = filterPlexSongs(items, query.searchTerm);
        }

        if (query.favorite === true) {
            items = items.filter((item) => item.userFavorite);
        }

        const totalRecordCount =
            singleAlbumId || shouldFetchAllPages
                ? shouldUseGlobalFavoriteSongs
                    ? rawResult.totalRecordCount
                    : items.length
                : rawResult.totalRecordCount;

        if (singleAlbumId && getPlexSongSort(query.sortBy, query.sortOrder) === 'viewCount:desc') {
            items = [...items].sort((a, b) => (b.playCount || 0) - (a.playCount || 0));
        }

        if ((singleAlbumId || shouldFetchAllPages) && !shouldUseGlobalFavoriteSongs) {
            items = paginatePlexItems(items, query.startIndex || 0, query.limit);
        }

        return {
            items,
            startIndex: query.startIndex,
            totalRecordCount,
        };
    },

    getSongListCount: async ({ apiClientProps, query }) =>
        PlexController.getSongList({
            apiClientProps,
            query: { ...query, limit: 1, startIndex: 0 },
        }).then((result) => result?.totalRecordCount ?? 0),

    getStreamUrl: async ({ apiClientProps: { server }, query }) => {
        const serverUrl = getServerUrl(server);
        // Plex audio playback needs the downloadable media endpoint; the `/media`
        // metadata route is not a playable source and returns 404 on some servers.
        return `${serverUrl}/library/metadata/${query.id}/download?X-Plex-Token=${server?.credential}`;
    },

    getTopSongs: async (args) => {
        const { apiClientProps, query } = args;
        const serverUrl = getPlexServerUrl(apiClientProps.server);
        const token = getPlexToken(apiClientProps.server);
        const sectionId = getLibraryId(apiClientProps.server?.musicFolderId) || '1';

        const apiClient = pxApiClient(apiClientProps);
        const res = await apiClient.getSongList({
            artistId: query.artistId,
            sectionId,
            size: query.limit || 50,
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
                pxNormalize.song(item, apiClientProps.server, serverUrl, token),
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

    movePlaylistItem: async () => {
        throw new Error('Not implemented for Plex');
    },

    removeFromPlaylist: async () => {
        throw new Error('Not implemented for Plex');
    },

    replacePlaylist: async () => {
        throw new Error('Not implemented for Plex');
    },

    savePlayQueue: async () => {
        return;
    },

    scrobble: async (args) => {
        const { apiClientProps, query } = args;
        const apiClient = pxApiClient(apiClientProps);

        if (query.submission) {
            await apiClient.scrobble(query.id);
            return null;
        }

        await apiClient.reportTimeline({
            duration: query.duration,
            ratingKey: query.id,
            state: getPlexTimelineState(query.event),
            time: query.position,
        });

        return null;
    },

    search: async (args) => {
        const { apiClientProps, query } = args;
        const searchTerm = query.query?.trim();

        if (!searchTerm) {
            return {
                albumArtists: [],
                albums: [],
                songs: [],
            };
        }

        const serverUrl = getPlexServerUrl(apiClientProps.server);
        const token = getPlexToken(apiClientProps.server);
        const sectionId = getLibraryId(query.musicFolderId) || '1';
        const apiClient = pxApiClient(apiClientProps);

        const [albumArtistsRes, albumsRes, songsRes] = await Promise.all([
            query.albumArtistLimit
                ? apiClient.getArtistList({
                      searchTerm,
                      sectionId,
                      size: query.albumArtistLimit,
                      sort: 'titleSort:asc',
                      start: query.albumArtistStartIndex || 0,
                  })
                : Promise.resolve(null),
            query.albumLimit
                ? apiClient.getAlbumList({
                      searchTerm,
                      sectionId,
                      size: query.albumLimit,
                      sort: 'titleSort:asc',
                      start: query.albumStartIndex || 0,
                  })
                : Promise.resolve(null),
            query.songLimit
                ? apiClient.getSongList({
                      searchTerm,
                      sectionId,
                      size: query.songLimit,
                      sort: 'titleSort:asc',
                      start: query.songStartIndex || 0,
                  })
                : Promise.resolve(null),
        ]);

        if (
            (albumArtistsRes && albumArtistsRes.status !== 200) ||
            (albumsRes && albumsRes.status !== 200) ||
            (songsRes && songsRes.status !== 200)
        ) {
            throw new Error('Failed to search');
        }

        return {
            albumArtists: (albumArtistsRes?.body?.MediaContainer?.Directory || []).map((item) =>
                pxNormalize.albumArtist(item, apiClientProps.server, serverUrl, token),
            ),
            albums: (albumsRes?.body?.MediaContainer?.Directory || []).map((item) =>
                pxNormalize.album(item, apiClientProps.server, serverUrl, token),
            ),
            songs: (songsRes?.body?.MediaContainer?.Track || []).map((item) =>
                pxNormalize.song(item, apiClientProps.server, serverUrl, token),
            ),
        };
    },

    setPlaylistSongs: async () => {
        throw new Error('Not implemented for Plex');
    },

    setRating: async (args) => {
        const { apiClientProps, query } = args;
        const apiClient = pxApiClient(apiClientProps);

        for (const id of query.id) {
            await apiClient.setRating(id, toPlexUserRating(query.rating));
        }

        return null;
    },

    updateInternetRadioStation: async () => {
        throw new Error('Not implemented for Plex');
    },

    updatePlaylist: async () => {
        throw new Error('Not implemented for Plex');
    },
};
