import { useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useParseUrl() {
  return useMutation({
    mutationFn: (url: string) => api.parse(url),
  })
}
