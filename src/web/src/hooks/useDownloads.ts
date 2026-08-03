import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useDownloads() {
  return useQuery({
    queryKey: ['downloads'],
    queryFn: () => api.getDownloads(),
    refetchInterval: 2000,
  })
}
