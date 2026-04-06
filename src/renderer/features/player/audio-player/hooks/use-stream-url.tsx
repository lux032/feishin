import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { api } from '/@/renderer/api';
import { TranscodingConfig } from '/@/renderer/store';
import { QueueSong } from '/@/shared/types/domain-types';
import { ServerType } from '/@/shared/types/types';

export function useSongUrl(
    song: QueueSong | undefined,
    current: boolean,
    transcode: TranscodingConfig,
): string | undefined {
    const prior = useRef(['', '']);

    // Plex: use direct part URL for lossless playback, bypassing getStreamUrl entirely
    const plexDirectUrl =
        song?._serverType === ServerType.PLEX && song.streamUrl ? song.streamUrl : undefined;

    const shouldReusePrior = Boolean(
        song?._serverId && current && prior.current[0] === song._uniqueId && prior.current[1],
    );

    const { data: queryStreamUrl } = useQuery({
        enabled: Boolean(song?._serverId) && !shouldReusePrior && !plexDirectUrl,
        queryFn: () =>
            api.controller.getStreamUrl({
                apiClientProps: { serverId: song!._serverId },
                query: {
                    bitrate: transcode.bitrate,
                    format: transcode.format,
                    id: song!.id,
                    transcode: transcode.enabled,
                },
            }),
        queryKey: [
            song?._serverId,
            'stream-url',
            song?.id,
            shouldReusePrior ? 'reuse-prior' : transcode.bitrate,
            shouldReusePrior ? 'reuse-prior' : transcode.format,
            shouldReusePrior ? 'reuse-prior' : transcode.enabled,
        ] as const,
        staleTime: 60 * 1000,
    });

    useEffect(() => {
        if (!song?._serverId) {
            prior.current = ['', ''];
            return;
        }

        if (plexDirectUrl) {
            prior.current = [song._uniqueId, plexDirectUrl];
            return;
        }

        if (!queryStreamUrl) {
            return;
        }

        // Save resolved URL to avoid restarting current track on transcode setting changes.
        prior.current = [song._uniqueId, queryStreamUrl];
    }, [song?._serverId, song?._uniqueId, queryStreamUrl, plexDirectUrl]);

    useEffect(() => {
        if (!song?._serverId) {
            prior.current = ['', ''];
        }
    }, [song?._serverId]);

    return plexDirectUrl || (shouldReusePrior ? prior.current[1] : queryStreamUrl);
}

export const getSongUrl = async (
    song: QueueSong,
    transcode: TranscodingConfig,
    skipAutoTranscode?: boolean,
) => {
    // Plex: use direct part URL for lossless playback
    if (song._serverType === ServerType.PLEX && song.streamUrl) {
        return song.streamUrl;
    }

    const url = await api.controller.getStreamUrl({
        apiClientProps: { serverId: song._serverId },
        query: {
            bitrate: transcode.bitrate,
            format: transcode.format,
            id: song.id,
            skipAutoTranscode,
            transcode: transcode.enabled,
        },
    });

    return url;
};
