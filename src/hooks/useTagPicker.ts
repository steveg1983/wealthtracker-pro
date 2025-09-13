/**
 * Custom Hook for Tag Picker
 * Manages tag selection and input
 */

import { useState, useCallback } from 'react';
import { batchOperationsToolbarService } from '../services/batchOperationsToolbarService';

export interface UseTagPickerReturn {
  inputValue: string;
  selectedTags: string[];
  commonTags: string[];
  setInputValue: (value: string) => void;
  handleAddTag: () => void;
  toggleTag: (tag: string) => void;
  removeTag: (tag: string) => void;
  processAndSubmit: () => string[];
}

export function useTagPicker(): UseTagPickerReturn {
  const [inputValue, setInputValue] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  
  // Get common tags from service
  const commonTags = batchOperationsToolbarService.getCommonTags();
  
  // Add custom tag from input
  const handleAddTag = useCallback(() => {
    const trimmedValue = inputValue.trim();
    
    if (batchOperationsToolbarService.isValidTag(trimmedValue, selectedTags) && 
        !selectedTags.includes(trimmedValue)) {
      setSelectedTags(prev => [...prev, trimmedValue]);
      setInputValue('');
    }
  }, [inputValue, selectedTags]);
  
  // Toggle tag selection
  const toggleTag = useCallback((tag: string) => {
    setSelectedTags(prev => {
      if (prev.includes(tag)) {
        return prev.filter(t => t !== tag);
      }
      return [...prev, tag];
    });
  }, []);
  
  // Remove specific tag
  const removeTag = useCallback((tag: string) => {
    setSelectedTags(prev => prev.filter(t => t !== tag));
  }, []);
  
  // Process tags for submission
  const processAndSubmit = useCallback(() => {
    return batchOperationsToolbarService.processSelectedTags(selectedTags);
  }, [selectedTags]);
  
  return {
    inputValue,
    selectedTags,
    commonTags,
    setInputValue,
    handleAddTag,
    toggleTag,
    removeTag,
    processAndSubmit
  };
}