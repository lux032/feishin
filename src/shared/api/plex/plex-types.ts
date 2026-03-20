import { z } from 'zod';

const plexTagSchema = z.object({
    $: z.object({
        id: z.string(),
        filter: z.string(),
        tag: z.string(),
    }),
});

const plexRoleSchema = z.object({
    $: z.object({
        id: z.string(),
        filter: z.string(),
        role: z.string().optional(),
        tag: z.string(),
    }),
});

const plexMediaPartSchema = z.object({
    $: z.object({
        id: z.string(),
        key: z.string(),
        container: z.string().optional(),
        duration: z.string().optional(),
        file: z.string().optional(),
        size: z.string().optional(),
    }),
});

const plexMediaSchema = z.object({
    $: z.object({
        id: z.string(),
        audioChannels: z.string().optional(),
        audioCodec: z.string().optional(),
        bitrate: z.string().optional(),
        container: z.string().optional(),
        duration: z.string().optional(),
    }),
    Part: z.array(plexMediaPartSchema),
});

export enum PXAlbumListSort {
    NAME = 'titleSort',
    RANDOM = 'random',
    RECENTLY_ADDED = 'addedAt',
    RELEASE_DATE = 'year',
    CRITIC_RATING = 'rating',
}

export enum PXArtistListSort {
    NAME = 'titleSort',
    RECENTLY_ADDED = 'addedAt',
}

export enum PXGenreListSort {
    NAME = 'titleSort',
}

