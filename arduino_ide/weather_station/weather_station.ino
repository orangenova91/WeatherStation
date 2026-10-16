#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <DHT.h>
#include <WiFi.h>
#include <WiFiManager.h>   // 라이브러리 매니저에서 "WiFiManager by tzapu" 설치 필요
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <Preferences.h>
#include <stdlib.h>

// ===== OLED 디스플레이 설정 =====
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET    -1
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// ===== DHT 센서 설정 =====
#define DHTPIN 4          // DHT 센서 연결 핀 (GPIO 4)
#define DHTTYPE DHT11     // DHT22 사용 시 DHT22로 수정하고, 포털의 센서명도 맞춘다
DHT dht(DHTPIN, DHTTYPE);

// ===== 조이스틱 설정 (ESP32 ADC1 핀 사용: Wi-Fi 사용 시에도 안전) =====
#define JOY_VRX 34
#define JOY_VRY 35   // 현재는 미사용 (추후 상하 기능 확장용)
#define JOY_SW  32

#define JOY_CENTER    2048   // ESP32 ADC 12비트(0~4095) 기준 중앙값
#define JOY_THRESHOLD 1200   // 이 값 이상 벗어나야 "기울임"으로 판정
#define JOY_RETURN_BAND 300  // 중앙 근처로 이 값 이내로 돌아오면 "중립"으로 인정

// ===== WiFiManager 인스턴스 =====
WiFiManager wm;
const char* WIFI_AP_NAME = "ESP32-Setup";
const unsigned long WIFI_PORTAL_TIMEOUT = 180;

// ===== Weather Station 플랫폼 전송 설정 =====
// 시트 화면의 토큰만 캡티브 포털에서 입력한다.
// 전송 주소는 아래 고정 주소 뒤에 토큰을 붙여 만든다.
const char* INGEST_BASE_URL = "https://weatherstation.schub.kr/api/ingest/";
// 구글 시트용으로 저장해 둔 값은 쓰지 않도록 저장 공간을 분리했다.
Preferences prefs;
String ingestToken = "";
String senderName = "";
String deviceName = "";
String sensorName = "";
String locationName = "";
String deviceLat = "";
String deviceLng = "";

#define INGEST_TOKEN_MAX_LEN 20
#define SENDER_NAME_MAX_LEN 40
#define DEVICE_NAME_MAX_LEN 40
#define SENSOR_NAME_MAX_LEN 40
#define LOCATION_NAME_MAX_LEN 40
#define LAT_LNG_MAX_LEN 24

char ingestTokenBuffer[INGEST_TOKEN_MAX_LEN] = "";
char senderNameBuffer[SENDER_NAME_MAX_LEN] = "";
char deviceNameBuffer[DEVICE_NAME_MAX_LEN] = "";
char sensorNameBuffer[SENSOR_NAME_MAX_LEN] = "DHT11";
char locationNameBuffer[LOCATION_NAME_MAX_LEN] = "";
char latBuffer[LAT_LNG_MAX_LEN] = "";
char lngBuffer[LAT_LNG_MAX_LEN] = "";

WiFiManagerParameter customIngestTokenParam("token", "Token", ingestTokenBuffer, INGEST_TOKEN_MAX_LEN);
WiFiManagerParameter customDeviceNameParam("devicename", "Device Name", deviceNameBuffer, DEVICE_NAME_MAX_LEN);
WiFiManagerParameter customSensorNameParam("sensorname", "Sensor Name", sensorNameBuffer, SENSOR_NAME_MAX_LEN);
WiFiManagerParameter customLocationNameParam("locname", "Location Name", locationNameBuffer, LOCATION_NAME_MAX_LEN);
WiFiManagerParameter customLatParam("lat", "Latitude (e.g. 35.53847)", latBuffer, LAT_LNG_MAX_LEN);
WiFiManagerParameter customLngParam("lng", "Longitude (e.g. 129.31142)", lngBuffer, LAT_LNG_MAX_LEN);
// 위도/경도 필드 아래: 휴대폰 GPS로 채우기 시도 (실패 시 수동 입력)
WiFiManagerParameter customGeoHelp(
  "<br/><button type='button' onclick='fillCoordsFromPhone()'>Use my location</button>"
  "<div id='geoStatus' style='font-size:12px;margin:6px 0 4px;opacity:.85'></div>"
  "<p style='font-size:12px;margin:0 0 8px;opacity:.75'>If blocked by the browser, enter Latitude/Longitude manually.</p>"
);
WiFiManagerParameter customSenderNameParam("sendername", "Sender Name", senderNameBuffer, SENDER_NAME_MAX_LEN);

