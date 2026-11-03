import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { cache } from 'react'

export function createClient() {
  const cookieStore = cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Ignorado quando chamado de Server Component
          }
        },
      },
    }
  )
}

/**
 * Usuário do login, conferido localmente pela assinatura do token (o projeto usa chaves ES256),
 * sem ida ao servidor do Supabase, e uma vez só por requisição (layout e página compartilham).
 */
export const usuarioAtual = cache(async (): Promise<{ id: string; email: string | undefined } | null> => {
  const { data } = await createClient().auth.getClaims()
  const c = data?.claims
  return c?.sub ? { id: c.sub, email: typeof c.email === 'string' ? c.email : undefined } : null
})
