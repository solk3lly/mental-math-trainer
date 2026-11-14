import { useEffect, useState } from 'react';
import { readStorageJson, writeStorageJson } from './browserStorage.js';

export function useLetterShortcuts() {
  const [enabled, setEnabled] = useState(true);
  useEffect(() => {
    setEnabled(readStorageJson('mathtrainer:letter-shortcuts') !== false);
  }, []);
  const changeEnabled = (value) => {
    setEnabled(value);
    writeStorageJson('mathtrainer:letter-shortcuts', value);
  };
  return [enabled, changeEnabled];
}
