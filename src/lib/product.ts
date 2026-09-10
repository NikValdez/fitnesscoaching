export const pdfProgram = {
  id: '69-easy-v1',
  name: '69 Easy',
  amountCents: 4900,
  currency: 'usd',
  isSample: true,
  filename: '69-easy.pdf',
} as const

export const programPrice = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: pdfProgram.currency,
  currencyDisplay: 'code',
  maximumFractionDigits: 0,
}).format(pdfProgram.amountCents / 100)
