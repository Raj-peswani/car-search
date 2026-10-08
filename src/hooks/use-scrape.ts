'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ScrapeRun } from '@/lib/types';

export function useScrapeStatus() {
  return useQuery<ScrapeRun | null>({
    queryKey: ['scrape-status'],
    queryFn: () => fetch('/api/scrape/status').then(r => r.json()),
    refetchInterval: 10000, // poll every 10s
  });
}

export function useTriggerScrape() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      fetch('/api/scrape', { method: 'POST' }).then(r => {
        return r.json().then(data=>{if(!r.ok) throw new Error(data.error || 'Scan failed'); return data;});
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scrape-status'] });
      // Refetch listings after a delay to allow scrape to complete
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['listings'] });
        queryClient.invalidateQueries({ queryKey: ['stats'] });
      }, 5000);
    },
  });
}
