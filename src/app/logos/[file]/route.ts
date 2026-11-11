import { logo, logoBytes, logoParties } from '@/lib/data'

// Each party's logo from INEC's register of political parties (D-043), served from our own origin as /logos/<acronym>.webp.
export const dynamic = 'force-static'
export const dynamicParams = false

export function generateStaticParams() {
  return logoParties().map(p => ({ file: logo(p).file.replace('logos/', '') }))
}

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params
  const party = file.replace(/\.webp$/, '').toUpperCase()
  return new Response(new Uint8Array(logoBytes(party)), { headers: { 'Content-Type': 'image/webp' } })
}
