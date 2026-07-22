import axios, { AxiosError, AxiosResponse, isAxiosError, Method } from 'axios';
import { XMLParser } from 'fast-xml-parser';

import i18n from '/@/i18n/i18n';
import { authenticationFailure } from '/@/renderer/api/utils';
import { useAuthStore } from '/@/renderer/store';
import { getServerUrl } from '/@/renderer/utils/normalize-server-url';
import {
    PlexAlbumListResponse,
    PlexAlbumTracksResponse,
    PlexArtistListResponse,
    PlexFolderResponse,
    PlexGenreListResponse,
    PlexMusicFolderListResponse,
    PlexPlaylistListResponse,
    PlexPlaylistTracksResponse,
    PlexResource,
    PlexResourcesResponse,
    PlexSection,
    PlexSectionsResponse,
    PlexSongListResponse,
} from '/@/shared/api/plex/plex-types';
import { ServerListItemWithCredential } from '/@/shared/types/domain-types';

const PLEX_PRODUCT = 'Feishin';
const PLEX_VERSION = '0.1.0';
const PLEX_PLATFORM = 'Web';
const PLEX_DEVICE = 'Web';

const getCharsetFromContentType = (contentType?: string) => {
    if (!contentType) return null;

    const match = contentType.match(/charset\s*=\s*["']?([^;"'\s]+)/i);
    return match?.[1]?.trim().toLowerCase() || null;
};

const getCharsetFromXmlDeclaration = (data: Uint8Array) => {
    const prefix = new TextDecoder('ascii').decode(data.slice(0, 256));
    const match = prefix.match(/<\?xml[^>]*encoding=["']([^"']+)["']/i);
    return match?.[1]?.trim().toLowerCase() || null;
};

const decodeXmlBytes = (data: Uint8Array, headers?: Record<string, string>) => {
    const contentType =
        headers?.['content-type'] || headers?.['Content-Type'] || headers?.['Content-type'];

    const candidates = [
        getCharsetFromContentType(contentType),
        getCharsetFromXmlDeclaration(data),
        'utf-8',
    ].filter(
        (value, index, array): value is string => Boolean(value) && array.indexOf(value) === index,
    );

    for (const encoding of candidates) {
        try {
            return new TextDecoder(encoding).decode(data);
        } catch {
            continue;
        }
    }

    return new TextDecoder().decode(data);
};

const parser = new XMLParser({
    attributeNamePrefix: '',
    attributesGroupName: '$',
    htmlEntities: true,
    ignoreAttributes: false,
    isArray: (name) => {
        const arrayElements = [
            'Device',
            'Connection',
            'Directory',
            'Track',
            'Playlist',
            'Genre',
            'Media',
            'Part',
        ];
        return arrayElements.includes(name);
    },
});

const axiosClient = axios.create({});

type ApiResponse<T> = Promise<{ body: T; headers?: any; status: number }>;

type PlexActivitiesJsonResponse = {
    MediaContainer?: {
        Activity?: Array<{
            progress?: number;
            subtitle?: string;
            title?: string;
            type?: string;
            uuid?: string;
        }>;
        size?: number | string;
    };
};

type PlexAlbumJson = {
    addedAt?: number | string;
    art?: string;
    banner?: string;
    childCount?: number | string;
    composite?: string;
    contentRating?: string;
    Country?: PlexJsonTag[];
    duration?: number | string;
    Genre?: PlexJsonTag[];
    guid?: string;
    index?: number | string;
    key?: string;
    leafCount?: number | string;
    originallyAvailableAt?: string;
    parentGuid?: string;
    parentKey?: string;
    parentRatingKey?: string;
    parentStudio?: string;
    parentThumb?: string;
    parentTitle?: string;
    rating?: number | string;
    ratingKey?: string;
    Role?: PlexJsonRole[];
    studio?: string;
    summary?: string;
    thumb?: string;
    title?: string;
    titleSort?: string;
    type?: string;
    updatedAt?: number | string;
    userRating?: number | string;
    viewedLeafCount?: number | string;
    year?: number | string;
};

type PlexAlbumListJsonResponse = {
    MediaContainer?: {
        Metadata?: PlexAlbumJson[];
        offset?: number | string;
        size?: number | string;
        totalSize?: number | string;
    };
};

// Plex returns the same Track JSON shape from `library/metadata/{id}/children`
// as it does from the favorites endpoint, so we reuse the type.
type PlexAlbumTracksJsonResponse = PlexFavoriteSongListJsonResponse;

type PlexArtistJson = {
    addedAt?: number | string;
    art?: string;
    banner?: string;
    childCount?: number | string;
    composite?: string;
    duration?: number | string;
    Genre?: PlexJsonTag[];
    guid?: string;
    index?: number | string;
    key?: string;
    leafCount?: number | string;
    originallyAvailableAt?: string;
    ratingKey?: string;
    summary?: string;
    thumb?: string;
    title?: string;
    titleSort?: string;
    type?: string;
    updatedAt?: number | string;
    userRating?: number | string;
    viewedLeafCount?: number | string;
};

type PlexArtistListJsonResponse = {
    MediaContainer?: {
        Metadata?: PlexArtistJson[];
        offset?: number | string;
        size?: number | string;
        totalSize?: number | string;
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
        audioCodec?: string;
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
    originalTitle?: string;
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

type PlexJsonMedia = {
    audioChannels?: number | string;
    audioCodec?: string;
    bitrate?: number | string;
    container?: string;
    duration?: number | string;
    id?: number | string;
    Part?: PlexJsonMediaPart[];
};

type PlexJsonMediaPart = {
    container?: string;
    duration?: number | string;
    file?: string;
    id?: number | string;
    key?: string;
    size?: number | string;
};

type PlexJsonRole = PlexJsonTag & {
    role?: string;
};

type PlexJsonTag = {
    filter?: number | string;
    id?: number | string;
    tag?: string;
};

type PlexPlaylistMetadataJson = {
    key?: string;
    ratingKey?: number | string;
};

type PlexPlaylistMutationJsonResponse = {
    MediaContainer?: {
        Metadata?: PlexPlaylistMetadataJson[];
    };
};

type PlexSongJson = {
    addedAt?: number | string;
    art?: string;
    contentRating?: string;
    duration?: number | string;
    Genre?: PlexJsonTag[];
    grandparentGuid?: string;
    grandparentKey?: string;
    grandparentRatingKey?: string;
    grandparentThumb?: string;
    grandparentTitle?: string;
    guid?: string;
    index?: number | string;
    key?: string;
    lastViewedAt?: number | string;
    Media?: PlexJsonMedia[];
    originallyAvailableAt?: string;
    originalTitle?: string;
    parentGuid?: string;
    parentIndex?: number | string;
    parentKey?: string;
    parentRatingKey?: string;
    parentThumb?: string;
    parentTitle?: string;
    rating?: number | string;
    ratingKey?: string;
    studio?: string;
    summary?: string;
    thumb?: string;
    title?: string;
    titleSort?: string;
    type?: string;
    updatedAt?: number | string;
    userRating?: number | string;
    viewCount?: number | string;
    year?: number | string;
};

type PlexSongListJsonResponse = {
    MediaContainer?: {
        Metadata?: PlexSongJson[];
        offset?: number | string;
        size?: number | string;
        totalSize?: number | string;
    };
};

axiosClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            const currentServer = useAuthStore.getState().currentServer;

            if (currentServer) {
                useAuthStore
                    .getState()
                    .actions.updateServer(currentServer.id, { credential: undefined });
            }

            authenticationFailure(currentServer);
        }

        return Promise.reject(error);
    },
);

const decodeXmlResponse = (data: ArrayBuffer | string, headers?: Record<string, string>) => {
    if (typeof data === 'string') {
        return data;
    }

    return decodeXmlBytes(new Uint8Array(data), headers);
};

const parseXmlResponse = (data: ArrayBuffer | string, headers?: Record<string, string>) => {
    return parser.parse(decodeXmlResponse(data, headers));
};

const toOptionalString = (value?: number | string) =>
    value === undefined || value === null ? undefined : String(value);

const toPlexTag = (tag: PlexJsonTag) => ({
    $: {
        filter: String(tag.filter ?? tag.id ?? tag.tag ?? ''),
        id: String(tag.id ?? tag.filter ?? tag.tag ?? ''),
        tag: tag.tag ?? String(tag.id ?? tag.filter ?? ''),
    },
});

const toPlexRole = (role: PlexJsonRole) => ({
    $: {
        filter: String(role.filter ?? role.id ?? role.tag ?? ''),
        id: String(role.id ?? role.filter ?? role.tag ?? ''),
        role: role.role,
        tag: role.tag ?? String(role.id ?? role.filter ?? ''),
    },
});

const toPlexAlbumListResponse = (body: PlexAlbumListJsonResponse): PlexAlbumListResponse => {
    const container = body?.MediaContainer;
    const metadata = container?.Metadata || [];

    return {
        MediaContainer: {
            $: {
                offset: toOptionalString(container?.offset) || '0',
                size: toOptionalString(container?.size) || String(metadata.length),
                totalSize: toOptionalString(container?.totalSize),
            },
            Directory: metadata.map((item) => ({
                $: {
                    addedAt: toOptionalString(item.addedAt),
                    art: item.art,
                    banner: item.banner,
                    childCount: toOptionalString(item.childCount),
                    composite: item.composite,
                    contentRating: item.contentRating,
                    duration: toOptionalString(item.duration),
                    guid: item.guid,
                    index: toOptionalString(item.index),
                    key: item.key || '',
                    leafCount: toOptionalString(item.leafCount),
                    originallyAvailableAt: item.originallyAvailableAt,
                    parentGuid: item.parentGuid,
                    parentKey: item.parentKey,
                    parentRatingKey: item.parentRatingKey,
                    parentStudio: item.parentStudio,
                    parentThumb: item.parentThumb,
                    parentTitle: item.parentTitle,
                    rating: toOptionalString(item.rating),
                    ratingKey: item.ratingKey || '',
                    studio: item.studio,
                    summary: item.summary,
                    thumb: item.thumb,
                    title: item.title || '',
                    titleSort: item.titleSort,
                    type: item.type || 'album',
                    updatedAt: toOptionalString(item.updatedAt),
                    userRating: toOptionalString(item.userRating),
                    viewedLeafCount: toOptionalString(item.viewedLeafCount),
                    year: toOptionalString(item.year),
                },
                Country: (item.Country || []).map(toPlexTag),
                Genre: (item.Genre || []).map(toPlexTag),
                Role: (item.Role || []).map(toPlexRole),
            })),
        },
    };
};

const toPlexArtistListResponse = (body: PlexArtistListJsonResponse): PlexArtistListResponse => {
    const container = body?.MediaContainer;
    const metadata = container?.Metadata || [];

    return {
        MediaContainer: {
            $: {
                offset: toOptionalString(container?.offset) || '0',
                size: toOptionalString(container?.size) || String(metadata.length),
                totalSize: toOptionalString(container?.totalSize),
            },
            Directory: metadata.map((item) => ({
                $: {
                    addedAt: toOptionalString(item.addedAt),
                    art: item.art,
                    banner: item.banner,
                    childCount: toOptionalString(item.childCount),
                    composite: item.composite,
                    duration: toOptionalString(item.duration),
                    guid: item.guid,
                    index: toOptionalString(item.index),
                    key: item.key || '',
                    leafCount: toOptionalString(item.leafCount),
                    originallyAvailableAt: item.originallyAvailableAt,
                    ratingKey: item.ratingKey || '',
                    summary: item.summary,
                    thumb: item.thumb,
                    title: item.title || '',
                    titleSort: item.titleSort,
                    type: item.type || 'artist',
                    updatedAt: toOptionalString(item.updatedAt),
                    userRating: toOptionalString(item.userRating),
                    viewedLeafCount: toOptionalString(item.viewedLeafCount),
                },
                Genre: (item.Genre || []).map(toPlexTag),
            })),
        },
    };
};

const toPlexMediaPart = (part: PlexJsonMediaPart, index: number) => ({
    $: {
        container: part.container,
        duration: toOptionalString(part.duration),
        file: part.file,
        id: toOptionalString(part.id) || String(index),
        key: part.key || '',
        size: toOptionalString(part.size),
    },
});

const toPlexMedia = (media: PlexJsonMedia, index: number) => ({
    $: {
        audioChannels: toOptionalString(media.audioChannels),
        audioCodec: media.audioCodec,
        bitrate: toOptionalString(media.bitrate),
        container: media.container,
        duration: toOptionalString(media.duration),
        id: toOptionalString(media.id) || String(index),
    },
    Part: (media.Part || []).map(toPlexMediaPart),
});

const toPlexSongListResponse = (body: PlexSongListJsonResponse): PlexSongListResponse => {
    const container = body?.MediaContainer;
    const metadata = container?.Metadata || [];

    return {
        MediaContainer: {
            $: {
                offset: toOptionalString(container?.offset) || '0',
                size: toOptionalString(container?.size) || String(metadata.length),
                totalSize: toOptionalString(container?.totalSize),
            },
            Track: metadata.map((item) => ({
                $: {
                    addedAt: toOptionalString(item.addedAt),
                    art: item.art,
                    contentRating: item.contentRating,
                    duration: toOptionalString(item.duration),
                    grandparentGuid: item.grandparentGuid,
                    grandparentKey: item.grandparentKey,
                    grandparentRatingKey: item.grandparentRatingKey,
                    grandparentThumb: item.grandparentThumb,
                    grandparentTitle: item.grandparentTitle,
                    guid: item.guid,
                    index: toOptionalString(item.index),
                    key: item.key || '',
                    lastViewedAt: toOptionalString(item.lastViewedAt),
                    originallyAvailableAt: item.originallyAvailableAt,
                    originalTitle: item.originalTitle,
                    parentGuid: item.parentGuid,
                    parentIndex: toOptionalString(item.parentIndex),
                    parentKey: item.parentKey,
                    parentRatingKey: item.parentRatingKey,
                    parentThumb: item.parentThumb,
                    parentTitle: item.parentTitle,
                    rating: toOptionalString(item.rating),
                    ratingKey: item.ratingKey || '',
                    studio: item.studio,
                    summary: item.summary,
                    thumb: item.thumb,
                    title: item.title || '',
                    titleSort: item.titleSort,
                    type: item.type || 'track',
                    updatedAt: toOptionalString(item.updatedAt),
                    userRating: toOptionalString(item.userRating),
                    viewCount: toOptionalString(item.viewCount),
                    year: toOptionalString(item.year),
                },
                Genre: (item.Genre || []).map(toPlexTag),
                Media: (item.Media || []).map(toPlexMedia),
            })),
        },
    };
};

const getPlexHeaders = (token?: string): Record<string, string> => {
    const headers: Record<string, string> = {
        Accept: 'application/xml',
        'X-Plex-Client-Identifier': useAuthStore.getState().deviceId || 'feishin',
        'X-Plex-Device': PLEX_DEVICE,
        'X-Plex-Device-Name': PLEX_PRODUCT,
        'X-Plex-Platform': PLEX_PLATFORM,
        'X-Plex-Product': PLEX_PRODUCT,
        'X-Plex-Provides': 'player',
        'X-Plex-Version': PLEX_VERSION,
    };

    if (token) {
        headers['X-Plex-Token'] = token;
    }

    return headers;
};

export const pxApiClient = (args: {
    server: null | ServerListItemWithCredential;
    signal?: AbortSignal;
    url?: string;
}) => {
    const { server, signal, url } = args;

    const baseUrl = server ? getServerUrl(server) : url;
    const token = server?.credential;

    const request = async <T>(config: {
        body?: any;
        method: Method;
        params?: Record<string, boolean | number | string | undefined>;
        path: string;
    }): Promise<{ body: T; headers: any; status: number }> => {
        try {
            const queryParams: Record<string, string> = {};
            if (config.params) {
                for (const [key, value] of Object.entries(config.params)) {
                    if (value !== undefined) {
                        queryParams[key] = String(value);
                    }
                }
            }

            const result = await axiosClient.request({
                data: config.body,
                headers: getPlexHeaders(token),
                method: config.method,
                params: queryParams,
                responseType: 'arraybuffer',
                signal,
                url: `${baseUrl}/${config.path}`,
            });

            const parsedBody = parseXmlResponse(
                result.data,
                result.headers as Record<string, string>,
            );

            return {
                body: parsedBody,
                headers: result.headers,
                status: result.status,
            };
        } catch (e: any | AxiosError | Error) {
            if (isAxiosError(e)) {
                if (e.code === 'ERR_NETWORK') {
                    throw new Error(
                        i18n.t('error.networkError', {
                            postProcess: 'sentenceCase',
                        }) as string,
                    );
                }

                const error = e as AxiosError;
                const response = error.response as AxiosResponse;
                return {
                    body: response?.data,
                    headers: response?.headers as any,
                    status: response?.status,
                };
            }
            throw e;
        }
    };

    const requestJson = async <T>(config: {
        body?: any;
        method: Method;
        params?: Record<string, boolean | number | string | undefined>;
        path: string;
    }): Promise<{ body: T; headers: any; status: number }> => {
        try {
            const queryParams: Record<string, string> = {};
            if (config.params) {
                for (const [key, value] of Object.entries(config.params)) {
                    if (value !== undefined) {
                        queryParams[key] = String(value);
                    }
                }
            }

            const result = await axiosClient.request({
                data: config.body,
                headers: {
                    ...getPlexHeaders(token),
                    Accept: 'application/json',
                },
                method: config.method,
                params: queryParams,
                responseType: 'json',
                signal,
                url: `${baseUrl}/${config.path}`,
            });

            return {
                body: result.data as T,
                headers: result.headers,
                status: result.status,
            };
        } catch (e: any | AxiosError | Error) {
            if (isAxiosError(e)) {
                if (e.code === 'ERR_NETWORK') {
                    throw new Error(
                        i18n.t('error.networkError', {
                            postProcess: 'sentenceCase',
                        }) as string,
                    );
                }

                const error = e as AxiosError;
                const response = error.response as AxiosResponse;
                return {
                    body: response?.data as T,
                    headers: response?.headers as any,
                    status: response?.status,
                };
            }
            throw e;
        }
    };

    return {
        addToPlaylist: async (params: {
            playlistId: string;
            uri: string;
        }): ApiResponse<PlexPlaylistMutationJsonResponse> => {
            const response = await requestJson<PlexPlaylistMutationJsonResponse>({
                method: 'PUT',
                params: {
                    uri: params.uri,
                },
                path: `playlists/${params.playlistId}/items`,
            });

            return response;
        },

        authenticate: async (params: { password: string; username: string }) => {
            const authResponse = await axios.post('https://plex.tv/users/sign_in.xml', null, {
                auth: {
                    password: params.password,
                    username: params.username,
                },
                headers: getPlexHeaders(),
                responseType: 'arraybuffer',
            });

            const parsed = parseXmlResponse(
                authResponse.data,
                authResponse.headers as Record<string, string>,
            );
            const user = parsed?.user;

            if (!user?.$?.authenticationToken) {
                throw new Error(
                    i18n.t('error.authenticationFailed', { postProcess: 'sentenceCase' }) as string,
                );
            }

            return {
                body: {
                    authenticationToken: user.$.authenticationToken,
                    id: user.$.id,
                    username: user.$.username,
                },
                status: authResponse.status,
            };
        },

        createPlaylist: async (params: {
            title: string;
        }): ApiResponse<PlexPlaylistMutationJsonResponse> => {
            const response = await requestJson<PlexPlaylistMutationJsonResponse>({
                method: 'POST',
                params: {
                    smart: 0,
                    title: params.title,
                    type: 'audio',
                },
                path: 'playlists',
            });

            return response;
        },

        getActivities: async (): ApiResponse<PlexActivitiesJsonResponse> => {
            return requestJson<PlexActivitiesJsonResponse>({
                method: 'GET',
                path: 'activities',
            });
        },

        getAlbumList: async (params: {
            artistId?: string;
            searchTerm?: string;
            sectionId: string;
            size?: number;
            sort?: string;
            start?: number;
        }): ApiResponse<PlexAlbumListResponse> => {
            const response = await requestJson<PlexAlbumListJsonResponse>({
                method: 'GET',
                params: {
                    'artist.id': params.artistId,
                    query: params.searchTerm,
                    sort: params.sort || 'titleSort',
                    type: 9,
                    'X-Plex-Container-Size': params.size || 50,
                    'X-Plex-Container-Start': params.start || 0,
                },
                path: params.searchTerm
                    ? `library/sections/${params.sectionId}/search`
                    : `library/sections/${params.sectionId}/all`,
            });

            return {
                body: toPlexAlbumListResponse(response.body),
                headers: response.headers,
                status: response.status,
            };
        },

        getAlbumTracks: async (albumRatingKey: string): ApiResponse<PlexAlbumTracksResponse> => {
            const response = await request<PlexAlbumTracksResponse>({
                method: 'GET',
                path: `library/metadata/${albumRatingKey}/children`,
            });

            return response;
        },

        // JSON variant of getAlbumTracks. For albums with many tracks (e.g. OST/compilation
        // albums with 100+ songs), the XML response from Plex can be several megabytes and
        // parsing it via fast-xml-parser blocks the main thread for seconds, freezing the UI.
        // JSON is parsed natively by V8 and is significantly faster, so we prefer it for
        // album detail loading.
        getAlbumTracksJson: async (
            albumRatingKey: string,
        ): ApiResponse<PlexAlbumTracksJsonResponse> => {
            // Plex JSON mode defaults to a very small container size (often just 3 items).
            // We must explicitly request all tracks via X-Plex-Container-Size.
            const response = await requestJson<PlexAlbumTracksJsonResponse>({
                method: 'GET',
                params: {
                    'X-Plex-Container-Size': 10000,
                    'X-Plex-Container-Start': 0,
                },
                path: `library/metadata/${albumRatingKey}/children`,
            });

            return response;
        },

        getArtistList: async (params: {
            genreId?: string;
            searchTerm?: string;
            sectionId: string;
            size?: number;
            sort?: string;
            start?: number;
        }): ApiResponse<PlexArtistListResponse> => {
            const response = await requestJson<PlexArtistListJsonResponse>({
                method: 'GET',
                params: {
                    genre: params.genreId,
                    query: params.searchTerm,
                    sort: params.sort || 'titleSort',
                    type: 8,
                    'X-Plex-Container-Size': params.size || 50,
                    'X-Plex-Container-Start': params.start || 0,
                },
                path: params.searchTerm
                    ? `library/sections/${params.sectionId}/search`
                    : `library/sections/${params.sectionId}/all`,
            });

            return {
                body: toPlexArtistListResponse(response.body),
                headers: response.headers,
                status: response.status,
            };
        },

        getFolder: async (params: {
            parentId?: string;
            sectionId: string;
        }): ApiResponse<PlexFolderResponse> => {
            const response = await request<PlexFolderResponse>({
                method: 'GET',
                params: {
                    parent: params.parentId,
                },
                path: `library/sections/${params.sectionId}/folder`,
            });

            return response;
        },

        getGenreList: async (params: { sectionId: string }): ApiResponse<PlexGenreListResponse> => {
            const response = await request<PlexGenreListResponse>({
                method: 'GET',
                path: `library/sections/${params.sectionId}/genre`,
            });

            return response;
        },

        getGlobalFavoriteSongList: async (params: {
            size?: number;
            sort?: string;
            start?: number;
        }): ApiResponse<PlexFavoriteSongListJsonResponse> => {
            const response = await requestJson<PlexFavoriteSongListJsonResponse>({
                method: 'GET',
                params: {
                    sort: params.sort || 'titleSort',
                    type: 10,
                    userRating: 10,
                    'X-Plex-Container-Size': params.size || 1000,
                    'X-Plex-Container-Start': params.start || 0,
                },
                path: 'library/all',
            });

            return response;
        },

        getMetadata: async <T>(ratingKey: string): ApiResponse<T> => {
            const response = await request<T>({
                method: 'GET',
                path: `library/metadata/${ratingKey}`,
            });

            return response;
        },

        getMusicFolderList: async (): ApiResponse<PlexMusicFolderListResponse> => {
            const response = await request<PlexMusicFolderListResponse>({
                method: 'GET',
                path: 'library/sections',
            });

            return response;
        },

        getPlaylistList: async (): ApiResponse<PlexPlaylistListResponse> => {
            const response = await request<PlexPlaylistListResponse>({
                method: 'GET',
                params: {
                    playlistType: 'audio',
                },
                path: 'playlists',
            });

            return response;
        },

        getPlaylistTracks: async (
            playlistRatingKey: string,
        ): ApiResponse<PlexPlaylistTracksResponse> => {
            const response = await request<PlexPlaylistTracksResponse>({
                method: 'GET',
                path: `playlists/${playlistRatingKey}/items`,
            });

            return response;
        },

        getResources: async () => {
            const response = await request<PlexResourcesResponse>({
                method: 'GET',
                params: {
                    includeHttps: 1,
                    includeRelay: 0,
                },
                path: 'api/v2/resources',
            });

            const devices = response.body?.MediaContainer?.Device || [];
            const resources: PlexResource[] = [];

            for (const device of devices) {
                if (device.$.provides?.includes('server')) {
                    const connections = device.Connection || [];
                    for (const connection of connections) {
                        if (connection.$.uri) {
                            resources.push({
                                accessToken: device.$.accessToken || null,
                                name: device.$.name,
                                uri: connection.$.uri,
                            });
                        }
                    }
                }
            }

            return {
                body: resources,
                status: response.status,
            };
        },

        getSections: async () => {
            const response = await request<PlexSectionsResponse>({
                method: 'GET',
                path: 'library/sections',
            });

            const directories = response.body?.MediaContainer?.Directory || [];
            const sections: PlexSection[] = directories
                .filter((d) => d.$.type === 'artist')
                .map((d) => ({
                    key: d.$.key,
                    title: d.$.title,
                    type: d.$.type,
                }));

            return {
                body: sections,
                status: response.status,
            };
        },

        getSimilarAlbums: async (albumRatingKey: string): ApiResponse<PlexAlbumListResponse> => {
            const response = await request<PlexAlbumListResponse>({
                method: 'GET',
                path: `library/metadata/${albumRatingKey}/similar`,
            });

            return response;
        },

        getSongList: async (params: {
            albumId?: string;
            artistId?: string;
            favorite?: boolean;
            searchTerm?: string;
            sectionId: string;
            size?: number;
            sort?: string;
            start?: number;
        }): ApiResponse<PlexSongListResponse> => {
            const response = await requestJson<PlexSongListJsonResponse>({
                method: 'GET',
                params: {
                    'album.id': params.albumId,
                    'artist.id': params.artistId,
                    query: params.searchTerm,
                    sort: params.sort || 'titleSort',
                    type: 10,
                    'userRating>=': params.favorite ? 10 : undefined,
                    'X-Plex-Container-Size': params.size || 50,
                    'X-Plex-Container-Start': params.start || 0,
                },
                path: params.searchTerm
                    ? `library/sections/${params.sectionId}/search`
                    : `library/sections/${params.sectionId}/all`,
            });

            return {
                body: toPlexSongListResponse(response.body),
                headers: response.headers,
                status: response.status,
            };
        },

        reportTimeline: async (params: {
            continuing?: boolean;
            duration?: number;
            ratingKey: string;
            state: 'paused' | 'playing' | 'stopped';
            time?: number;
        }) => {
            const response = await request({
                method: 'POST',
                params: {
                    containerKey: '/playQueues/0',
                    continuing: params.continuing ? 1 : 0,
                    duration: params.duration,
                    identifier: 'com.plexapp.plugins.library',
                    key: `/library/metadata/${params.ratingKey}`,
                    ratingKey: params.ratingKey,
                    state: params.state,
                    time: params.time,
                },
                path: ':/timeline',
            });

            return response;
        },

        refreshMetadataItems: async (ids: string[]) => {
            return Promise.all(
                ids.map((id) =>
                    request<unknown>({
                        method: 'PUT',
                        path: `library/metadata/${encodeURIComponent(id)}/refresh`,
                    }),
                ),
            );
        },

        scrobble: async (ratingKey: string) => {
            const response = await request({
                method: 'GET',
                params: {
                    identifier: 'com.plexapp.plugins.library',
                    key: ratingKey,
                },
                path: ':/scrobble',
            });

            return response;
        },

        setRating: async (ratingKey: string, rating: number) => {
            const response = await request({
                method: 'GET',
                params: {
                    identifier: 'com.plexapp.plugins.library',
                    key: ratingKey,
                    rating,
                },
                path: ':/rate',
            });

            return response;
        },
    };
};
