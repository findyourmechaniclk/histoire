/**
 * Render keys for hosts that list contributions (outlets, toolbars). Keys follow contribution
 * objects: a contribution re-registered under the same id
 * is a new object and remounts its view; context changes never do.
 */
export function createContributionKeys(): (contribution: object) => string {
  const keys = new WeakMap<object, string>()
  let next = 0
  return (contribution) => {
    let key = keys.get(contribution)
    if (key === undefined) keys.set(contribution, key = `contribution-${next++}`)
    return key
  }
}
