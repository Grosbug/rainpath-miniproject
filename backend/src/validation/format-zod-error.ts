import { ZodError, ZodIssue } from 'zod'

export type FormattedIssue = {
  code: string
  message: string
  path: (string | number)[]
}

export function formatZodError(err: ZodError): FormattedIssue[] {
  return err.issues.map((issue: ZodIssue) => ({
    code: issue.code,
    message: issue.message,
    path: issue.path
  }))
}
