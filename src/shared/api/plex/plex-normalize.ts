import {
    PlexAlbum,
    PlexArtist,
    PlexPlaylist,
    PlexTrack,
    PX_TRACK_RATING_FAVORITE,
} from '/@/shared/api/plex/plex-types';
import {
    Album,
    AlbumArtist,
    Genre,
    LibraryItem,
    MusicFolder,
    Playlist,
    RelatedArtist,
    Song,
} from '/@/shared/types/domain-types';
import { ServerListItem, ServerType } from '/@/shared/types/types';

export const normalizePlexUserRating = (userRating?: null | string): null | number => {
    if (userRating === undefined || userRating === null) {
        return null;
    }

    const normalizedRating = Number(userRating);
    if (!Number.isFinite(normalizedRating) || normalizedRating <= 0) {
        return null;
    }

    return normalizedRating / 2;
};

export const isPlexFavorite = (userRating?: null | string) =>
    userRating !== undefined && Number(userRating) >= PX_TRACK_RATING_FAVORITE;

export const toPlexUserRating = (rating: number) => {
    if (!Number.isFinite(rating) || rating <= 0) {
        return 0;
    }

    return Math.min(PX_TRACK_RATING_FAVORITE, Math.round(rating * 2));
};

const getAlbumImageId = (item: PlexAlbum): null | string => {
    const thumb = item.$.thumb;
    return thumb ? thumb : null;
};

const getArtistImageId = (item: PlexArtist): null | string => {
    const thumb = item.$.thumb;
    return thumb ? thumb : null;
};

const getSongImageId = (item: PlexTrack): null | string => {
    const thumb = item.$.thumb || item.$.parentThumb;
    return thumb ? thumb : null;
};

const getPlaylistImageId = (item: PlexPlaylist): null | string => {
    const composite = item.$.composite;
    return composite ? composite : null;
};

const getGenres = (
    genres: undefined | { $: { filter: string; id: string; tag: string } }[],
    server: null | ServerListItem,
): Genre[] => {
    if (!genres || genres.length === 0) return [];

    return genres.map((g) => ({
        _itemType: LibraryItem.GENRE,
        _serverId: server?.id || '',
        _serverType: ServerType.PLEX,
        albumCount: null,
        id: g.$.id || g.$.filter || g.$.tag,
        imageId: null,
        imageUrl: null,
        name: g.$.tag,
        songCount: null,
    }));
};

const getArtists = (item: PlexTrack): RelatedArtist[] => {
    const artists: RelatedArtist[] = [];
    const artistName = item.$.originalTitle || item.$.grandparentTitle;

    if (artistName) {
        const isAlbumArtist = artistName === item.$.grandparentTitle;
        artists.push({
            id: isAlbumArtist ? item.$.grandparentRatingKey || '' : '',
            imageId: isAlbumArtist ? item.$.grandparentThumb || null : null,
            imageUrl: null,
            name: artistName,
            userFavorite: false,
            userRating: null,
        });
    }

    return artists;
};

const getAlbumArtists = (item: PlexAlbum): RelatedArtist[] => {
    const artists: RelatedArtist[] = [];

    if (item.$.parentTitle) {
        artists.push({
            id: item.$.parentRatingKey || '',
            imageId: item.$.parentThumb || null,
            imageUrl: null,
            name: item.$.parentTitle,
            userFavorite: false,
            userRating: null,
        });
    }

    return artists;
};

