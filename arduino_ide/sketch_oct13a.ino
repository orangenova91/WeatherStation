#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <DHT.h>
#include <WiFi.h>
#include <WiFiManager.h>   // 라이브러리 매니저에서 "WiFiManager by tzapu" 설치 필요
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <Preferences.h>

// ===== OLED 디스플레이 설정 =====
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET    -1
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// ===== DHT 센서 설정 =====
#define DHTPIN 4          // DHT 센서 연결 핀 (GPIO 4)
#define DHTTYPE DHT11     // DHT22 사용 시 DHT22로 수정
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
const char* WIFI_AP_NAME = "ESP32-Setup";        // 설정 시 뜨는 임시 AP 이름
const unsigned long WIFI_PORTAL_TIMEOUT = 180;   // 캡티브 포털 타임아웃(초)

// ===== 구글 시트 전송 설정 =====
// 웹앱 URL은 하드코딩하지 않고, 최초 WiFi 설정(캡티브 포털) 화면에서
// 휴대폰으로 와이파이 비밀번호와 함께 한 번에 입력받아 NVS(Preferences)에 저장한다.
Preferences prefs;
String googleScriptUrl = ""; // setup()에서 저장된 값을 불러오거나, 최초 WiFi 설정 시 입력받아 채워짐

#define SHEET_URL_MAX_LEN 220
char sheetUrlBuffer[SHEET_URL_MAX_LEN] = "";
// 포털 화면에 "Google Sheet URL"이라는 이름의 입력칸을 추가 (id: sheeturl)
WiFiManagerParameter customSheetUrlParam("sheeturl", "Google Sheet URL", sheetUrlBuffer, SHEET_URL_MAX_LEN);

// ===== 기기명 / 위도 / 경도 (같은 WiFi 설정 포털에서 함께 입력받음, 수동 입력) =====
// 위도/경도는 ESP32에 GPS가 없어 휴대폰 GPS 자동 입력을 시도했으나,
// 브라우저 위치 API가 보안 컨텍스트(HTTPS/localhost)에서만 동작해 캡티브 포털(http://192.168.4.1)
// 에서는 신뢰할 수 없어 수동 숫자 입력 방식으로 결정함.
String deviceName = "";
String deviceLat = "";
String deviceLng = "";

#define DEVICE_NAME_MAX_LEN 40
#define LAT_LNG_MAX_LEN 24
char deviceNameBuffer[DEVICE_NAME_MAX_LEN] = "";
char latBuffer[LAT_LNG_MAX_LEN] = "";
char lngBuffer[LAT_LNG_MAX_LEN] = "";

WiFiManagerParameter customDeviceNameParam("devicename", "Device Name", deviceNameBuffer, DEVICE_NAME_MAX_LEN);
WiFiManagerParameter customLatParam("lat", "Latitude (e.g. 35.5384)", latBuffer, LAT_LNG_MAX_LEN);
WiFiManagerParameter customLngParam("lng", "Longitude (e.g. 129.3114)", lngBuffer, LAT_LNG_MAX_LEN);

// 전송 주기는 별도 타이머 없이 measureInterval(= "2. Set Interval" 값)을 그대로 따른다.
// -> 측정이 성공할 때마다(= "1. Start Measure" 진입 시 즉시 1회 포함) 바로 전송된다.

// ===== 화면 상태 정의 =====
// WIFI_CONNECT: 이미 연결됨 / 설정 완료·실패 결과를 보여주는 화면
enum ScreenState { HOME, MENU, MEASURING, SET_INTERVAL, WIFI_CONNECT };
ScreenState currentState = HOME;

// ===== 메뉴 항목 =====
const char* menuItems[] = {
  "1. Start Measure",
  "2. Set Interval",
  "3. WiFi Connect",
  "4. Reboot"
};
const int MENU_COUNT = 4;
int menuIndex = 0;

// ===== 측정/전송 간격 설정값 (기본 1분, 1~60분 범위 / 전원 재시작 시 초기화됨) =====
// 이 값은 온습도 측정 주기이자, 동시에 구글 시트로 전송하는 주기로도 쓰인다.
unsigned long measureInterval = 60000UL;
const unsigned long MIN_INTERVAL = 60000UL;     // 최소 1분
const unsigned long MAX_INTERVAL = 3600000UL;   // 최대 60분
const unsigned long INTERVAL_STEP = 60000UL;    // 1분 단위

