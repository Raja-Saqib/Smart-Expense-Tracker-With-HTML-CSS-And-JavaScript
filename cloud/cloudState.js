let cloudMeta = {
  version: 0,
  updatedAt: 0,
  deviceId: null
};

export const getCloudMeta = () => cloudMeta;

export const setCloudMeta = meta => {
  cloudMeta = meta;
};
