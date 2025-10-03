import { useEffect, useState, useCallback } from 'react';

interface PredictiveLoadingState {
  isLoading: boolean;
  confidence: number;
  predictedRoute: string | null;
}

export const usePredictiveLoading = () => {
  const [state, setState] = useState<PredictiveLoadingState>({
    isLoading: false,
    confidence: 0,
    predictedRoute: null
  });

  const preloadRoute = useCallback((route: string) => {
    setState(prev => ({
      ...prev,
      isLoading: true,
      predictedRoute: route
    }));

    // Simulate preloading logic
    setTimeout(() => {
      setState(prev => ({
        ...prev,
        isLoading: false,
        confidence: 0.85
      }));
    }, 100);
  }, []);

  const resetPrediction = useCallback(() => {
    setState({
      isLoading: false,
      confidence: 0,
      predictedRoute: null
    });
  }, []);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      resetPrediction();
    };
  }, [resetPrediction]);

  return {
    ...state,
    preloadRoute,
    resetPrediction
  };
};