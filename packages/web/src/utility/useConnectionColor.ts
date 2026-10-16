import { derived } from 'svelte/store';

import { useConnectionList } from '../utility/metadataLoaders';
import { getNormalizedUserColorName } from './userColors';

export function getConnectionColor(
  connections,
  dbid,
  userColorTarget = 'foreground',
  cssStylePrefix = '',
  useConnectionFallback = true
) {
  if (!dbid || !connections) return undefined;
  const current = connections.find(x => x._id == dbid.conid) ;
  const { database } = dbid;
  let colorName = useConnectionFallback || !database ? current?.connectionColor : null;
  const dbConfig = (current?.databases || []).find(x => x.name == database);
  if (dbConfig?.connectionColor) {
    colorName = dbConfig.connectionColor;
  }
  colorName = getNormalizedUserColorName(colorName);
  if (!colorName) return undefined;
  if (cssStylePrefix === '@rawColorWithoutVariable') {
    return colorName;
  }
  return `${cssStylePrefix}var(--theme-usercolor-${userColorTarget}-${colorName})`;
}

export function useConnectionColor(
  dbid,
  userColorTarget: 'foreground' | 'background' | 'statusbar' = 'foreground',
  cssStylePrefix = '',
  useConnectionFallback = true
) {
  const connections = useConnectionList();
  return derived([connections], ([$connections]) =>
    getConnectionColor(
      $connections,
      dbid,
      userColorTarget,
      cssStylePrefix,
      useConnectionFallback
    )
  );
}

export function useConnectionColorFactory(
  userColorTarget = 'foreground',
  cssStylePrefix = '',
  useConnectionFallback = true
) {
  const connections = useConnectionList();
  return derived(
    [connections],
    ([$connections]) =>
      (dbid = null, cssStylePrefixOverride = null, useConnectionFallbackOverride = null) => {
        const res = getConnectionColor(
          $connections,
          dbid,
          userColorTarget,
          cssStylePrefixOverride ?? cssStylePrefix,
          useConnectionFallbackOverride ?? useConnectionFallback
        );
        return res;
      }
  );
}