// ===== 측정 타이머 (millis 기반 논블로킹) =====
unsigned long lastMeasureTime = 0;

// ===== 버튼 디바운스 처리용 변수 =====
bool lastButtonReading = HIGH;
bool buttonState = HIGH;
unsigned long lastDebounceTime = 0;
const unsigned long DEBOUNCE_DELAY = 50;
bool buttonClicked = false;   // 이번 loop()에서 클릭이 발생했는지 여부

// ===== 조이스틱 Y축: "한 번 기울임 = 한 번 이동" 처리용 =====
bool joyYNeutral = true;

// ===== MEASURING 화면에서 길게 눌러 나가기 처리용 (오조작 방지) =====
const unsigned long EXIT_HOLD_DURATION = 3000;   // 3초 이상 눌러야 메뉴로 복귀
const unsigned long HOLD_DISPLAY_INTERVAL = 100; // 진행 바 갱신 주기
bool exitHoldActive = false;
unsigned long exitHoldStart = 0;
unsigned long lastHoldDisplayUpdate = 0;

// ===== WIFI_CONNECT 화면 진입 시, 메뉴 선택에 쓰인 클릭이 그대로
//       "취소 클릭"으로 오인식되는 것을 막기 위한 플래그 =====
// 화면에 들어온 뒤 버튼을 한 번 완전히 뗀 다음부터만 새 입력(클릭/홀드)을 인식한다.
bool wifiInputArmed = true;

void setup() {
  Serial.begin(115200);

  pinMode(JOY_SW, INPUT_PULLUP);

  // 이전에 저장된 설정값 불러오기 (없으면 빈 문자열 -> 최초 WiFi 설정 때 입력받음)
  prefs.begin("cloudcfg", true);
  googleScriptUrl = prefs.getString("sheeturl", "");
  deviceName = prefs.getString("devname", "");
  deviceLat = prefs.getString("lat", "");
  deviceLng = prefs.getString("lng", "");
  prefs.end();

  // WiFi 설정 포털에 입력칸들 등록 (한 번만 등록)
  wm.addParameter(&customSheetUrlParam);
  wm.addParameter(&customDeviceNameParam);
  wm.addParameter(&customLatParam);
  wm.addParameter(&customLngParam);

  // DHT 센서 시작
  dht.begin();

  // OLED 초기화 (기본 I2C 주소 0x3C)
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println(F("SSD1306 OLED 초기화 실패"));
    for (;;); // 초기화 실패 시 무한 루프
  }

  // 부팅 화면 안내 메시지
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
  updateButton();                   // 버튼 디바운스 + 클릭 감지
  int joyYMove = readJoystickY();   // -1(위) / 0(없음) / +1(아래)

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
        // 버튼이 눌려있는 동안: 3초 이상 유지되면 메뉴로 복귀 (짧은 오조작 클릭은 무시)
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
          // 3초가 되기 전에 버튼을 뗌 -> 나가기 취소, 진행 바 초기화
          exitHoldActive = false;
          drawHoldProgress(0);
        }
        runMeasurement();
      }
      break;

    case SET_INTERVAL:
      if (joyYMove != 0) {
        // 메뉴 커서 이동 방향(조이스틱 배선에 맞춰 이미 반전됨)과 반대로 적용해야
        // 인터벌 조절 시 체감 방향이 자연스러워서, 여기서만 부호를 뒤집는다.
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
      // WiFi 연결/설정 과정은 startWiFiSetup() 안에서 이미 끝났고,
      // 여기서는 결과 화면을 보여주며 다음 입력을 기다린다.
      bool wifiConnected = (WiFi.status() == WL_CONNECTED);

      if (!wifiConnected) {
        // 연결 안 된 상태(설정 실패/타임아웃 화면, 혹은 초기화 직후):
        // 기존처럼 클릭 한 번으로 메뉴 복귀
        if (buttonClicked) {
          currentState = MENU;
          drawMenuScreen();
        }
        break;
      }

      // 메뉴에서 이 화면을 선택하는 데 쓴 클릭이 아직 안 끝났을 수 있으므로,
      // 버튼을 한 번 완전히 뗄 때까지는 새 입력으로 인식하지 않는다.
      if (!wifiInputArmed) {
        if (buttonState == HIGH) {
          wifiInputArmed = true;
        }
        break;
      }

      // 연결된 상태: 짧은 클릭 = 메뉴 복귀, 3초 이상 길게 누르면 = WiFi 정보 삭제
      if (buttonState == LOW) {
        if (!exitHoldActive) {
          exitHoldActive = true;
          exitHoldStart = millis();
        }
        unsigned long heldTime = millis() - exitHoldStart;
        if (heldTime >= EXIT_HOLD_DURATION) {
          exitHoldActive = false; // 길게 누름으로 소비됨 -> 뗄 때 클릭으로 처리되지 않음
          resetWiFiCredentials();
        } else if (millis() - lastHoldDisplayUpdate >= HOLD_DISPLAY_INTERVAL) {
          lastHoldDisplayUpdate = millis();
          drawHoldProgress(heldTime);
        }
      } else if (exitHoldActive) {
        // 3초가 되기 전에 버튼을 뗌 -> 짧은 클릭으로 간주하여 메뉴로 복귀
        exitHoldActive = false;
        currentState = MENU;
        drawMenuScreen();
      }
      break;
    }
  }

  buttonClicked = false; // 이벤트는 한 번만 처리하고 항상 초기화
}

