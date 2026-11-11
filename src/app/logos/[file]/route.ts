import { generatedBytes, sprite } from '@/lib/data'

// Every party logo from INEC's register (D-043), and any approved photos (D-048), in one image served from our own
// origin. Its name carries a hash of its contents, so browsers may keep it for a year.
export const dynamic = 'force-static'
export const dynamicParams = false

export function generateStaticParams() {
  return [{ file: sprite().file.replace('logos/', '') }]
}

export function GET() {
  return new Response(new Uint8Array(generatedBytes(sprite().file)), { headers: { 'Content-Type': 'image/webp' } })
}
