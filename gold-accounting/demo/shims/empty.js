module.exports = {
  join: (...p) => p.filter(Boolean).join('/'),
  tmpdir: () => '/tmp',
  mkdirSync() {}, unlink() {},
};