// ===================== 입력 처리 =====================

// 버튼 디바운스 (INPUT_PULLUP이므로 눌리면 LOW)
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

// 조이스틱 Y축: 기울일 때 딱 한 번만 -1 또는 +1 반환, 중앙 복귀 전까지는 0만 반환
int readJoystickY() {
  int yVal = analogRead(JOY_VRX);

  if (joyYNeutral) {
    if (yVal < JOY_CENTER - JOY_THRESHOLD) {
      joyYNeutral = false;
      return -1; // 위로 기울임 -> 커서 위로
    } else if (yVal > JOY_CENTER + JOY_THRESHOLD) {
      joyYNeutral = false;
      return 1;  // 아래로 기울임 -> 커서 아래로
    }
  } else {
    if (abs(yVal - JOY_CENTER) < JOY_RETURN_BAND) {
      joyYNeutral = true; // 중앙으로 돌아오면 다음 입력 허용
    }
  }
  return 0;
}

// ===================== 화면 그리기 =====================

// 화면 우상단에 WiFi 연결 상태를 표시.
// 연결됨: 신호 막대 3개가 채워진 모양 / 미연결: 같은 자리에 X 표시.
// (막대 폭이 좁으면 "테두리만"과 "꽉 채움"이 육안으로 구분이 안 되는 문제가 있어,
//  아예 다른 모양(X)으로 바꿔 확실히 구분되도록 함)
// 각 화면을 다 그린 뒤, display.display() 호출 직전에 불러써서 모든 화면에 공통 표시한다.
void drawWifiStatusIcon() {
  bool connected = (WiFi.status() == WL_CONNECTED);

  const int baseX = SCREEN_WIDTH - 10; // 아이콘 영역 시작 x (오른쪽 여백 확보)
  const int baseY = 7;                 // 아이콘 영역의 아랫변 y 좌표

  if (connected) {
    // 신호 막대 3개 (오름차순으로 채워짐)
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
    // 연결 안 됨: 같은 영역에 X 표시 (막대 모양과 확실히 다른 형태)
    display.drawLine(baseX, baseY - 6, baseX + 7, baseY, SSD1306_WHITE);
    display.drawLine(baseX, baseY, baseX + 7, baseY - 6, SSD1306_WHITE);
  }
}

void drawHomeScreen() {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(10, 15);
  display.println("TEMP & HUMIDITY");
  display.setCursor(25, 30);
  display.println("MONITOR");
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

  // 항목이 4개로 늘어나 한 줄당 간격을 12px로 줄여 화면(64px) 안에 맞춤
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
    case 0: // 온습도 측정 시작
      currentState = MEASURING;
      lastMeasureTime = 0; // 진입 즉시 1회 측정되도록
      break;

    case 1: // 측정 간격 설정
      currentState = SET_INTERVAL;
      drawSetIntervalScreen();
      break;

    case 2: // WiFi 연결 설정
      startWiFiSetup(); // 연결 상태에 따라 화면 분기 + currentState 설정까지 내부에서 처리
      break;

    case 3: // 재부팅
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
  display.print(measureInterval / 60000); // 항상 1분 단위이므로 정수로 표시
  display.println("m");

  display.setTextSize(1);
  display.setCursor(0, 54);
  display.println("Joy:+/-  Btn:OK");
  drawWifiStatusIcon();
  display.display();
}

