import { allPhotos, generatedBytes } from '@/lib/data'

// Approved candidate photos (D-048, D-071): the page copy, the larger copy the share picture loads only when someone shares, and
// for Senate, House and State Assembly the card's small copy, loaded only when its race is shown.
export const dynamic = 'force-static'
export const dynamicParams = false

const files = () => Object.values(allPhotos()).flatMap(p => [p.page, p.share, ...(p.card ? [p.card] : [])])

export function generateStaticParams() {
  // A static export needs at least one path; with no approved photos this placeholder is removed after the build.
  const list = files().map(f => ({ file: f.replace('photos/', '') }))
  return list.length ? list : [{ file: 'none' }]
}

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params
  const rel = files().find(f => f === `photos/${file}`)
  if (!rel) return new Response('', { status: 404 })
  return new Response(new Uint8Array(generatedBytes(rel)), { headers: { 'Content-Type': rel.endsWith('.jpg') ? 'image/jpeg' : 'image/webp' } })
}
