import isElectron from 'is-electron';
import { useCallback, useEffect, useRef } from 'react';

import i18n from '/@/i18n/i18n';
import { useWebAudio } from '/@/renderer/features/player/hooks/use-webaudio';
import { usePlaybackType } from '/@/renderer/store/settings.store';
import { toast } from '/@/shared/components/toast/toast';
import { PlayerType } from '/@/shared/types/types';

export function useVisualizerSystemAudio() {
    const playbackType = usePlaybackType();
    const { setWebAudio, webAudio } = useWebAudio();
    const webAudioRef = useRef(webAudio);
    const streamRef = useRef<MediaStream | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const connectInFlightRef = useRef(false);

    useEffect(() => {
        webAudioRef.current = webAudio;
    }, [webAudio]);

    const disconnect = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
        }
        if (sourceRef.current) {
            try {
                sourceRef.current.disconnect();
            } catch {
                // ignore
            }
            sourceRef.current = null;
        }
        const w = webAudioRef.current;
        if (w?.visualizerInputs?.length && setWebAudio) {
            const next = { ...w, visualizerInputs: undefined };
            setWebAudio(next);
            webAudioRef.current = next;
        }
    }, [setWebAudio]);

    useEffect(() => {
        if (playbackType === PlayerType.WEB) {
            disconnect();
        }
    }, [playbackType, disconnect]);

    const connect = useCallback(async () => {
        if (!isElectron()) {
            return;
        }

        const w = webAudioRef.current;
        if (!w?.context || w.context.state === 'closed') {
            return;
        }

        if (!setWebAudio) return;

        disconnect();

        const wAfterDisconnect = webAudioRef.current;
        if (!wAfterDisconnect?.context || wAfterDisconnect.context.state === 'closed') {
            return;
        }

        connectInFlightRef.current = true;

        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                audio: true,
                video: true,
            });

            const audioTracks = stream.getAudioTracks();
            if (audioTracks.length === 0) {
                stream.getTracks().forEach((t) => t.stop());
                toast.error({ message: i18n.t('visualizer.systemAudioNoAudioTrack') });
                return;
            }

            const latest = webAudioRef.current;
            if (!latest?.context || latest.context.state === 'closed') {
                stream.getTracks().forEach((t) => t.stop());
                return;
            }

            try {
                await latest.context.resume();
            } catch {
                // ignore
            }

            const source = latest.context.createMediaStreamSource(stream);
            streamRef.current = stream;
            sourceRef.current = source;

            const next = { ...latest, visualizerInputs: [source] };
            setWebAudio(next);
            webAudioRef.current = next;
        } catch (e) {
            const name = (e as DOMException)?.name;
            if (name === 'NotAllowedError' || name === 'AbortError') {
                return;
            }
            toast.error({
                message: i18n.t('visualizer.systemAudioCaptureFailed', {
                    message: (e as Error).message,
                }),
            });
        } finally {
            connectInFlightRef.current = false;
        }
    }, [disconnect, setWebAudio]);

    const connectRef = useRef(connect);
    connectRef.current = connect;

    useEffect(() => {
        if (playbackType !== PlayerType.LOCAL || !isElectron()) {
            return;
        }

        const w = webAudioRef.current;
        if (!w?.context || w.context.state === 'closed') {
            return;
        }
        if (w.visualizerInputs?.length) {
            return;
        }
        if (connectInFlightRef.current) {
            return;
        }

        void connectRef.current();
    }, [playbackType, webAudio?.context, webAudio?.visualizerInputs?.length]);
}
