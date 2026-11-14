import { CORRECTIONS_EMAIL } from '@/lib/site'

const SUBJECT = 'Candidate photo'
const BODY = [
  'Candidate name, as INEC lists it:',
  '',
  'Race (office, and constituency or state):',
  '',
  'Link to an official page or verified account that shows this photo is theirs:',
  '',
  'Please attach the photo to this email.',
  '',
].join('\n')

/** The mail link for a candidate's photo: the corrections address, with the subject and a short template filled in. */
export const photoMailto = `mailto:${CORRECTIONS_EMAIL}?subject=${encodeURIComponent(SUBJECT)}&body=${encodeURIComponent(BODY)}`

/** How a candidate or campaign sends an official photo (by email, no form), on the About and corrections pages. */
export function PhotoInvite() {
  return (
    <>
      <p>
        A candidate or their campaign can send an official photo by email, with a link to an official page or verified account
        that shows it is theirs. Nothing sent this way appears by itself: each photo is checked like any other and approved by
        the site’s owner first. A photo sent by anyone else is used only as a lead to an official source.
      </p>
      <p className="go"><a className="btn" href={photoMailto}>Send a candidate’s photo</a></p>
    </>
  )
}
