import { useState, useEffect, useRef, useMemo } from 'react'
import {
  ShieldCheck,
  KeyRound,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  QrCode,
  Lock,
  Check,
  Scan,
  ShieldAlert,
  RotateCcw,
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { generateSecret, generateTOTP } from './utils/totp'
import './App.css'

function App() {
  // 비밀키 및 OTP 상태 (새로고침 시 초기화)
  const [secretKey, setSecretKey] = useState('')
  const [keyError, setKeyError] = useState('')

  // 2단계: 자동 갱신 및 타이머 상태
  const [currentOtp, setCurrentOtp] = useState('')
  const [timeLeft, setTimeLeft] = useState(null)
  const [otpError, setOtpError] = useState('')

  // 경합 조건(Race condition) 방지 및 중복 연산 방지용 ref
  const latestStepRef = useRef(null)

  // 스마트폰 인증 앱(Google Authenticator 등) 등록용 otpauth URI 생성
  // OTP 번호가 갱신되어도 동일한 secretKey를 사용하는 동안 QR 코드는 재생성되지 않습니다.
  const otpauthUri = useMemo(() => {
    if (!secretKey) return ''
    const label = `${encodeURIComponent('SYNC30')}:${encodeURIComponent('LabUser')}`
    return `otpauth://totp/${label}?secret=${encodeURIComponent(secretKey)}&issuer=${encodeURIComponent('SYNC30')}&algorithm=SHA1&digits=6&period=30`
  }, [secretKey])

  // 1단계: 암호학적 난수(crypto.getRandomValues) 기반 Base32 비밀키 생성
  const handleGenerateSecret = () => {
    try {
      setKeyError('')
      setOtpError('')
      const newSecret = generateSecret(20)
      setSecretKey(newSecret)
    } catch (err) {
      setKeyError(
        err instanceof Error
          ? `비밀키 생성에 실패했습니다: ${err.message}`
          : '비밀키 생성 중 알 수 없는 오류가 발생했습니다.'
      )
    }
  }

  // 2단계: Unix 시각 기반 30초 주기 자동 갱신 및 탭 복귀 처리
  useEffect(() => {
    if (!secretKey) return

    let isCancelled = false

    const updateTimerAndOtp = async () => {
      const nowMs = Date.now()
      const nowSec = Math.floor(nowMs / 1000)
      const currentStep = Math.floor(nowSec / 30)
      const secondsRemaining = 30 - (nowSec % 30) // 1초 ~ 30초

      setTimeLeft(secondsRemaining)

      // 30초 시간 구간(Step)이 변경되었거나 아직 계산되지 않은 경우에만 비동기 암호 연산 수행
      if (latestStepRef.current !== currentStep) {
        latestStepRef.current = currentStep

        try {
          const newOtp = await generateTOTP(secretKey, nowMs)
          // 최신 요청 결과이며 컴포넌트가 언마운트되지 않은 경우에만 상태 반영
          if (!isCancelled && latestStepRef.current === currentStep) {
            setCurrentOtp(newOtp)
            setOtpError('')
          }
        } catch (err) {
          if (!isCancelled && latestStepRef.current === currentStep) {
            // 계산 오류 시 이전 유효 번호가 남아있지 않도록 비움
            setCurrentOtp('')
            setOtpError(
              err instanceof Error
                ? `인증번호 계산 오류: ${err.message}`
                : '인증번호 자동 계산 중 오류가 발생했습니다.'
            )
          }
        }
      }
    }

    // 1. 초기 1회 즉시 실행 (키 발급 직후 현재 시각 OTP 및 잔여 시간 계산)
    updateTimerAndOtp()

    // 2. 1초 주기 타이머 등록
    const timerId = setInterval(updateTimerAndOtp, 1000)

    // 3. 브라우저 탭 복귀(visibilitychange) 및 윈도우 포커스(focus) 리스너
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        updateTimerAndOtp()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleVisibilityChange)

    // 4. Clean-up: 언마운트 및 키 변경 시 타이머와 이벤트 리스너 완벽 해제
    return () => {
      isCancelled = true
      clearInterval(timerId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleVisibilityChange)
    }
  }, [secretKey])

  return (
    <div className="app-container">
      {/* 상단 헤더 */}
      <header className="app-header">
        <div className="header-badge">
          <ShieldCheck size={14} />
          <span>보안 대시보드</span>
        </div>
        <h1 className="app-title">
          SYNC:<span className="mint-text">30</span>
        </h1>
        <p className="app-subtitle">나만의 OTP 보안 실험실</p>
      </header>

      {/* 보안 주의사항 안내 배너 */}
      <section className="warning-banner" role="alert">
        <AlertTriangle size={18} className="warning-icon" />
        <div>
          <strong>교육용 · 실제 계정의 비밀키를 입력하지 마세요</strong>
          <p>
            본 실험실은 오프라인 TOTP 원리를 체험하기 위한 도구입니다. 모든 데이터는
            브라우저 메모리에만 임시 보관되며 새로고침 시 초기화됩니다.
          </p>
        </div>
      </section>

      {/* 3단계 카드 영역 */}
      <main className="cards-stack">
        {/* 카드 1: 비밀키 만들기 */}
        <article className="card">
          <div className="card-header">
            <div className="card-icon-wrap">
              <KeyRound size={20} />
            </div>
            <div className="card-title-group">
              <span className="card-step-badge">STEP 01</span>
              <h2 className="card-title">비밀키 만들기</h2>
            </div>
          </div>
          <p className="card-desc">
            스마트폰과 웹앱이 서로 공유할 안전한 Base32 형식의 학습용 비밀키를
            생성합니다. (외부 서버 전송 없이 브라우저 내부에서만 만들어집니다.)
          </p>

          <div className="card-inner-box">
            <span className="card-inner-label">비밀키 상태</span>
            {secretKey ? (
              <div className="secret-key-wrapper">
                <div className="secret-key-display">{secretKey}</div>
                <span className="secret-key-meta">Base32 · 32자리 (160비트 암호학적 난수)</span>
              </div>
            ) : (
              <span className="card-inner-value">선택 시 안전하게 생성됩니다</span>
            )}
            {keyError && <p className="key-error-msg">{keyError}</p>}
          </div>

          {secretKey ? (
            <button type="button" disabled className="btn-disabled">
              <Check size={16} />
              비밀키 생성 완료
            </button>
          ) : (
            <button
              type="button"
              className="btn-primary"
              onClick={handleGenerateSecret}
            >
              <KeyRound size={16} />
              비밀키 생성
            </button>
          )}
        </article>

        {/* 카드 2: 스마트폰 연결하기 */}
        <article className="card">
          <div className="card-header">
            <div className="card-icon-wrap">
              <Smartphone size={20} />
            </div>
            <div className="card-title-group">
              <span className="card-step-badge">STEP 02</span>
              <h2 className="card-title">스마트폰 연결하기</h2>
            </div>
          </div>
          <p className="card-desc">
            Google Authenticator 등의 인증 앱으로 스캔할 QR 코드를 로컬에서 생성하고,
            30초마다 자동으로 바뀌는 6자리 OTP 번호를 실시간 비교합니다.
          </p>

          {/* QR 코드 영역 (외부 서버 없이 로컬 QRCodeSVG로 생성) */}
          {secretKey && otpauthUri ? (
            <div className="qr-code-wrapper">
              <div className="qr-code-card">
                <QRCodeSVG
                  value={otpauthUri}
                  size={220}
                  bgColor="#ffffff"
                  fgColor="#000000"
                  level="M"
                  marginSize={4}
                  title="스마트폰 인증 앱 등록용 QR 코드"
                />
              </div>
              <div className="qr-guide-box">
                <div className="qr-guide-item highlight">
                  <Scan size={15} style={{ flexShrink: 0, marginTop: 2 }} />
                  <span>스마트폰 인증 앱에서 이 QR 코드를 스캔하세요.</span>
                </div>
                <div className="qr-guide-item warning">
                  <ShieldAlert size={15} style={{ flexShrink: 0, marginTop: 2 }} />
                  <span>QR 코드에는 비밀키가 들어 있습니다. 다른 사람에게 공유하지 마세요.</span>
                </div>
                <div className="qr-guide-item info">
                  <RotateCcw size={15} style={{ flexShrink: 0, marginTop: 2 }} />
                  <span>웹페이지를 새로고침하면 키가 초기화됩니다. 다시 생성한 키는 스마트폰에 새로 등록해야 합니다.</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="card-inner-box qr-placeholder">
              <QrCode size={36} color="var(--text-muted)" />
              <span className="card-inner-label">QR 코드 등록 영역</span>
              <span className="card-inner-value">비밀키를 생성하면 QR 코드가 여기에 표시됩니다</span>
            </div>
          )}

          {/* 실시간 OTP 및 30초 카운트다운 타이머 */}
          <div className="card-inner-box">
            <div className="otp-display-group">
              <span className="card-inner-label">현재 실시간 6자리 OTP</span>
              <div className="otp-number">
                {currentOtp || '------'}
              </div>

              {/* 남은 시간 텍스트 및 진행 막대 */}
              <div className="progress-bar-wrapper">
                <span className="otp-timer-text">
                  {secretKey && timeLeft !== null ? (
                    <>
                      다음 갱신까지{' '}
                      <span className="otp-timer-highlight">{timeLeft}초</span>
                    </>
                  ) : (
                    '비밀키를 먼저 생성해주세요'
                  )}
                </span>
                {secretKey && timeLeft !== null && (
                  <div className="progress-bar-track" aria-hidden="true">
                    <div
                      className={`progress-bar-fill ${timeLeft <= 5 ? 'warning' : ''}`}
                      style={{ width: `${(timeLeft / 30) * 100}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
            {otpError && <p className="otp-error-msg">{otpError}</p>}
          </div>
        </article>

        {/* 카드 3: 인증번호 확인하기 (다음 단계 예정) */}
        <article className="card">
          <div className="card-header">
            <div className="card-icon-wrap">
              <CheckCircle2 size={20} />
            </div>
            <div className="card-title-group">
              <span className="card-step-badge">STEP 03</span>
              <h2 className="card-title">인증번호 확인하기</h2>
            </div>
          </div>
          <p className="card-desc">
            스마트폰 인증 앱 화면에 나타난 6자리 OTP 번호를 직접 입력하여,
            두 기기가 동일한 시간에 정확히 동기화되었는지 검증합니다.
          </p>
          <div className="card-inner-box">
            <div className="input-placeholder-box">
              <span className="card-inner-label">인증번호 입력</span>
              <input
                type="text"
                disabled
                placeholder="------"
                className="dummy-input"
                aria-label="인증번호 6자리"
              />
              <span className="card-inner-value">
                검증 로직 연결 대기 중 (다음 단계에서 연결)
              </span>
            </div>
          </div>
          <button type="button" disabled className="btn-disabled">
            <Lock size={15} />
            인증번호 확인 (다음 단계에서 연결합니다)
          </button>
        </article>
      </main>

      {/* 하단 푸터 */}
      <footer className="app-footer">
        <p className="footer-policy">Zero-Transmission · 순수 클라이언트 암호화</p>
        <p>비밀키는 메모리에만 임시 유지되며 새로고침 시 초기화됩니다.</p>
      </footer>
    </div>
  )
}

export default App
