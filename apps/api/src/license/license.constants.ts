/**
 * Default RSA public key for license verification (dev keypair).
 * Overridable via LICENSE_PUBLIC_KEY env var.
 * Digisailor signs production licenses with a private key that is never shipped.
 *
 * Regenerate with: npm run license:generate
 */
export const EMBEDDED_LICENSE_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA5hPesB4oCFMne57c5xdB
dkhwdK7Y6JvooQubm74gNxpwUx2Y/bQS+gKJS0iBDnrQwMyK8lTnSUUlC8W40TOY
NxUFO+cj6AdMTOqYN2ogGoqE/MBOHXX92G2v5CeFMKQkoSPHIwCICjnIPK+sRPTY
VcuexGK4ym5ht3CxFUVtUmRCXHmttUeOaaj7/IHRYltV0qh1RJHdE0xt7hBJ318O
OCHng7ILfmjNQWdm00TK96B0s875gf9vEjf56mtXTd7yxGB+Upn6ShinXQd8OL3J
yMYiR3lbQG164C/ie9pa+khvcJ4BhrMmqHy4mB5PsSYtj7bKGK1ksOtaddHgkuhc
VwIDAQAB
-----END PUBLIC KEY-----`;

export const LICENSE_WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
