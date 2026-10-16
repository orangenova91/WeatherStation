export type ReadingView = {
  id: string;
  senderName: string;
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

export type PublicMapStats = {
  totalReadings: number;
  stationCount: number;
  freshStationCount: number;
  lastReceivedAt: string | null;
};

export type SheetSummary = {
  id: string;
  name: string;
  createdAt: string;
  totalReadings: number;
  locationNames: string[];
  lastReceivedAt: string | null;
  isFresh: boolean;
};

export const EXAMPLE_READING = {
  deviceName: "esp32-01",
  sensorName: "dht11",
  temperature: 23.4,
  humidity: 55.1,
  locationName: "서울",
  latitude: 37.56651,
  longitude: 126.97806,
  senderName: "kim",
};
