// Criptografia da chave (token) do Gestão DS de cada login. Só roda no servidor.
// A senha mestra fica em GESTAODS_CHAVE_MESTRA (32 bytes em base64), só no .env.local e na Vercel.
import 'server-only'
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

function mestra() {
  const b64 = process.env.GESTAODS_CHAVE_MESTRA
  const k = b64 ? Buffer.from(b64, 'base64') : null
  if (!k || k.length !== 32) throw new Error('GESTAODS_CHAVE_MESTRA ausente ou inválida (precisa de 32 bytes em base64).')
  return k
}

export function cifrar(token: string): string {
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', mestra(), iv)
  const dados = Buffer.concat([c.update(token, 'utf8'), c.final()])
  return ['v1', iv.toString('base64'), c.getAuthTag().toString('base64'), dados.toString('base64')].join(':')
}

export function decifrar(cifrado: string): string {
  const [versao, iv, tag, dados] = cifrado.split(':')
  if (versao !== 'v1') throw new Error('Formato de chave desconhecido.')
  const d = createDecipheriv('aes-256-gcm', mestra(), Buffer.from(iv, 'base64'))
  d.setAuthTag(Buffer.from(tag, 'base64'))
  return Buffer.concat([d.update(Buffer.from(dados, 'base64')), d.final()]).toString('utf8')
}
