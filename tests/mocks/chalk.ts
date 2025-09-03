const chalk = new Proxy({}, {
  get: () => (s: any) => String(s)
})
export default chalk

