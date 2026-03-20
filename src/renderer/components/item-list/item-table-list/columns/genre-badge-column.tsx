import { useMemo } from 'react';
import { generatePath, Link } from 'react-router';

import styles from './genre-badge-column.module.css';

import {
    ColumnNullFallback,
    ColumnSkeletonVariable,
    ItemTableListInnerColumn,
    TableColumnContainer,
} from '/@/renderer/components/item-list/item-table-list/item-table-list-column';
import { AppRoute } from '/@/renderer/router/routes';
import { Badge } from '/@/shared/components/badge/badge';
import { Group } from '/@/shared/components/group/group';
import { Genre } from '/@/shared/types/domain-types';
import { stringToColor } from '/@/shared/utils/string-to-color';

const MAX_GENRES = 4;

const GenreBadgeColumn = (props: ItemTableListInnerColumn) => {
    const rowItem = props.getRowItem?.(props.rowIndex) ?? (props.data as any[])[props.rowIndex];
    const row: Genre[] | undefined = (rowItem as any)?.genres;

    const genres = useMemo(() => {
        if (!row) return [];
        return row.map((genre) => {
            const { color, isLight } = stringToColor(genre.name);
            const path = genre.id
                ? generatePath(AppRoute.LIBRARY_GENRES_DETAIL, { genreId: genre.id })
                : null;
            return { ...genre, color, isLight, path };
        });
    }, [row]);

    if (Array.isArray(row)) {
        return (
            <TableColumnContainer {...props}>
                <Group className={styles.group} wrap="wrap">
                    {genres.slice(0, MAX_GENRES).map((genre) =>
                        genre.path ? (
                            <Badge
                                component={Link}
                                key={genre.id || genre.name}
                                state={{ item: genre }}
                                style={{
                                    backgroundColor: genre.color,
                                    color: genre.isLight ? 'black' : 'white',
                                }}
                                to={genre.path}
                            >
                                {genre.name}
                            </Badge>
                        ) : (
                            <Badge
                                component="span"
                                key={genre.id || genre.name}
                                style={{
                                    backgroundColor: genre.color,
                                    color: genre.isLight ? 'black' : 'white',
                                }}
                            >
                                {genre.name}
                            </Badge>
                        ),
                    )}
                </Group>
            </TableColumnContainer>
        );
    }

    if (row === null) {
        return <ColumnNullFallback {...props} />;
    }

    return <ColumnSkeletonVariable {...props} />;
};

export { GenreBadgeColumn };
