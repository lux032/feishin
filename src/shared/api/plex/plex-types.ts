import { z } from 'zod';

const plexTagSchema = z.object({
    $: z.object({
        filter: z.string(),
        id: z.string(),
        tag: z.string(),
    }),
});

const plexRoleSchema = z.object({
    $: z.object({
        filter: z.string(),
        id: z.string(),
        role: z.string().optional(),
        tag: z.string(),
    }),
});

const plexMediaPartSchema = z.object({
    $: z.object({
        container: z.string().optional(),
        duration: z.string().optional(),
        file: z.string().optional(),
        id: z.string(),
        key: z.string(),
        size: z.string().optional(),
    }),
});

const plexMediaSchema = z.object({
    $: z.object({
        audioChannels: z.string().optional(),
        audioCodec: z.string().optional(),
        bitrate: z.string().optional(),
        container: z.string().optional(),
        duration: z.string().optional(),
        id: z.string(),
    }),
    Part: z.array(plexMediaPartSchema),
});

export enum PXAlbumListSort {
    CRITIC_RATING = 'rating',
    NAME = 'titleSort',
    RANDOM = 'random',
    RECENTLY_ADDED = 'addedAt',
    RELEASE_DATE = 'year',
}

export enum PXArtistListSort {
    NAME = 'titleSort',
    RECENTLY_ADDED = 'addedAt',
}

export enum PXGenreListSort {
    NAME = 'titleSort',
}

export enum PXPlaylistListSort {
    DURATION = 'duration',
    NAME = 'titleSort',
    RECENTLY_ADDED = 'addedAt',
}

export enum PXSongListSort {
    ALBUM = 'album',
    ARTIST = 'artist',
    DURATION = 'duration',
    NAME = 'titleSort',
    PLAY_COUNT = 'viewCount',
    RANDOM = 'random',
    RECENTLY_ADDED = 'addedAt',
    RELEASE_DATE = 'year',
    TRACK_NUMBER = 'index',
}

export enum PXSortOrder {
    ASC = 'asc',
    DESC = 'desc',
}

export const PX_TRACK_RATING_FAVORITE = 10;

