import { generatedBytes, sprite } from '@/lib/data'

// Every party logo from INEC's register (D-043), and any approved photos (D-065), in one image served from our own
// origin, and the logos alone in a second. Its name carries a hash of its contents, so browsers may keep it for a year.
export const dynamic = 'force-static'
export const dynamicParams = false

export function generateStaticParams() {
  const s = sprite()
  return [s.file, s.logo_file].map(f => ({ file: f.replace('logos/', '') }))
}

export async function GET(_: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params
  const s = sprite()
  const f = [s.file, s.logo_file].find(x => x === `logos/${file}`)
  if (!f) return new Response('Not found', { status: 404 })
  return new Response(new Uint8Array(generatedBytes(f)), { headers: { 'Content-Type': 'image/webp' } })
}