// 캡티브 포털(HTTP)에서는 브라우저가 Geolocation을 막을 수 있음. 되면 채우고, 안 되면 수동 입력.
const char GEO_HEAD_SCRIPT[] =
  "<script>"
  "function fillCoordsFromPhone(){"
  "var status=document.getElementById('geoStatus');"
  "var latEl=document.getElementById('lat');"
  "var lngEl=document.getElementById('lng');"
  "if(!latEl||!lngEl){if(status)status.textContent='Lat/Lng fields not found.';return;}"
  "if(!navigator.geolocation){if(status)status.textContent='Geolocation not supported. Enter manually.';return;}"
  "if(status)status.textContent='Getting location...';"
  "navigator.geolocation.getCurrentPosition(function(pos){"
  "latEl.value=pos.coords.latitude.toFixed(5);"
  "lngEl.value=pos.coords.longitude.toFixed(5);"
  "if(status)status.textContent='Location filled. You can edit if needed.';"
  "},function(err){"
  "if(status)status.textContent='Could not get location. Enter Latitude/Longitude manually.';"
  "},{enableHighAccuracy:true,timeout:15000,maximumAge:60000});"
  "}"
  "</script>";

// ===== 화면 상태 정의 =====
enum ScreenState { HOME, MENU, MEASURING, SET_INTERVAL, WIFI_CONNECT };
ScreenState currentState = HOME;

const char* menuItems[] = {
  "1. Start Measure",
  "2. Set Interval",
  "3. WiFi Connect",
  "4. Reboot"
};
const int MENU_COUNT = 4;
int menuIndex = 0;

// 측정 주기이자 플랫폼 전송 주기. 전원 재시작 시 10분으로 돌아간다.
unsigned long measureInterval = 600000UL;
const unsigned long MIN_INTERVAL = 60000UL;
const unsigned long MAX_INTERVAL = 3600000UL;
const unsigned long INTERVAL_STEP = 60000UL;

unsigned long lastMeasureTime = 0;

bool lastButtonReading = HIGH;
bool buttonState = HIGH;
unsigned long lastDebounceTime = 0;
const unsigned long DEBOUNCE_DELAY = 50;
bool buttonClicked = false;

bool joyYNeutral = true;

const unsigned long EXIT_HOLD_DURATION = 3000;
const unsigned long HOLD_DISPLAY_INTERVAL = 100;
bool exitHoldActive = false;
unsigned long exitHoldStart = 0;
unsigned long lastHoldDisplayUpdate = 0;

bool wifiInputArmed = true;

void setup() {
  Serial.begin(115200);
  pinMode(JOY_SW, INPUT_PULLUP);

  prefs.begin("wscfg", true);
  ingestToken = prefs.getString("token", "");
  senderName = prefs.getString("sender", "");
  deviceName = prefs.getString("devname", "");
  sensorName = prefs.getString("sensor", "DHT11");
  locationName = prefs.getString("locname", "");
  deviceLat = prefs.getString("lat", "");
  deviceLng = prefs.getString("lng", "");
  prefs.end();
  if (sensorName.length() == 0) sensorName = "DHT11";

  wm.addParameter(&customIngestTokenParam);
  wm.addParameter(&customDeviceNameParam);
  wm.addParameter(&customSensorNameParam);
  wm.addParameter(&customLocationNameParam);
  wm.addParameter(&customLatParam);
  wm.addParameter(&customLngParam);
  wm.addParameter(&customGeoHelp);
  wm.addParameter(&customSenderNameParam);
  wm.setCustomHeadElement(GEO_HEAD_SCRIPT);

  dht.begin();

  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println(F("SSD1306 OLED 초기화 실패"));
    for (;;);
  }

  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 20);
  display.println("Initializing...");
  display.display();
  delay(1000);

  currentState = HOME;
  drawHomeScreen();
}

