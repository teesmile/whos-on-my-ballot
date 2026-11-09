import { source } from '@/lib/data'

import { formatDate } from './Candidate'

/**
 * A visible citation: what the fact is, INEC's source and when it was retrieved (the working rules §2).
 * The whole line is one link, so it reads as a sentence and is a full-width tap target.
 */
export function SourceLine({ id, what, href }: { id: string, what: string, href?: string }) {
  const s = source(id)
  return (
    <p className="cite" data-source={id}>
      <a href={href ?? s.page_url ?? s.archive_url ?? s.file_url}>
        {what}
        {': '}
        {s.title}
        , retrieved
        {' '}
        <time dateTime={s.retrieved_at.slice(0, 10)}>{formatDate(s.retrieved_at)}</time>
      </a>
    </p>
  )
}
