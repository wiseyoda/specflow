# Security Checklist

> Security patterns, input validation, and data protection guidelines for SpecFlow projects.

**Last Updated**: 2026-01-21
**Constitution Alignment**: Principle V (Helpful Errors), Principle VI (Safe Operations)

---

## Overview

This checklist defines security standards that `/flow.verify` checks during memory compliance verification (Step 5, Agent 5). All implementations should follow these patterns.

---

## Input Validation

| Check | Requirement | Example |
|-------|-------------|---------|
| User input boundaries | Validate all user inputs at system boundaries | CLI args, API params, form fields |
| Path traversal | Prevent directory traversal attacks | Reject paths containing `..` |
| Command injection | Sanitize inputs used in shell commands | Quote variables, avoid `eval` |
| Type coercion | Validate types explicitly | Use Zod schemas for validation |

**Pattern**:
```typescript
// Good: Validate at boundary
const input = z.string().min(1).max(100).parse(userInput);

// Bad: Trust user input
const query = `SELECT * FROM users WHERE name = '${userInput}'`;
```

---

## Error Handling

| Check | Requirement | Example |
|-------|-------------|---------|
| No sensitive data | Error messages must not expose secrets | No API keys, passwords, paths |
| Safe stack traces | Production errors hide implementation details | Generic message + error code |
| Fail secure | On error, default to safe/denied state | Auth failure = access denied |

**Pattern**:
```typescript
// Good: Generic error with code
throw new SpecflowError('Operation failed', 'E_OPERATION_FAILED');

// Bad: Exposes internals
throw new Error(`Database error: ${dbError.message} at ${dbError.stack}`);
```

---

## Authentication & Authorization

| Check | Requirement | Example |
|-------|-------------|---------|
| Auth on sensitive ops | Protected operations require authentication | File writes, config changes |
| Principle of least privilege | Request minimum necessary permissions | Read-only when possible |
| Token handling | Never log or expose auth tokens | Mask in debug output |

---

## Data Protection

| Check | Requirement | Example |
|-------|-------------|---------|
| No secrets in code | Credentials in environment variables | `process.env.API_KEY` |
| No secrets in commits | Use `.gitignore` for sensitive files | `.env`, `credentials.json` |
| Secure storage | Use Keychain/secure storage for credentials | Not localStorage/UserDefaults |
| Encryption at rest | Sensitive data encrypted when stored | Use platform secure storage |

**Pattern**:
```bash
# Good: Environment variable
API_KEY=$SPECFLOW_API_KEY

# Bad: Hardcoded secret
API_KEY="sk-1234567890abcdef"
```

---

## File System Operations

| Check | Requirement | Example |
|-------|-------------|---------|
| Path validation | Resolve and validate paths before use | `path.resolve()` then check |
| Sandbox enforcement | Operations stay within project directory | Reject absolute paths outside |
| Safe file permissions | Create files with restrictive permissions | 0600 for secrets, 0644 for config |

**Pattern**:
```typescript
// Good: Validate path is within project
const resolved = path.resolve(projectRoot, userPath);
if (!resolved.startsWith(projectRoot)) {
  throw new Error('Path outside project directory');
}
```

---

## Verification Commands

```bash
# Check for hardcoded secrets
grep -r "password\|secret\|api_key\|token" --include="*.ts" src/

# Check for unsafe eval usage
grep -r "eval\|Function(" --include="*.ts" src/

# Verify .gitignore includes sensitive patterns
cat .gitignore | grep -E "\.env|credentials|secret"
```

---

## Checklist Items for /flow.verify

When verifying security compliance, check:

- [ ] SEC-001: No hardcoded credentials in source code
- [ ] SEC-002: Environment variables used for sensitive config
- [ ] SEC-003: User inputs validated at system boundaries
- [ ] SEC-004: Error messages don't expose sensitive information
- [ ] SEC-005: File operations stay within project sandbox
- [ ] SEC-006: Auth checks on sensitive operations
- [ ] SEC-007: .gitignore excludes sensitive files