void loop() {
  updateButton();
  int joyYMove = readJoystickY();

  switch (currentState) {
    case HOME:
      if (buttonClicked) {
        currentState = MENU;
        menuIndex = 0;
        drawMenuScreen();
      }
      break;

    case MENU:
      if (joyYMove != 0) {
        menuIndex = (menuIndex + joyYMove + MENU_COUNT) % MENU_COUNT;
        drawMenuScreen();
      }
      if (buttonClicked) {
        handleMenuSelect();
      }
      break;

    case MEASURING:
      if (buttonState == LOW) {
        if (!exitHoldActive) {
          exitHoldActive = true;
          exitHoldStart = millis();
        }
        unsigned long heldTime = millis() - exitHoldStart;
        if (heldTime >= EXIT_HOLD_DURATION) {
          exitHoldActive = false;
          currentState = MENU;
          drawMenuScreen();
        } else if (millis() - lastHoldDisplayUpdate >= HOLD_DISPLAY_INTERVAL) {
          lastHoldDisplayUpdate = millis();
          drawHoldProgress(heldTime);
        }
      } else {
        if (exitHoldActive) {
          exitHoldActive = false;
          drawHoldProgress(0);
        }
        runMeasurement();
      }
      break;

    case SET_INTERVAL:
      if (joyYMove != 0) {
        long newInterval = (long)measureInterval - (joyYMove * (long)INTERVAL_STEP);
        newInterval = constrain(newInterval, (long)MIN_INTERVAL, (long)MAX_INTERVAL);
        measureInterval = (unsigned long)newInterval;
        drawSetIntervalScreen();
      }
      if (buttonClicked) {
        currentState = MENU;
        drawMenuScreen();
      }
      break;

    case WIFI_CONNECT: {
      bool wifiConnected = (WiFi.status() == WL_CONNECTED);

      if (!wifiConnected) {
        if (buttonClicked) {
          currentState = MENU;
          drawMenuScreen();
        }
        break;
      }

      if (!wifiInputArmed) {
        if (buttonState == HIGH) {
          wifiInputArmed = true;
        }
        break;
      }

      if (buttonState == LOW) {
        if (!exitHoldActive) {
          exitHoldActive = true;
          exitHoldStart = millis();
        }
        unsigned long heldTime = millis() - exitHoldStart;
        if (heldTime >= EXIT_HOLD_DURATION) {
          exitHoldActive = false;
          resetWiFiCredentials();
        } else if (millis() - lastHoldDisplayUpdate >= HOLD_DISPLAY_INTERVAL) {
          lastHoldDisplayUpdate = millis();
          drawHoldProgress(heldTime);
        }
      } else if (exitHoldActive) {
        exitHoldActive = false;
        currentState = MENU;
        drawMenuScreen();
      }
      break;
    }
  }

  buttonClicked = false;
}

void updateButton() {
  bool reading = digitalRead(JOY_SW);

  if (reading != lastButtonReading) {
    lastDebounceTime = millis();
  }

  if ((millis() - lastDebounceTime) > DEBOUNCE_DELAY) {
    if (reading != buttonState) {
      buttonState = reading;
      if (buttonState == LOW) {
        buttonClicked = true;
      }
    }
  }

  lastButtonReading = reading;
}

int readJoystickY() {
  int yVal = analogRead(JOY_VRX);

  if (joyYNeutral) {
    if (yVal < JOY_CENTER - JOY_THRESHOLD) {
      joyYNeutral = false;
      return -1;
    } else if (yVal > JOY_CENTER + JOY_THRESHOLD) {
      joyYNeutral = false;
      return 1;
    }
  } else {
    if (abs(yVal - JOY_CENTER) < JOY_RETURN_BAND) {
      joyYNeutral = true;
    }
  }
  return 0;
}

void drawWifiStatusIcon() {
  bool connected = (WiFi.status() == WL_CONNECTED);

  const int baseX = SCREEN_WIDTH - 10;
  const int baseY = 7;

  if (connected) {
    const int barWidth = 2;
    const int barGap = 1;
    const int barHeights[3] = {2, 4, 6};
    for (int i = 0; i < 3; i++) {
      int barX = baseX + i * (barWidth + barGap);
      int barH = barHeights[i];
      int barY = baseY - barH;
      display.fillRect(barX, barY, barWidth, barH, SSD1306_WHITE);
    }
  } else {
    display.drawLine(baseX, baseY - 6, baseX + 7, baseY, SSD1306_WHITE);
    display.drawLine(baseX, baseY, baseX + 7, baseY - 6, SSD1306_WHITE);
  }
}