export const plexType = {
    _enum: {
        albumType: 'album' as const,
        libraryType: {
            ARTIST: 'artist',
        } as const,
        trackType: 'track' as const,
    },
    _parameters: {
        albumList: z.object({
            libarySectionID: z.string().optional(),
            sectionId: z.string(),
            sort: z.string().optional(),
            type: z.literal('9'),
            'X-Plex-Container-Size': z.number().optional(),
            'X-Plex-Container-Start': z.number().optional(),
        }),
        artistList: z.object({
            sectionId: z.string(),
            sort: z.string().optional(),
            type: z.literal('8'),
            'X-Plex-Container-Size': z.number().optional(),
            'X-Plex-Container-Start': z.number().optional(),
        }),
        songList: z.object({
            sectionId: z.string(),
            sort: z.string().optional(),
            type: z.literal('10'),
            'X-Plex-Container-Size': z.number().optional(),
            'X-Plex-Container-Start': z.number().optional(),
        }),
    },
    _response: {
        albumList: z.object({
            MediaContainer: z.object({
                $: z.object({
                    allowSync: z.string().optional(),
                    identifier: z.string().optional(),
                    librarySectionID: z.string().optional(),
                    librarySectionTitle: z.string().optional(),
                    librarySectionUUID: z.string().optional(),
                    mediaTagPrefix: z.string().optional(),
                    mediaTagVersion: z.string().optional(),
                    offset: z.string().optional(),
                    size: z.string(),
                    totalSize: z.string().optional(),
                }),
                Directory: z
                    .array(
                        z.object({
                            $: z.object({
                                addedAt: z.string().optional(),
                                art: z.string().optional(),
                                banner: z.string().optional(),
                                childCount: z.string().optional(),
                                composite: z.string().optional(),
                                contentRating: z.string().optional(),
                                duration: z.string().optional(),
                                guid: z.string().optional(),
                                index: z.string().optional(),
                                key: z.string(),
                                leafCount: z.string().optional(),
                                originallyAvailableAt: z.string().optional(),
                                parentGuid: z.string().optional(),
                                parentKey: z.string().optional(),
                                parentRatingKey: z.string().optional(),
                                parentStudio: z.string().optional(),
                                parentThumb: z.string().optional(),
                                parentTitle: z.string().optional(),
                                rating: z.string().optional(),
                                ratingKey: z.string(),
                                studio: z.string().optional(),
                                summary: z.string().optional(),
                                thumb: z.string().optional(),
                                title: z.string(),
                                titleSort: z.string().optional(),
                                type: z.string(),
                                updatedAt: z.string().optional(),
                                userRating: z.string().optional(),
                                viewedLeafCount: z.string().optional(),
                                year: z.string().optional(),
                            }),
                            Country: z.array(plexTagSchema).optional(),
                            Genre: z.array(plexTagSchema).optional(),
                            Role: z.array(plexRoleSchema).optional(),
                        }),
                    )
                    .optional(),
            }),
        }),
        albumTracks: z.object({
            MediaContainer: z.object({
                $: z.object({
                    size: z.string(),
                    totalSize: z.string().optional(),
                }),
                Track: z
                    .array(
                        z.object({
                            $: z.object({
                                addedAt: z.string().optional(),
                                duration: z.string().optional(),
                                grandparentTitle: z.string().optional(),
                                guid: z.string().optional(),
                                index: z.string().optional(),
                                key: z.string(),
                                parentIndex: z.string().optional(),
                                parentRatingKey: z.string().optional(),
                                parentThumb: z.string().optional(),
                                parentTitle: z.string().optional(),
                                rating: z.string().optional(),
                                ratingKey: z.string(),
                                summary: z.string().optional(),
                                thumb: z.string().optional(),
                                title: z.string(),
                                titleSort: z.string().optional(),
                                type: z.string(),
                                updatedAt: z.string().optional(),
                                userRating: z.string().optional(),
                                viewCount: z.string().optional(),
                                year: z.string().optional(),
                            }),
                            Media: z.array(plexMediaSchema).optional(),
                        }),
                    )
                    .optional(),
            }),
        }),
        artistList: z.object({
            MediaContainer: z.object({
                $: z.object({
                    offset: z.string().optional(),
                    size: z.string(),
                    totalSize: z.string().optional(),
                }),
                Directory: z
                    .array(
                        z.object({
                            $: z.object({
                                addedAt: z.string().optional(),
                                art: z.string().optional(),
                                banner: z.string().optional(),
                                childCount: z.string().optional(),
                                composite: z.string().optional(),
                                duration: z.string().optional(),
                                guid: z.string().optional(),
                                index: z.string().optional(),
                                key: z.string(),
                                leafCount: z.string().optional(),
                                originallyAvailableAt: z.string().optional(),
                                ratingKey: z.string(),
                                summary: z.string().optional(),
                                thumb: z.string().optional(),
                                title: z.string(),
                                titleSort: z.string().optional(),
                                type: z.string(),
                                updatedAt: z.string().optional(),
                                userRating: z.string().optional(),
                                viewedLeafCount: z.string().optional(),
                            }),
                            Genre: z.array(plexTagSchema).optional(),
                        }),
                    )
                    .optional(),
            }),
        }),
        authenticate: z.object({
            user: z.object({
                $: z.object({
                    authenticationToken: z.string(),
                    email: z.string().optional(),
                    id: z.string(),
                    thumb: z.string().optional(),
                    title: z.string(),
                    username: z.string(),
                }),
            }),
        }),
        error: z.object({
            error: z.string(),
        }),
        genreList: z.object({
            MediaContainer: z.object({
                $: z.object({
                    size: z.string(),
                }),
                Directory: z.array(
                    z.object({
                        $: z.object({
                            key: z.string(),
                            leafCount: z.string().optional(),
                            title: z.string(),
                            type: z.string().optional(),
                            uuid: z.string().optional(),
                        }),
                    }),
                ),
            }),
        }),
        musicFolderList: z.object({
            MediaContainer: z.object({
                $: z.object({
                    size: z.string(),
                }),
                Directory: z.array(
                    z.object({
                        $: z.object({
                            key: z.string(),
                            title: z.string(),
                            type: z.string(),
                            uuid: z.string().optional(),
                        }),
                    }),
                ),
            }),
        }),
        playlistList: z.object({
            MediaContainer: z.object({
                $: z.object({
                    size: z.string(),
                    totalSize: z.string().optional(),
                }),
                Playlist: z
                    .array(
                        z.object({
                            $: z.object({
                                addedAt: z.string().optional(),
                                composite: z.string().optional(),
                                duration: z.string().optional(),
                                guid: z.string().optional(),
                                key: z.string(),
                                leafCount: z.string().optional(),
                                playlistType: z.string().optional(),
                                ratingKey: z.string(),
                                smart: z.string().optional(),
                                summary: z.string().optional(),
                                title: z.string(),
                                titleSort: z.string().optional(),
                                type: z.string(),
                                updatedAt: z.string().optional(),
                            }),
                        }),
                    )
                    .optional(),
            }),
        }),
        playlistTracks: z.object({
            MediaContainer: z.object({
                $: z.object({
                    size: z.string(),
                    totalSize: z.string().optional(),
                }),
                Track: z
                    .array(
                        z.object({
                            $: z.object({
                                addedAt: z.string().optional(),
                                duration: z.string().optional(),
                                grandparentTitle: z.string().optional(),
                                guid: z.string().optional(),
                                index: z.string().optional(),
                                key: z.string(),
                                parentIndex: z.string().optional(),
                                parentRatingKey: z.string().optional(),
                                parentThumb: z.string().optional(),
                                parentTitle: z.string().optional(),
                                rating: z.string().optional(),
                                ratingKey: z.string(),
                                summary: z.string().optional(),
                                thumb: z.string().optional(),
                                title: z.string(),
                                titleSort: z.string().optional(),
                                type: z.string(),
                                updatedAt: z.string().optional(),
                                userRating: z.string().optional(),
                                viewCount: z.string().optional(),
                                year: z.string().optional(),
                            }),
                            Media: z.array(plexMediaSchema).optional(),
                        }),
                    )
                    .optional(),
            }),
        }),
        resources: z.object({
            MediaContainer: z.object({
                $: z.object({
                    size: z.string(),
                }),
                Device: z.array(
                    z.object({
                        $: z.object({
                            accessToken: z.string().optional(),
                            clientIdentifier: z.string(),
                            name: z.string(),
                            provides: z.string(),
                        }),
                        Connection: z
                            .array(
                                z.object({
                                    $: z.object({
                                        address: z.string().optional(),
                                        port: z.string().optional(),
                                        protocol: z.string().optional(),
                                        uri: z.string(),
                                    }),
                                }),
                            )
                            .optional(),
                    }),
                ),
            }),
        }),
        sections: z.object({
            MediaContainer: z.object({
                $: z.object({
                    size: z.string(),
                }),
                Directory: z.array(
                    z.object({
                        $: z.object({
                            key: z.string(),
                            title: z.string(),
                            type: z.string(),
                            uuid: z.string().optional(),
                        }),
                    }),
                ),
            }),
        }),
        songList: z.object({
            MediaContainer: z.object({
                $: z.object({
                    offset: z.string().optional(),
                    size: z.string(),
                    totalSize: z.string().optional(),
                }),
                Track: z
                    .array(
                        z.object({
                            $: z.object({
                                addedAt: z.string().optional(),
                                art: z.string().optional(),
                                contentRating: z.string().optional(),
                                duration: z.string().optional(),
                                grandparentGuid: z.string().optional(),
                                grandparentKey: z.string().optional(),
                                grandparentRatingKey: z.string().optional(),
                                grandparentThumb: z.string().optional(),
                                grandparentTitle: z.string().optional(),
                                guid: z.string().optional(),
                                index: z.string().optional(),
                                key: z.string(),
                                lastViewedAt: z.string().optional(),
                                originallyAvailableAt: z.string().optional(),
                                parentGuid: z.string().optional(),
                                parentIndex: z.string().optional(),
                                parentKey: z.string().optional(),
                                parentRatingKey: z.string().optional(),
                                parentThumb: z.string().optional(),
                                parentTitle: z.string().optional(),
                                rating: z.string().optional(),
                                ratingKey: z.string(),
                                studio: z.string().optional(),
                                summary: z.string().optional(),
                                thumb: z.string().optional(),
                                title: z.string(),
                                titleSort: z.string().optional(),
                                type: z.string(),
                                updatedAt: z.string().optional(),
                                userRating: z.string().optional(),
                                viewCount: z.string().optional(),
                                year: z.string().optional(),
                            }),
                            Genre: z.array(plexTagSchema).optional(),
                            Media: z.array(plexMediaSchema).optional(),
                        }),
                    )
                    .optional(),
            }),
        }),
    },
};

