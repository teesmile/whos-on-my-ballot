import { generatedBytes, sprite } from '@/lib/data'

// Every party logo from INEC's register (D-043) with the approved photos of the race a page shows first (D-065, D-071), one
// image per such race, and the logos alone, served from our own origin. Its name carries a hash of its contents, so browsers may keep it for a year.
export const dynamic = 'force-static'
export const dynamicParams = false

const files = () => { const s = sprite(); return [s.file, s.logo_file, ...Object.values(s.sheets).map(x => x.file)] }

export function generateStaticParams() {
  return files().map(f => ({ file: f.replace('logos/', '') }))
}

export async function GET(_: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params
  const f = files().find(x => x === `logos/${file}`)
  if (!f) return new Response('Not found', { status: 404 })
  return new Response(new Uint8Array(generatedBytes(f)), { headers: { 'Content-Type': 'image/webp' } })
}