export enum PXPlaylistListSort {
    NAME = 'titleSort',
    RECENTLY_ADDED = 'addedAt',
    DURATION = 'duration',
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
        libraryType: {
            ARTIST: 'artist',
        } as const,
        trackType: 'track' as const,
        albumType: 'album' as const,
    },
    _parameters: {
        albumList: z.object({
            type: z.literal('9'),
            sectionId: z.string(),
            sort: z.string().optional(),
            libarySectionID: z.string().optional(),
            'X-Plex-Container-Start': z.number().optional(),
            'X-Plex-Container-Size': z.number().optional(),
        }),
        artistList: z.object({
            type: z.literal('8'),
            sectionId: z.string(),
            sort: z.string().optional(),
            'X-Plex-Container-Start': z.number().optional(),
            'X-Plex-Container-Size': z.number().optional(),
        }),
        songList: z.object({
            type: z.literal('10'),
            sectionId: z.string(),
            sort: z.string().optional(),
            'X-Plex-Container-Start': z.number().optional(),
            'X-Plex-Container-Size': z.number().optional(),
        }),
    },
    _response: {
        error: z.object({
            error: z.string(),
        }),
        authenticate: z.object({
            user: z.object({
                $: z.object({
                    authenticationToken: z.string(),
                    id: z.string(),
                    title: z.string(),
                    username: z.string(),
                    email: z.string().optional(),
                    thumb: z.string().optional(),
                }),
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
                            name: z.string(),
                            provides: z.string(),
                            accessToken: z.string().optional(),
                            clientIdentifier: z.string(),
                        }),
                        Connection: z.array(
                            z.object({
                                $: z.object({
                                    uri: z.string(),
                                    protocol: z.string().optional(),
                                    address: z.string().optional(),
                                    port: z.string().optional(),
                                }),
                            }),
                        ).optional(),
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
        albumList: z.object({
            MediaContainer: z.object({
                $: z.object({
                    size: z.string(),
                    totalSize: z.string().optional(),
                    offset: z.string().optional(),
                    allowSync: z.string().optional(),
                    identifier: z.string().optional(),
                    librarySectionID: z.string().optional(),
                    librarySectionTitle: z.string().optional(),
                    librarySectionUUID: z.string().optional(),
                    mediaTagPrefix: z.string().optional(),
                    mediaTagVersion: z.string().optional(),
                }),
                Directory: z.array(
                    z.object({
                        $: z.object({
                            ratingKey: z.string(),
                            key: z.string(),
                            guid: z.string().optional(),
                            studio: z.string().optional(),
                            type: z.string(),
                            title: z.string(),
                            titleSort: z.string().optional(),
                            contentRating: z.string().optional(),
                            summary: z.string().optional(),
                            index: z.string().optional(),
                            rating: z.string().optional(),
                            year: z.string().optional(),
                            thumb: z.string().optional(),
                            art: z.string().optional(),
                            banner: z.string().optional(),
                            duration: z.string().optional(),
                            originallyAvailableAt: z.string().optional(),
                            leafCount: z.string().optional(),
                            viewedLeafCount: z.string().optional(),
                            childCount: z.string().optional(),
                            addedAt: z.string().optional(),
                            updatedAt: z.string().optional(),
                            composite: z.string().optional(),
                            parentRatingKey: z.string().optional(),
                            parentTitle: z.string().optional(),
                            parentKey: z.string().optional(),
                            parentGuid: z.string().optional(),
                            parentThumb: z.string().optional(),
                            parentStudio: z.string().optional(),
                        }),
                        Country: z.array(plexTagSchema).optional(),
                        Genre: z.array(plexTagSchema).optional(),
                        Role: z.array(plexRoleSchema).optional(),
                    }),
                ).optional(),
            }),
        }),
        artistList: z.object({
            MediaContainer: z.object({
                $: z.object({
                    size: z.string(),
                    totalSize: z.string().optional(),
                    offset: z.string().optional(),
                }),
                Directory: z.array(
                    z.object({
                        $: z.object({
                            ratingKey: z.string(),
                            key: z.string(),
                            guid: z.string().optional(),
                            type: z.string(),
                            title: z.string(),
                            titleSort: z.string().optional(),
                            summary: z.string().optional(),
                            index: z.string().optional(),
                            thumb: z.string().optional(),
                            art: z.string().optional(),
                            banner: z.string().optional(),
                            duration: z.string().optional(),
                            originallyAvailableAt: z.string().optional(),
                            leafCount: z.string().optional(),
                            viewedLeafCount: z.string().optional(),
                            childCount: z.string().optional(),
                            addedAt: z.string().optional(),
                            updatedAt: z.string().optional(),
                            composite: z.string().optional(),
                        }),
                        Genre: z.array(plexTagSchema).optional(),
                    }),
                ).optional(),
            }),
        }),
        songList: z.object({
            MediaContainer: z.object({
                $: z.object({
                    size: z.string(),
                    totalSize: z.string().optional(),
                    offset: z.string().optional(),
                }),
                Track: z.array(
                    z.object({
                        $: z.object({
                            ratingKey: z.string(),
                            key: z.string(),
                            guid: z.string().optional(),
                            studio: z.string().optional(),
                            type: z.string(),
                            title: z.string(),
                            titleSort: z.string().optional(),
                            contentRating: z.string().optional(),
                            summary: z.string().optional(),
                            index: z.string().optional(),
                            parentIndex: z.string().optional(),
                            rating: z.string().optional(),
                            userRating: z.string().optional(),
                            year: z.string().optional(),
                            thumb: z.string().optional(),
                            art: z.string().optional(),
                            parentThumb: z.string().optional(),
                            duration: z.string().optional(),
                            originallyAvailableAt: z.string().optional(),
                            addedAt: z.string().optional(),
                            updatedAt: z.string().optional(),
                            viewCount: z.string().optional(),
                            lastViewedAt: z.string().optional(),
                            parentRatingKey: z.string().optional(),
                            parentTitle: z.string().optional(),
                            parentKey: z.string().optional(),
                            parentGuid: z.string().optional(),
                            grandparentRatingKey: z.string().optional(),
                            grandparentTitle: z.string().optional(),
                            grandparentKey: z.string().optional(),
                            grandparentGuid: z.string().optional(),
                            grandparentThumb: z.string().optional(),
                        }),
                        Genre: z.array(plexTagSchema).optional(),
                        Media: z.array(plexMediaSchema).optional(),
                    }),
                ).optional(),
            }),
        }),
        albumTracks: z.object({
            MediaContainer: z.object({
                $: z.object({
                    size: z.string(),
                    totalSize: z.string().optional(),
                }),
                Track: z.array(
                    z.object({
                        $: z.object({
                            ratingKey: z.string(),
                            key: z.string(),
                            guid: z.string().optional(),
                            type: z.string(),
                            title: z.string(),
                            titleSort: z.string().optional(),
                            summary: z.string().optional(),
                            index: z.string().optional(),
                            parentIndex: z.string().optional(),
                            rating: z.string().optional(),
                            userRating: z.string().optional(),
                            year: z.string().optional(),
                            thumb: z.string().optional(),
                            parentThumb: z.string().optional(),
                            duration: z.string().optional(),
                            addedAt: z.string().optional(),
                            updatedAt: z.string().optional(),
                            viewCount: z.string().optional(),
                            parentRatingKey: z.string().optional(),
                            parentTitle: z.string().optional(),
                            grandparentTitle: z.string().optional(),
                        }),
                        Media: z.array(plexMediaSchema).optional(),
                    }),
                ).optional(),
            }),
        }),
        playlistList: z.object({
            MediaContainer: z.object({
                $: z.object({
                    size: z.string(),
                    totalSize: z.string().optional(),
                }),
                Playlist: z.array(
                    z.object({
                        $: z.object({
                            ratingKey: z.string(),
                            key: z.string(),
                            guid: z.string().optional(),
                            type: z.string(),
                            title: z.string(),
                            titleSort: z.string().optional(),
                            summary: z.string().optional(),
                            smart: z.string().optional(),
                            playlistType: z.string().optional(),
                            composite: z.string().optional(),
                            duration: z.string().optional(),
                            leafCount: z.string().optional(),
                            addedAt: z.string().optional(),
                            updatedAt: z.string().optional(),
                        }),
                    }),
                ).optional(),
            }),
        }),
        playlistTracks: z.object({
            MediaContainer: z.object({
                $: z.object({
                    size: z.string(),
                    totalSize: z.string().optional(),
                }),
                Track: z.array(
                    z.object({
                        $: z.object({
                            ratingKey: z.string(),
                            key: z.string(),
                            guid: z.string().optional(),
                            type: z.string(),
                            title: z.string(),
                            titleSort: z.string().optional(),
                            summary: z.string().optional(),
                            index: z.string().optional(),
                            parentIndex: z.string().optional(),
                            rating: z.string().optional(),
                            userRating: z.string().optional(),
                            year: z.string().optional(),
                            thumb: z.string().optional(),
                            parentThumb: z.string().optional(),
                            duration: z.string().optional(),
                            addedAt: z.string().optional(),
                            updatedAt: z.string().optional(),
                            viewCount: z.string().optional(),
                            parentRatingKey: z.string().optional(),
                            parentTitle: z.string().optional(),
                            grandparentTitle: z.string().optional(),
                        }),
                        Media: z.array(plexMediaSchema).optional(),
                    }),
                ).optional(),
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
        genreList: z.object({
            MediaContainer: z.object({
                $: z.object({
                    size: z.string(),
                }),
                Directory: z.array(
                    z.object({
                        $: z.object({
                            key: z.string(),
                            title: z.string(),
                            type: z.string().optional(),
                            uuid: z.string().optional(),
                            leafCount: z.string().optional(),
                        }),
                    }),
                ),
            }),
        }),
    },
};

export type PlexResource = {
    name: string;
    uri: string;
    accessToken: string | null;
};

export type PlexSection = {
    key: string;
    title: string;
    type: string;
};

export type PlexResourcesResponse = z.infer<typeof plexType._response.resources>;
export type PlexSectionsResponse = z.infer<typeof plexType._response.sections>;
export type PlexAlbumListResponse = z.infer<typeof plexType._response.albumList>;
export type PlexArtistListResponse = z.infer<typeof plexType._response.artistList>;
export type PlexSongListResponse = z.infer<typeof plexType._response.songList>;
export type PlexAlbumTracksResponse = z.infer<typeof plexType._response.albumTracks>;
export type PlexPlaylistListResponse = z.infer<typeof plexType._response.playlistList>;
export type PlexPlaylistTracksResponse = z.infer<typeof plexType._response.playlistTracks>;
export type PlexMusicFolderListResponse = z.infer<typeof plexType._response.musicFolderList>;
export type PlexGenreListResponse = z.infer<typeof plexType._response.genreList>;

export type PlexResourceDevice = NonNullable<
    PlexResourcesResponse['MediaContainer']['Device']
>[number];
export type PlexSectionDirectory = NonNullable<
    PlexSectionsResponse['MediaContainer']['Directory']
>[number];
export type PlexAlbum = NonNullable<z.infer<typeof plexType._response.albumList>['MediaContainer']['Directory']>[0];
export type PlexArtist = NonNullable<z.infer<typeof plexType._response.artistList>['MediaContainer']['Directory']>[0];
export type PlexTrack = NonNullable<z.infer<typeof plexType._response.songList>['MediaContainer']['Track']>[0];
export type PlexPlaylist = NonNullable<z.infer<typeof plexType._response.playlistList>['MediaContainer']['Playlist']>[0];
