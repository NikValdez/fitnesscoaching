export function googleAuthError(code?: string) {
  if (!code) return ''
  if (code === 'account_not_linked') {
    return 'This email already has an account. Sign in with your password, then open Account and connect Google.'
  }
  if (code === "email_doesn't_match") {
    return 'Choose the Google account with the same email address as your coaching account.'
  }
  if (code === 'access_denied') return 'Google sign-in was cancelled. You can try again.'
  return 'Google sign-in could not be completed. Please try again.'
}
