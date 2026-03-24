import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { useCreateFavorite } from '/@/renderer/features/shared/mutations/create-favorite-mutation';
import { useDeleteFavorite } from '/@/renderer/features/shared/mutations/delete-favorite-mutation';
import { useCurrentServer, useCurrentServerId } from '/@/renderer/store';
import { ContextMenu } from '/@/shared/components/context-menu/context-menu';
import { LibraryItem } from '/@/shared/types/domain-types';
import { ServerType } from '/@/shared/types/types';

interface SetFavoriteActionProps {
    ids: string[];
    itemType: LibraryItem;
}

export const SetFavoriteAction = ({ ids, itemType }: SetFavoriteActionProps) => {
    const { t } = useTranslation();
    const server = useCurrentServer();
    const serverId = useCurrentServerId();

    const createFavoriteMutation = useCreateFavorite({});
    const deleteFavoriteMutation = useDeleteFavorite({});

    const handleAddToFavorites = useCallback(() => {
        if (ids.length === 0 || !serverId) return;

        createFavoriteMutation.mutate({
            apiClientProps: { serverId },
            query: {
                id: ids,
                type: itemType,
            },
        });
    }, [createFavoriteMutation, ids, itemType, serverId]);

    const handleRemoveFromFavorites = useCallback(() => {
        if (ids.length === 0 || !serverId) return;

        deleteFavoriteMutation.mutate({
            apiClientProps: { serverId },
            query: {
                id: ids,
                type: itemType,
            },
        });
    }, [deleteFavoriteMutation, ids, itemType, serverId]);

    if (server?.type === ServerType.PLEX) {
        return null;
    }

    return (
        <ContextMenu.Submenu>
            <ContextMenu.SubmenuTarget>
                <ContextMenu.Item
                    leftIcon="favorite"
                    onSelect={(e) => e.preventDefault()}
                    rightIcon="arrowRightS"
                >
                    {t('common.favorite', { postProcess: 'sentenceCase' })}
                </ContextMenu.Item>
            </ContextMenu.SubmenuTarget>
            <ContextMenu.SubmenuContent>
                <ContextMenu.Item leftIcon="favorite" onSelect={handleAddToFavorites}>
                    {t('action.addToFavorites', { postProcess: 'sentenceCase' })}
                </ContextMenu.Item>
                <ContextMenu.Item leftIcon="unfavorite" onSelect={handleRemoveFromFavorites}>
                    {t('action.removeFromFavorites', { postProcess: 'sentenceCase' })}
                </ContextMenu.Item>
            </ContextMenu.SubmenuContent>
        </ContextMenu.Submenu>
    );
};
