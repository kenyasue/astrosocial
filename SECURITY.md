# Security Policy

## Reporting a vulnerability

Please report security issues **privately**. Do not open a public GitHub issue for
vulnerabilities.

- Email the maintainers (see the repository owner's profile), or use GitHub's
  "Report a vulnerability" (Security Advisories) if enabled.
- Include a description, reproduction steps, affected version/commit, and impact.
- We aim to acknowledge reports within a few days and will keep you updated on a fix.

## Scope

AstroSocial is self-hosted. Operators are responsible for TLS termination, network
exposure, backups, and environment secrets. The application itself implements:

- Passwordless email-PIN auth with hashed PINs and session tokens, rate limiting,
  and HttpOnly + SameSite cookies (Secure in production).
- Parameterized SQL everywhere (no ORM); allowlists for any dynamic SQL.
- Sanitized Markdown / imported HTML (XSS protection); `rel="noopener noreferrer"`
  on external links.
- Upload hardening: MIME + extension + size validation, randomized stored names,
  non-executable upload directory, path-traversal guards, image re-encoding.
- Visibility checks on media serving; ownership checks on all mutations.

## Supported versions

This project is pre-1.0; security fixes target the `main` branch.
