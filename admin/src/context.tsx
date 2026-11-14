import { createContext, useContext } from 'react';
import type { Bootstrap, Me } from './types';

export interface AppContextValue {
  data: Bootstrap;
  me: Me;
  refresh: () => Promise<void>;
}

export const DataContext = createContext<AppContextValue | null>(null);

export function useData(): AppContextValue {
  const value = useContext(DataContext);
  if (!value) throw new Error('数据尚未加载');
  return value;
}