// ===================== WiFi 연결 (WiFiManager 캡티브 포털, 블로킹) =====================

// 메뉴에서 "WiFi Connect" 선택 시 1회 호출.
// 이미 연결되어 있으면 currentState=WIFI_CONNECT로 정보 화면만 보여준다 (블로킹 없음).
// 연결 안 되어 있으면 wm.autoConnect()로 캡티브 포털을 띄운다 — 이 호출은 블로킹이라
// 포털이 떠 있는 동안(최대 WIFI_PORTAL_TIMEOUT초)에는 버튼/조이스틱 입력이 처리되지 않는다.
// (논블로킹 방식으로 도중에 취소 가능하게 해봤으나 리셋 루프가 발생해 안정적인 블로킹 방식으로 되돌림)
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
    wifiInputArmed = false; // 이 메뉴를 선택한 클릭이 완전히 끝날 때까지 입력 무시
    return;
  }

  // 설정 안내 화면 (사용자가 휴대폰으로 AP에 접속할 시간을 줌)
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

  // 포털 입력칸에 기존에 저장된 값이 있으면 미리 채워서 보여줌 (없으면 빈 칸)
  googleScriptUrl.toCharArray(sheetUrlBuffer, SHEET_URL_MAX_LEN);
  customSheetUrlParam.setValue(sheetUrlBuffer, SHEET_URL_MAX_LEN);
  deviceName.toCharArray(deviceNameBuffer, DEVICE_NAME_MAX_LEN);
  customDeviceNameParam.setValue(deviceNameBuffer, DEVICE_NAME_MAX_LEN);
  deviceLat.toCharArray(latBuffer, LAT_LNG_MAX_LEN);
  customLatParam.setValue(latBuffer, LAT_LNG_MAX_LEN);
  deviceLng.toCharArray(lngBuffer, LAT_LNG_MAX_LEN);
  customLngParam.setValue(lngBuffer, LAT_LNG_MAX_LEN);

  wm.setConfigPortalTimeout(WIFI_PORTAL_TIMEOUT);
  bool connected = wm.autoConnect(WIFI_AP_NAME);

  // 와이파이 연결에 성공했으면, 같은 포털 화면에서 입력받은 값들도 저장
  if (connected) {
    String enteredUrl = customSheetUrlParam.getValue();
    enteredUrl.trim();
    if (enteredUrl.length() > 0) googleScriptUrl = enteredUrl;

    String enteredName = customDeviceNameParam.getValue();
    enteredName.trim();
    if (enteredName.length() > 0) deviceName = enteredName;

    String enteredLat = customLatParam.getValue();
    enteredLat.trim();
    if (enteredLat.length() > 0) deviceLat = enteredLat;

    String enteredLng = customLngParam.getValue();
    enteredLng.trim();
    if (enteredLng.length() > 0) deviceLng = enteredLng;

    prefs.begin("cloudcfg", false);
    prefs.putString("sheeturl", googleScriptUrl);
    prefs.putString("devname", deviceName);
    prefs.putString("lat", deviceLat);
    prefs.putString("lng", deviceLng);
    prefs.end();

    Serial.print("구글 시트 URL 저장됨: ");
    Serial.println(googleScriptUrl);
    Serial.print("기기명: ");
    Serial.println(deviceName);
    Serial.print("위도/경도: ");
    Serial.print(deviceLat);
    Serial.print(", ");
    Serial.println(deviceLng);
  }

  // 결과 화면
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