const normalizeSong = (
    item: PlexTrack,
    server: null | ServerListItem,
    serverUrl: string,
    token: string,
): Song => {
    const media = item.Media?.[0];
    const mediaPart = media?.Part?.[0]?.$;
    const audioCodec = media?.$.audioCodec || null;

    let bitRate = 0;
    let channels: null | number = null;
    let container: null | string = null;
    let duration = 0;
    let size = 0;

    if (media) {
        bitRate = media.$.bitrate ? Number(media.$.bitrate) : 0;
        channels = media.$.audioChannels ? Number(media.$.audioChannels) : null;
        container = audioCodec || media.$.container || null;
    }

    if (item.$.duration) {
        duration = Number(item.$.duration);
    }

    if (mediaPart) {
        size = mediaPart.size ? Number(mediaPart.size) : 0;
        container = audioCodec || mediaPart.container || container;
    }

    const streamUrl = mediaPart?.key ? `${serverUrl}${mediaPart.key}?X-Plex-Token=${token}` : '';

    const userRating = normalizePlexUserRating(item.$.userRating);
    const artistName = item.$.originalTitle || item.$.grandparentTitle || '';
    const releaseDate = item.$.originallyAvailableAt || null;
    const releaseYear = item.$.year ? Number(item.$.year) : null;

    return {
        _itemType: LibraryItem.SONG,
        _serverId: server?.id || '',
        _serverType: ServerType.PLEX,
        album: item.$.parentTitle || null,
        albumArtistName: item.$.grandparentTitle || '',
        albumArtists: item.$.grandparentRatingKey
            ? [
                  {
                      id: item.$.grandparentRatingKey,
                      imageId: null,
                      imageUrl: null,
                      name: item.$.grandparentTitle || '',
                      userFavorite: false,
                      userRating: null,
                  },
              ]
            : [],
        albumId: item.$.parentRatingKey || `dummy/${item.$.ratingKey}`,
        artistName,
        artists: getArtists(item),
        bitDepth: null,
        bitRate,
        bpm: null,
        channels,
        comment: null,
        compilation: null,
        container,
        createdAt: item.$.addedAt
            ? new Date(Number(item.$.addedAt) * 1000).toISOString()
            : new Date().toISOString(),
        date: releaseDate || (releaseYear ? String(releaseYear) : null),
        discNumber: item.$.parentIndex ? Number(item.$.parentIndex) : 1,
        discSubtitle: null,
        duration,
        explicitStatus: null,
        gain: null,
        genres: getGenres(item.Genre, server),
        id: item.$.ratingKey,
        imageId: getSongImageId(item),
        imageUrl: null,
        lastPlayedAt: item.$.lastViewedAt
            ? new Date(Number(item.$.lastViewedAt) * 1000).toISOString()
            : null,
        lyrics: null,
        mbzRecordingId: null,
        mbzTrackId: null,
        name: item.$.title,
        participants: null,
        path: null,
        peak: null,
        playCount: item.$.viewCount ? Number(item.$.viewCount) : 0,
        releaseDate,
        releaseYear,
        sampleRate: null,
        size,
        sortName: item.$.titleSort || item.$.title,
        streamUrl,
        tags: null,
        trackNumber: item.$.index ? Number(item.$.index) : 0,
        trackSubtitle: null,
        updatedAt: item.$.updatedAt
            ? new Date(Number(item.$.updatedAt) * 1000).toISOString()
            : new Date().toISOString(),
        userFavorite: isPlexFavorite(item.$.userRating),
        userRating,
        year: releaseYear,
    };
};

const normalizeAlbum = (
    item: PlexAlbum,
    server: null | ServerListItem,
    serverUrl: string,
    token: string,
): Album => {
    const duration = item.$.duration ? Number(item.$.duration) : null;
    const songCount = item.$.leafCount ? Number(item.$.leafCount) : null;
    const userRating = normalizePlexUserRating(item.$.userRating);

    return {
        _itemType: LibraryItem.ALBUM,
        _serverId: server?.id || '',
        _serverType: ServerType.PLEX,
        albumArtistName: item.$.parentTitle || '',
        albumArtists: getAlbumArtists(item),
        artists: getAlbumArtists(item),
        comment: item.$.summary || null,
        createdAt: item.$.addedAt
            ? new Date(Number(item.$.addedAt) * 1000).toISOString()
            : new Date().toISOString(),
        duration,
        explicitStatus: null,
        genres: getGenres(item.Genre, server),
        id: item.$.ratingKey,
        imageId: getAlbumImageId(item),
        imageUrl: item.$.thumb ? `${serverUrl}${item.$.thumb}?X-Plex-Token=${token}` : null,
        isCompilation: null,
        lastPlayedAt: null,
        mbzId: null,
        mbzReleaseGroupId: null,
        name: item.$.title,
        originalDate: item.$.originallyAvailableAt || null,
        originalYear: item.$.year ? Number(item.$.year) : 0,
        participants: null,
        playCount: null,
        recordLabels: item.$.studio ? [item.$.studio] : [],
        releaseDate: item.$.originallyAvailableAt || null,
        releaseType: null,
        releaseTypes: [],
        releaseYear: item.$.year ? Number(item.$.year) : null,
        size: null,
        songCount,
        sortName: item.$.titleSort || item.$.title,
        tags: null,
        trackYearRange: null,
        updatedAt: item.$.updatedAt
            ? new Date(Number(item.$.updatedAt) * 1000).toISOString()
            : new Date().toISOString(),
        userFavorite: isPlexFavorite(item.$.userRating),
        userRating,
        version: null,
    };
};

