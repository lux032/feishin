import { autoScrollForElements } from '@atlaskit/pragmatic-drag-and-drop-auto-scroll/element';
import clsx from 'clsx';
import { useOverlayScrollbars } from 'overlayscrollbars-react';
import { forwardRef, Ref, useEffect, useRef, useState } from 'react';

import styles from './scroll-area.module.css';
import './scroll-area.css';

import { useMergedRef } from '/@/shared/hooks/use-merged-ref';
import { DragData, DragTarget } from '/@/shared/types/drag-and-drop';

interface ScrollAreaProps extends React.ComponentPropsWithoutRef<'div'> {
    allowDragScroll?: boolean;
    debugScrollPosition?: boolean;
    scrollHideDelay?: number;
    scrollX?: boolean;
    scrollY?: boolean;
}

export const ScrollArea = forwardRef((props: ScrollAreaProps, ref: Ref<HTMLDivElement>) => {
    const {
        allowDragScroll,
        children,
        className,
        scrollHideDelay,
        scrollX = false,
        scrollY = true,
        ...htmlProps
    } = props;

    const containerRef = useRef(null);
    const [scroller, setScroller] = useState<HTMLElement | null | Window>(null);

    const [initialize, osInstance] = useOverlayScrollbars({
        defer: false,
        options: {
            overflow: { x: scrollX ? 'scroll' : 'hidden', y: scrollY ? 'scroll' : 'hidden' },
            scrollbars: {
                autoHide: 'leave',
                autoHideDelay: scrollHideDelay || 500,
                pointers: ['mouse', 'pen', 'touch'],
                theme: 'feishin-os-scrollbar',
                visibility: 'visible',
            },
        },
    });

    useEffect(() => {
        const { current: root } = containerRef;

        let autoScrollCleanup: (() => void) | null = null;

        if (scroller && root) {
            initialize(root);

            if (allowDragScroll) {
                const viewport = osInstance()?.elements().viewport || (scroller as HTMLElement);
                autoScrollCleanup = autoScrollForElements({
                    canScroll: (args) => {
                        const data = args.source.data as unknown as DragData<unknown>;
                        if (data.type === DragTarget.TABLE_COLUMN) return false;
                        return true;
                    },
                    element: viewport,
                    getAllowedAxis: () => 'vertical',
                    getConfiguration: () => ({ maxScrollSpeed: 'standard' }),
                });
            }
        }

        return () => {
            if (autoScrollCleanup) {
                autoScrollCleanup();
            }

            osInstance()?.destroy();
        };
    }, [allowDragScroll, initialize, osInstance, scroller]);

    const mergedRef = useMergedRef(ref, containerRef);

    return (
        <div
            className={clsx(styles.scrollArea, className)}
            ref={(el) => {
                setScroller(el);
                mergedRef(el);
            }}
            {...htmlProps}
        >
            {children}
        </div>
    );
});