export type PlexAlbum = NonNullable<
    z.infer<typeof plexType._response.albumList>['MediaContainer']['Directory']
>[0];

export type PlexAlbumListResponse = z.infer<typeof plexType._response.albumList>;

export type PlexAlbumTracksResponse = z.infer<typeof plexType._response.albumTracks>;
export type PlexArtist = NonNullable<
    z.infer<typeof plexType._response.artistList>['MediaContainer']['Directory']
>[0];
export type PlexArtistListResponse = z.infer<typeof plexType._response.artistList>;
export type PlexFolderDirectory = {
    $: {
        key: string;
        title: string;
    };
};
export type PlexFolderResponse = {
    MediaContainer?: {
        $?: {
            size?: string;
            totalSize?: string;
        };
        Directory?: PlexFolderDirectory[];
        Track?: PlexTrack[];
    };
};
export type PlexGenreListResponse = z.infer<typeof plexType._response.genreList>;
export type PlexMusicFolderListResponse = z.infer<typeof plexType._response.musicFolderList>;
export type PlexPlaylist = NonNullable<
    z.infer<typeof plexType._response.playlistList>['MediaContainer']['Playlist']
>[0];
export type PlexPlaylistListResponse = z.infer<typeof plexType._response.playlistList>;
export type PlexPlaylistTracksResponse = z.infer<typeof plexType._response.playlistTracks>;
export type PlexResource = {
    accessToken: null | string;
    name: string;
    uri: string;
};
export type PlexResourceDevice = NonNullable<
    PlexResourcesResponse['MediaContainer']['Device']
>[number];

export type PlexResourcesResponse = z.infer<typeof plexType._response.resources>;
export type PlexSection = {
    key: string;
    title: string;
    type: string;
};
export type PlexSectionDirectory = NonNullable<
    PlexSectionsResponse['MediaContainer']['Directory']
>[number];
export type PlexSectionsResponse = z.infer<typeof plexType._response.sections>;
export type PlexSongListResponse = z.infer<typeof plexType._response.songList>;
export type PlexTrack = NonNullable<
    z.infer<typeof plexType._response.songList>['MediaContainer']['Track']
>[0];
