# Security Check

URL: https://example.com/
Score: 50/100 (needs work)

## Signals

- HTTPS: yes
- HSTS: no
- CSP: no
- X-Frame-Options: no
- Referrer-Policy: no
- Secure cookies: yes

## Feedback

- HTTPS is enabled.
- Missing HSTS header. Add Strict-Transport-Security once HTTPS is stable.
- Missing Content-Security-Policy. Add a CSP to reduce script injection risk.
- Missing X-Frame-Options. Add clickjacking protection.
- Missing Referrer-Policy. Add one to avoid leaking full URLs.
