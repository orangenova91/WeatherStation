import { createTransport } from "nodemailer";

export async function sendVerificationCode(email: string, code: string) {
  const host = process.env.SMTP_HOST?.trim();
  if (!host) {
    console.log(`[weather-station] verification code for ${email}: ${code}`);
    return;
  }

  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS;
  const transporter = createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === "true" || port === 465,
    auth: user ? { user, pass } : undefined,
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM || user,
    to: email,
    subject: "Weather Station 인증번호",
    text: `Weather Station 가입 인증번호는 ${code} 입니다. 10분 안에 입력해 주세요.`,
  });
}