// 측정 화면 전용: WiFi 아이콘 바로 왼쪽에 주기(분) 표시
void drawIntervalNearWifi() {
  unsigned long minutes = measureInterval / 60000UL;
  String label = String(minutes) + "m";
  const int charWidth = 6;
  const int wifiLeft = SCREEN_WIDTH - 10;
  int x = wifiLeft - (int)label.length() * charWidth - 2;

  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(x, 0);
  display.print(label);
}

void drawHomeScreen() {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(10, 15);
  display.println("Weather Station");
  display.setCursor(25, 30);
  display.println("v1.0.1");
  display.setCursor(5, 50);
  display.println("Press button: Menu");
  drawWifiStatusIcon();
  display.display();
}

void drawMenuScreen() {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println("== MENU ==");

  for (int i = 0; i < MENU_COUNT; i++) {
    display.setCursor(0, 14 + i * 12);
    display.print(i == menuIndex ? "> " : "  ");
    display.println(menuItems[i]);
  }
  drawWifiStatusIcon();
  display.display();
}

void handleMenuSelect() {
  switch (menuIndex) {
    case 0:
      currentState = MEASURING;
      // lastMeasureTime=0은 부팅 후 measureInterval 동안 첫 측정을 막음.
      // 진입 즉시 1회 측정되도록 주기가 이미 지난 것처럼 맞춘다.
      lastMeasureTime = millis() - measureInterval;
      display.clearDisplay();
      display.setTextSize(1);
      display.setTextColor(SSD1306_WHITE);
      display.setCursor(0, 20);
      display.println("Measuring...");
      drawIntervalNearWifi();
      drawWifiStatusIcon();
      display.display();
      break;

    case 1:
      currentState = SET_INTERVAL;
      drawSetIntervalScreen();
      break;

    case 2:
      startWiFiSetup();
      break;

    case 3:
      display.clearDisplay();
      display.setTextSize(1);
      display.setCursor(20, 28);
      display.println("Rebooting...");
      display.display();
      delay(800);
      ESP.restart();
      break;
  }
}

void drawSetIntervalScreen() {
  display.clearDisplay();
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.println("SET INTERVAL");
  display.println("------------");

  display.setTextSize(2);
  display.setCursor(20, 28);
  display.print(measureInterval / 60000);
  display.println("m");

  display.setTextSize(1);
  display.setCursor(0, 54);
  display.println("Joy:+/-  Btn:OK");
  drawWifiStatusIcon();
  display.display();
}

void copyToParam(const String& value, char* buffer, int length, WiFiManagerParameter& param) {
  value.toCharArray(buffer, length);
  param.setValue(buffer, length);
}