// WIFI_CONNECT 화면에서 3초 이상 길게 눌렀을 때 호출됨.
// 저장된 WiFi 정보(SSID/비밀번호)를 완전히 삭제하여, 다음 "WiFi Connect" 시
// 처음처럼 캡티브 포털이 다시 뜨도록 한다.
void resetWiFiCredentials() {
  wm.resetSettings(); // 내부적으로 연결 해제 + 저장된 자격증명 삭제

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

// 버튼을 누르고 있는 동안 하단에 진행 바를 그려 "곧 메뉴로 나갑니다"를 알려줌
// (전체 화면을 지우지 않고 하단 영역만 갱신하므로 온습도 표시는 그대로 유지됨)
void drawHoldProgress(unsigned long heldTime) {
  int barWidth = map(heldTime, 0, EXIT_HOLD_DURATION, 0, SCREEN_WIDTH - 2);
  barWidth = constrain(barWidth, 0, SCREEN_WIDTH - 2);

  display.fillRect(0, 59, SCREEN_WIDTH, 5, SSD1306_BLACK); // 진행 바 영역만 지움
  display.drawRect(0, 59, SCREEN_WIDTH, 5, SSD1306_WHITE);
  if (barWidth > 0) {
    display.fillRect(1, 60, barWidth, 3, SSD1306_WHITE);
  }
  display.display();
}

// ===================== 구글 시트로 데이터 전송 =====================

// 온습도 값을 Apps Script 웹앱으로 POST 전송 -> Apps Script가 스프레드시트에 한 줄 추가.
// HTTPC_FORCE_FOLLOW_REDIRECTS: 구글은 요청을 script.googleusercontent.com으로
// 302 리다이렉트하는데, 이걸 따라가지 않으면 "응답은 오는데 시트엔 안 쌓이는" 문제가 생김.
void sendToGoogleSheets(float temp, float humi) {
  if (WiFi.status() != WL_CONNECTED) return;
  if (googleScriptUrl.length() == 0) return; // 아직 URL이 설정되지 않음 (WiFi 설정에서 입력 필요)

  WiFiClientSecure client;
  client.setInsecure(); // 구글 인증서 검증 생략 (취미 프로젝트 수준의 간소화)

  HTTPClient http;
  http.setFollowRedirects(HTTPC_FORCE_FOLLOW_REDIRECTS);

  if (!http.begin(client, googleScriptUrl)) {
    Serial.println("구글 시트 전송: HTTP 연결 시작 실패");
    return;
  }

  http.addHeader("Content-Type", "application/json");

  String payload = "{\"temp\":" + String(temp, 1) +
                    ",\"humi\":" + String(humi, 1) +
                    ",\"device\":\"" + deviceName + "\"" +
                    ",\"lat\":\"" + deviceLat + "\"" +
                    ",\"lng\":\"" + deviceLng + "\"}";
  int httpCode = http.POST(payload);

  if (httpCode > 0) {
    Serial.print("구글 시트 전송 완료 (응답 코드 ");
    Serial.print(httpCode);
    Serial.println(")");
  } else {
    Serial.print("구글 시트 전송 실패: ");
    Serial.println(http.errorToString(httpCode));
  }

  http.end();
}

// 온습도 측정 화면 (millis 기반 논블로킹 처리)
void runMeasurement() {
  unsigned long now = millis();
  if (now - lastMeasureTime < measureInterval) {
    return; // 아직 측정 시간이 안 됨 -> 그 사이 버튼 입력은 loop()에서 계속 감지됨
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
    drawWifiStatusIcon();
    display.display();
    return;
  }

  Serial.print("온도: ");
  Serial.print(t);
  Serial.print(" °C | 습도: ");
  Serial.print(h);
  Serial.println(" %");

  // WiFi가 연결되어 있으면 이번에 측정한 값을 그대로 구글 시트로 전송.
  // 별도 타이머 없이 measureInterval(= "1. Start Measure" 진입 시 즉시 1회 포함,
  // 이후 "2. Set Interval"에서 설정한 주기)에 맞춰 매 측정마다 함께 전송된다.
  if (WiFi.status() == WL_CONNECTED) {
    sendToGoogleSheets(t, h);
  }

  display.clearDisplay();

  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println("   TEMP & HUMIDITY");
  display.println("---------------------");

  display.setTextSize(2);
  display.setCursor(0, 20);
  display.print("Temp: ");
  display.print(t, 1);
  display.write(167); // ° 기호 (도)
  display.print("C");

  display.setCursor(0, 42);
  display.print("Humi: ");
  display.print(h, 1);
  display.println(" %");

  display.setTextSize(1);
  display.setCursor(0, 50);
  display.println("Hold btn 3s: Menu");

  drawWifiStatusIcon();
  display.display();
}
