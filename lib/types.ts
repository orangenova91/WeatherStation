export type ReadingView = {
  id: string;
  deviceName: string;
  sensorName: string;
  temperature: number;
  humidity: number;
  locationName: string;
  latitude: number;
  longitude: number;
  receivedAt: string;
};

export type PublicReading = ReadingView & {
  sheetName: string;
};

export type SheetSummary = {
  id: string;
  name: string;
  createdAt: string;
};

export const EXAMPLE_READING = {
  deviceName: "esp32-01",
  sensorName: "dht22",
  temperature: 23.4,
  humidity: 55.1,
  locationName: "서울",
  latitude: 37.5665,
  longitude: 126.978,
};
