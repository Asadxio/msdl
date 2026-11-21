module.exports = {
  Platform: {
    OS: 'android',
    select: (obj) => obj.android || obj.default,
  },
  NativeModules: {},
  Dimensions: {
    get: () => ({ width: 375, height: 812 }),
  },
};
