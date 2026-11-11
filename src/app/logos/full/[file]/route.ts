import { generatedBytes, logo, logoParties } from '@/lib/data'

// A larger copy of each party's INEC logo, at the original's own size, for the share picture only: the page script
// loads it when someone shares, never on page load.
export const dynamic = 'force-static'
export const dynamicParams = false

export function generateStaticParams() {
  return logoParties().map(p => ({ file: logo(p).full.replace('logos/full/', '') }))
}

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params
  return new Response(new Uint8Array(generatedBytes(logo(file.replace(/\.webp$/, '').toUpperCase()).full)), { headers: { 'Content-Type': 'image/webp' } })
}
