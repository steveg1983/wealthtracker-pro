declare module 'react-window-infinite-loader' {
  import { ReactNode, Ref, Component } from 'react';

  export interface InfiniteLoaderProps {
    children: (props: {
      onItemsRendered: (props: {
        overscanStartIndex: number;
        overscanStopIndex: number;
        visibleStartIndex: number;
        visibleStopIndex: number;
      }) => void;
      ref: Ref<unknown>;
    }) => ReactNode;
    isItemLoaded: (index: number) => boolean;
    itemCount: number;
    loadMoreItems: (startIndex: number, stopIndex: number) => Promise<void> | void;
    minimumBatchSize?: number;
    threshold?: number;
  }

  export default class InfiniteLoader extends Component<InfiniteLoaderProps> {
    resetloadMoreItemsCache(autoReload?: boolean): void;
  }
}
