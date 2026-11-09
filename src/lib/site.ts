export const SITE_URL = 'https://ballot.anthonyugwuja.dev'
export const CORRECTIONS_EMAIL = 'corrections@anthonyugwuja.dev'

export const candidatePath = (id: string) => `/c/${id}/`
export const cardPath = (raceId: string) => `/cards/${raceId}.png`

/** A mailto link pre-filled with what we need to check a correction against INEC's documents (D-014). */
export function correctionHref(candidateId: string, pageUrl: string, name: string): string {
  const subject = `Correction: ${candidateId}`
  const body = [
    `Page: ${pageUrl}`,
    `Candidate: ${name || candidateId} (${candidateId})`,
    'Field to correct:',
    'What it should say:',
    'Where INEC (or another official source) says so, with a link:',
  ].join('\n')
  return `mailto:${CORRECTIONS_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

/** Share links are plain links: no third-party script loads, nothing is sent until the visitor taps one. */
export function shareLinks(text: string, url: string) {
  return {
    whatsapp: `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`,
    x: `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
  }
}
