const DEVICE_ID_KEY = "expenseTrackerDeviceId";

const createDeviceId = () => {
  return crypto.randomUUID();
};

const storedDeviceId =
  localStorage.getItem(DEVICE_ID_KEY);

export const deviceId =
  storedDeviceId || createDeviceId();

if (!storedDeviceId) {
  localStorage.setItem(
    DEVICE_ID_KEY,
    deviceId
  );
}
