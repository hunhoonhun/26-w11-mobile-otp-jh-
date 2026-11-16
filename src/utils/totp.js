/**
 * RFC 4648 표준 Base32 문자셋 (A-Z, 2-7)
 */
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

/**
 * Uint8Array 바이트 배열을 Base32 문자열로 인코딩합니다 (패딩 '=' 없음).
 * @param {Uint8Array} buffer - 인코딩할 바이트 배열
 * @returns {string} Base32 인코딩 문자열
 */
export function encodeBase32(buffer) {
  let bits = 0
  let value = 0
  let output = ''

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i]
    bits += 8

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31]
  }

  return output
}

/**
 * Base32 문자열을 디코딩하여 Uint8Array 바이트 배열로 변환합니다.
 * @param {string} base32Str - Base32 문자열
 * @returns {Uint8Array} 디코딩된 바이트 배열
 */
export function decodeBase32(base32Str) {
  if (typeof base32Str !== 'string' || base32Str.length === 0) {
    throw new Error('유효한 Base32 문자열을 입력해주세요.')
  }

  const cleanStr = base32Str.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '')
  let bits = 0
  let value = 0
  const bytes = []

  for (let i = 0; i < cleanStr.length; i++) {
    const char = cleanStr[i]
    const index = BASE32_ALPHABET.indexOf(char)
    if (index === -1) {
      throw new Error(`Base32 디코딩 실패: 잘못된 문자 "${char}"가 포함되어 있습니다.`)
    }
    value = (value << 5) | index
    bits += 5

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }

  return new Uint8Array(bytes)
}

/**
 * crypto.getRandomValues()를 사용하여 암호학적으로 안전한 Base32 비밀키를 생성합니다.
 * Math.random()은 절대 사용하지 않습니다.
 * 20바이트(160비트) 난수를 32자리 Base32 문자열로 변환합니다.
 * @param {number} [byteLength=20] - 생성할 난수 바이트 길이 (기본값 20바이트 = 160비트)
 * @returns {string} 32자리 Base32 비밀키
 */
export function generateSecret(byteLength = 20) {
  const cryptoObj =
    typeof window !== 'undefined' && window.crypto
      ? window.crypto
      : typeof globalThis !== 'undefined' && globalThis.crypto
        ? globalThis.crypto
        : null

  if (!cryptoObj || typeof cryptoObj.getRandomValues !== 'function') {
    throw new Error('현재 브라우저가 Web Crypto API(암호학적 난수 생성)를 지원하지 않습니다.')
  }

  const randomBytes = new Uint8Array(byteLength)
  cryptoObj.getRandomValues(randomBytes)
  return encodeBase32(randomBytes)
}

/**
 * RFC 6238 기반 TOTP (HMAC-SHA-1) 인증번호를 비동기로 계산합니다.
 * 브라우저 내장 Web Crypto API(crypto.subtle)를 사용합니다.
 *
 * @param {string} secretBase32 - Base32로 인코딩된 비밀키
 * @param {number} [timestampMs=Date.now()] - 계산 기준 시각 (밀리초 단위, 기본값: Date.now())
 * @param {number} [digits=6] - OTP 자릿수 (기본값: 6자리)
 * @param {number} [periodSec=30] - 시간 스텝 주기 (초 단위, 기본값: 30초)
 * @returns {Promise<string>} 6자리 OTP 문자열 (예: "081804")
 */
export async function generateTOTP(
  secretBase32,
  timestampMs = Date.now(),
  digits = 6,
  periodSec = 30
) {
  const cryptoObj =
    typeof window !== 'undefined' && window.crypto
      ? window.crypto
      : typeof globalThis !== 'undefined' && globalThis.crypto
        ? globalThis.crypto
        : null

  if (!cryptoObj || !cryptoObj.subtle) {
    throw new Error('현재 브라우저가 Web Crypto API(crypto.subtle)를 지원하지 않습니다.')
  }

  // 1. Base32 비밀키를 바이트 배열로 디코딩
  const keyBytes = decodeBase32(secretBase32)

  // 2. 8바이트 Big-Endian 카운터 버퍼 구성: floor(timestampSec / periodSec)
  // timestampMs는 밀리초 단위이므로 1000으로 나누어 초 단위로 변환합니다.
  const timeSec = Math.floor(timestampMs / 1000)
  const counter = BigInt(Math.floor(timeSec / periodSec))

  const counterBuffer = new ArrayBuffer(8)
  const dataView = new DataView(counterBuffer)
  dataView.setBigUint64(0, counter, false) // false = Big-Endian
  const counterBytes = new Uint8Array(counterBuffer)

  // 3. Web Crypto API를 통한 HMAC-SHA-1 키 임포트 및 서명 연산
  const cryptoKey = await cryptoObj.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: { name: 'SHA-1' } },
    false,
    ['sign']
  )

  const signature = await cryptoObj.subtle.sign('HMAC', cryptoKey, counterBytes)
  const digest = new Uint8Array(signature)

  // 4. 동적 절단 (Dynamic Truncation)
  const offset = digest[digest.length - 1] & 0x0f
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff)

  // 5. 지정된 자릿수(기본 6자리)로 자르고 앞자리 0을 포함하도록 패딩
  const modulus = 10 ** digits
  const otpNumber = binary % modulus
  return otpNumber.toString().padStart(digits, '0')
}