void startWiFiSetup() {
  if (WiFi.status() == WL_CONNECTED) {
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);
    display.setCursor(0, 0);
    display.println("WIFI SETUP");
    display.println("------------");
    display.setCursor(0, 20);
    display.println("Already connected:");
    display.println(WiFi.SSID());
    display.println(WiFi.localIP().toString());
    display.setCursor(0, 48);
    display.println("Btn:Menu Hold:Reset");
    drawWifiStatusIcon();
    display.display();

    currentState = WIFI_CONNECT;
    wifiInputArmed = false;
    return;
  }

  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println("WIFI SETUP");
  display.println("------------");
  display.setCursor(0, 16);
  display.println("Connect phone to:");
  display.setCursor(0, 26);
  display.print("  ");
  display.println(WIFI_AP_NAME);
  display.setCursor(0, 40);
  display.println("Open 192.168.4.1");
  display.setCursor(0, 50);
  display.println("if no popup appears");
  drawWifiStatusIcon();
  display.display();

  copyToParam(ingestToken, ingestTokenBuffer, INGEST_TOKEN_MAX_LEN, customIngestTokenParam);
  copyToParam(senderName, senderNameBuffer, SENDER_NAME_MAX_LEN, customSenderNameParam);
  copyToParam(deviceName, deviceNameBuffer, DEVICE_NAME_MAX_LEN, customDeviceNameParam);
  copyToParam(sensorName, sensorNameBuffer, SENSOR_NAME_MAX_LEN, customSensorNameParam);
  copyToParam(locationName, locationNameBuffer, LOCATION_NAME_MAX_LEN, customLocationNameParam);
  copyToParam(deviceLat, latBuffer, LAT_LNG_MAX_LEN, customLatParam);
  copyToParam(deviceLng, lngBuffer, LAT_LNG_MAX_LEN, customLngParam);

  wm.setConfigPortalTimeout(WIFI_PORTAL_TIMEOUT);
  bool connected = wm.autoConnect(WIFI_AP_NAME);

  if (connected) {
    String enteredToken = customIngestTokenParam.getValue();
    enteredToken.trim();
    if (enteredToken.length() > 0) ingestToken = enteredToken;

    String enteredSender = customSenderNameParam.getValue();
    enteredSender.trim();
    if (enteredSender.length() > 0) senderName = enteredSender;

    String enteredName = customDeviceNameParam.getValue();
    enteredName.trim();
    if (enteredName.length() > 0) deviceName = enteredName;

    String enteredSensor = customSensorNameParam.getValue();
    enteredSensor.trim();
    if (enteredSensor.length() > 0) sensorName = enteredSensor;

    String enteredLocation = customLocationNameParam.getValue();
    enteredLocation.trim();
    if (enteredLocation.length() > 0) locationName = enteredLocation;

    String enteredLat = customLatParam.getValue();
    enteredLat.trim();
    if (enteredLat.length() > 0) deviceLat = enteredLat;

    String enteredLng = customLngParam.getValue();
    enteredLng.trim();
    if (enteredLng.length() > 0) deviceLng = enteredLng;

    prefs.begin("wscfg", false);
    prefs.putString("token", ingestToken);
    prefs.putString("sender", senderName);
    prefs.putString("devname", deviceName);
    prefs.putString("sensor", sensorName);
    prefs.putString("locname", locationName);
    prefs.putString("lat", deviceLat);
    prefs.putString("lng", deviceLng);
    prefs.end();

    Serial.print("토큰 저장됨: ");
    Serial.println(ingestToken);
    Serial.print("발신자명/기기명/센서명/위치명: ");
    Serial.print(senderName);
    Serial.print(" / ");
    Serial.print(deviceName);
    Serial.print(" / ");
    Serial.print(sensorName);
    Serial.print(" / ");
    Serial.println(locationName);
    Serial.print("위도/경도: ");
    Serial.print(deviceLat);
    Serial.print(", ");
    Serial.println(deviceLng);
  }

  display.clearDisplay();
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.println("WIFI SETUP");
  display.println("------------");

  if (connected) {
    display.setCursor(0, 20);
    display.println("Connected!");
    display.println(WiFi.SSID());
    display.println(WiFi.localIP().toString());
  } else {
    display.setCursor(0, 20);
    display.println("Setup timed out");
    display.println("or failed.");
    display.println("Try again later.");
  }

  display.setCursor(0, 56);
  display.println("Press button: Menu");
  drawWifiStatusIcon();
  display.display();

  currentState = WIFI_CONNECT;
  wifiInputArmed = false;
}

void resetWiFiCredentials() {
  wm.resetSettings();

  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println("WIFI SETUP");
  display.println("------------");
  display.setCursor(0, 24);
  display.println("WiFi info erased.");
  display.println("Set up again from");
  display.println("the menu.");
  display.setCursor(0, 56);
  display.println("Press button: Menu");
  drawWifiStatusIcon();
  display.display();
}

void drawHoldProgress(unsigned long heldTime) {
  int barWidth = map(heldTime, 0, EXIT_HOLD_DURATION, 0, SCREEN_WIDTH - 2);
  barWidth = constrain(barWidth, 0, SCREEN_WIDTH - 2);

  display.fillRect(0, 59, SCREEN_WIDTH, 5, SSD1306_BLACK);
  display.drawRect(0, 59, SCREEN_WIDTH, 5, SSD1306_WHITE);
  if (barWidth > 0) {
    display.fillRect(1, 60, barWidth, 3, SSD1306_WHITE);
  }
  display.display();
}

