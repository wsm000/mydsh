// @local/dsh-user-presets — patch-only DSH bundle.
// The preset rows live in cordis.patch.yml (dsh.bundle.patch); this entry exists
// so the package resolves (the profile preflight require.resolve()s every
// dependency). Nothing imports it.
export const name = '@local/dsh-user-presets'
