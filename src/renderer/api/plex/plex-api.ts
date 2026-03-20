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

const getPlexHeaders = (token?: string): Record<string, string> => {
    const headers: Record<string, string> = {
        Accept: 'application/xml',
        'X-Plex-Client-Identifier': useAuthStore.getState().deviceId || 'feishin',
        'X-Plex-Device': PLEX_DEVICE,
        'X-Plex-Platform': PLEX_PLATFORM,
        'X-Plex-Product': PLEX_PRODUCT,
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

    return {
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

        getAlbumList: async (params: {
            artistId?: string;
            sectionId: string;
            size?: number;
            sort?: string;
            start?: number;
        }): ApiResponse<PlexAlbumListResponse> => {
            const response = await request<PlexAlbumListResponse>({
                method: 'GET',
                params: {
                    'artist.id': params.artistId,
                    sort: params.sort || 'titleSort',
                    type: 9,
                    'X-Plex-Container-Size': params.size || 50,
                    'X-Plex-Container-Start': params.start || 0,
                },
                path: `library/sections/${params.sectionId}/all`,
            });

            return response;
        },

        getAlbumTracks: async (albumRatingKey: string): ApiResponse<PlexAlbumTracksResponse> => {
            const response = await request<PlexAlbumTracksResponse>({
                method: 'GET',
                path: `library/metadata/${albumRatingKey}/children`,
            });

            return response;
        },

        getArtistList: async (params: {
            genreId?: string;
            sectionId: string;
            size?: number;
            sort?: string;
            start?: number;
        }): ApiResponse<PlexArtistListResponse> => {
            const response = await request<PlexArtistListResponse>({
                method: 'GET',
                params: {
                    genre: params.genreId,
                    sort: params.sort || 'titleSort',
                    type: 8,
                    'X-Plex-Container-Size': params.size || 50,
                    'X-Plex-Container-Start': params.start || 0,
                },
                path: `library/sections/${params.sectionId}/all`,
            });

            return response;
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
            sectionId: string;
            size?: number;
            sort?: string;
            start?: number;
        }): ApiResponse<PlexSongListResponse> => {
            const response = await request<PlexSongListResponse>({
                method: 'GET',
                params: {
                    'album.id': params.albumId,
                    'artist.id': params.artistId,
                    sort: params.sort || 'titleSort',
                    type: 10,
                    'userRating>=': params.favorite ? 10 : undefined,
                    'X-Plex-Container-Size': params.size || 50,
                    'X-Plex-Container-Start': params.start || 0,
                },
                path: `library/sections/${params.sectionId}/all`,
            });

            return response;
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
