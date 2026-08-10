const plainArgument = /^[a-z0-9](?:[-a-z0-9.]*[a-z0-9])?$/

export function shellArgument(value: string): string {
  return plainArgument.test(value) ? value : `'${value.replaceAll("'", "'\\''")}'`
}