String jsonEscape(const String& value) {
  String out;
  out.reserve(value.length() + 4);
  for (unsigned int i = 0; i < value.length(); i++) {
    char c = value.charAt(i);
    if (c == '"' || c == '\\') out += '\\';
    if (c == '\n' || c == '\r') continue;
    out += c;
  }
  return out;
}

bool isDecimal(const String& value) {
  if (value.length() == 0) return false;
  char* end = nullptr;
  strtod(value.c_str(), &end);
  return end != value.c_str() && *end == '\0';
}

// 고정 주소 뒤에 토큰을 붙여 JSON을 POST 한다.
void sendToPlatform(float temp, float humi) {
  if (WiFi.status() != WL_CONNECTED) return;
  if (ingestToken.length() == 0 || senderName.length() == 0 || deviceName.length() == 0 || sensorName.length() == 0 || locationName.length() == 0) {
    Serial.println("플랫폼 전송 생략: 토큰, 발신자명, 기기명, 센서명, 위치명을 WiFi 설정에서 입력하세요.");
    return;
  }
  if (!isDecimal(deviceLat) || !isDecimal(deviceLng)) {
    Serial.println("플랫폼 전송 생략: 위도와 경도는 숫자여야 합니다.");
    return;
  }

  String url = String(INGEST_BASE_URL) + ingestToken;
  WiFiClientSecure secureClient;
  secureClient.setInsecure();
  HTTPClient http;
  bool started = http.begin(secureClient, url);

  if (!started) {
    Serial.println("플랫폼 전송: HTTP 연결 시작 실패");
    return;
  }

  http.setTimeout(8000);
  http.addHeader("Content-Type", "application/json");

  String payload = "{\"deviceName\":\"" + jsonEscape(deviceName) +
                   "\",\"sensorName\":\"" + jsonEscape(sensorName) +
                   "\",\"temperature\":" + String(temp, 1) +
                   ",\"humidity\":" + String(humi, 1) +
                   ",\"locationName\":\"" + jsonEscape(locationName) +
                   "\",\"latitude\":" + deviceLat +
                   ",\"longitude\":" + deviceLng +
                   ",\"senderName\":\"" + jsonEscape(senderName) + "\"}";

  int httpCode = http.POST(payload);
  String response = http.getString();

  if (httpCode >= 200 && httpCode < 300) {
    Serial.print("플랫폼 전송 완료 (");
    Serial.print(httpCode);
    Serial.print(") ");
    Serial.println(response);
  } else if (httpCode > 0) {
    Serial.print("플랫폼 전송 거절 (");
    Serial.print(httpCode);
    Serial.print(") ");
    Serial.println(response);
  } else {
    Serial.print("플랫폼 전송 실패: ");
    Serial.println(http.errorToString(httpCode));
  }

  http.end();
}

void runMeasurement() {
  unsigned long now = millis();
  if (now - lastMeasureTime < measureInterval) {
    return;
  }
  lastMeasureTime = now;

  float h = dht.readHumidity();
  float t = dht.readTemperature();

  if (isnan(h) || isnan(t)) {
    Serial.println("DHT 센서 값을 읽어올 수 없습니다.");

    display.clearDisplay();
    display.setTextSize(1);
    display.setCursor(0, 20);
    display.println("Sensor Read Error!");
    drawIntervalNearWifi();
    drawWifiStatusIcon();
    display.display();
    return;
  }

  Serial.print("온도: ");
  Serial.print(t);
  Serial.print(" °C | 습도: ");
  Serial.print(h);
  Serial.println(" %");

  if (WiFi.status() == WL_CONNECTED) {
    sendToPlatform(t, h);
  }

  display.clearDisplay();

  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println("TEMP & HUMIDITY");
  display.println("---------------------");

  display.setTextSize(2);
  display.setCursor(0, 18);
  display.print("Temp: ");
  display.print(t, 1);
  display.write(167);
  display.print("C");

  display.setCursor(0, 36);
  display.print("Humi: ");
  display.print(h, 1);
  display.println(" %");

  display.setTextSize(1);
  display.setCursor(0, 54);
  display.println("Hold btn 3s: Menu");

  drawIntervalNearWifi();
  drawWifiStatusIcon();
  display.display();
}