const normalizeAlbumArtist = (
    item: PlexArtist,
    server: null | ServerListItem,
    serverUrl: string,
    token: string,
): AlbumArtist => {
    const userRating = normalizePlexUserRating(item.$.userRating);

    return {
        _itemType: LibraryItem.ALBUM_ARTIST,
        _serverId: server?.id || '',
        _serverType: ServerType.PLEX,
        albumCount: item.$.childCount ? Number(item.$.childCount) : null,
        biography: item.$.summary || null,
        duration: item.$.duration ? Number(item.$.duration) : null,
        genres: getGenres(item.Genre, server),
        id: item.$.ratingKey,
        imageId: getArtistImageId(item),
        imageUrl: item.$.thumb ? `${serverUrl}${item.$.thumb}?X-Plex-Token=${token}` : null,
        lastPlayedAt: null,
        mbz: null,
        name: item.$.title,
        playCount: null,
        similarArtists: null,
        songCount: item.$.leafCount ? Number(item.$.leafCount) : null,
        userFavorite: isPlexFavorite(item.$.userRating),
        userRating,
    };
};

const normalizePlaylist = (
    item: PlexPlaylist,
    server: null | ServerListItem,
    serverUrl: string,
    token: string,
): Playlist => {
    return {
        _itemType: LibraryItem.PLAYLIST,
        _serverId: server?.id || '',
        _serverType: ServerType.PLEX,
        description: item.$.summary || null,
        duration: item.$.duration ? Number(item.$.duration) : null,
        genres: [],
        id: item.$.ratingKey,
        imageId: getPlaylistImageId(item),
        imageUrl: item.$.composite ? `${serverUrl}${item.$.composite}?X-Plex-Token=${token}` : null,
        name: item.$.title,
        owner: null,
        ownerId: null,
        public: null,
        rules: null,
        size: null,
        songCount: item.$.leafCount ? Number(item.$.leafCount) : null,
        sync: null,
    };
};

const normalizeMusicFolder = (item: {
    $: { key: string; title: string; type: string };
}): MusicFolder => {
    return {
        id: item.$.key,
        name: item.$.title,
    };
};

const normalizeGenre = (
    item:
        | null
        | undefined
        | {
              $?: {
                  id?: string;
                  key?: string;
                  leafCount?: string;
                  tag?: string;
                  title?: string;
              };
          },
    server: null | ServerListItem,
): Genre => {
    const metadata = item?.$;
    const id = metadata?.key || metadata?.id || metadata?.title || metadata?.tag || '';
    const name = metadata?.title || metadata?.tag || metadata?.key || metadata?.id || 'Unknown';

    return {
        _itemType: LibraryItem.GENRE,
        _serverId: server?.id || '',
        _serverType: ServerType.PLEX,
        albumCount: null,
        id,
        imageId: null,
        imageUrl: null,
        name,
        songCount: metadata?.leafCount ? Number(metadata.leafCount) : null,
    };
};

export const pxNormalize = {
    album: normalizeAlbum,
    albumArtist: normalizeAlbumArtist,
    genre: normalizeGenre,
    musicFolder: normalizeMusicFolder,
    playlist: normalizePlaylist,
    song: normalizeSong,
};
