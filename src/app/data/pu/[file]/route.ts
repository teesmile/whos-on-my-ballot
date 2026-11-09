import { states, stateSearchData } from '@/lib/data'

// One static JSON file per state (/data/pu/SS.json), fetched only after a visitor picks that state.
// The request URL is fixed: nothing a visitor types is ever part of it (decision D-015).
export const dynamic = 'force-static'
export const dynamicParams = false

export function generateStaticParams() {
  return states().map(s => ({ file: `${s.code}.json` }))
}

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params
  return Response.json(stateSearchData(file.replace(/\.json$/, '')))
}
