// 워치 ↔ 아이폰 WatchConnectivity 세션 래퍼
// 아이폰 쪽은 @capgo/capacitor-watch 플러그인이 수신:
//   - sendMessage → 플러그인 'messageReceived' 리스너
//   - transferUserInfo → 플러그인 'userInfoReceived' 리스너 (미연결 시 큐잉)
//   - 아이폰의 updateApplicationContext → 여기 applicationContext로 수신

import Foundation
import WatchConnectivity

final class WatchSession: NSObject, ObservableObject, WCSessionDelegate {
    static let shared = WatchSession()

    @Published private(set) var applicationContext: [String: Any] = [:]
    @Published private(set) var isReachable: Bool = false
    @Published private(set) var isActivated: Bool = false

    private override init() { super.init() }

    func activate() {
        guard WCSession.isSupported() else { return }
        WCSession.default.delegate = self
        WCSession.default.activate()
    }

    // 연결돼 있으면 즉시 전송, 아니면 큐에 넣어 나중에 전달
    func send(_ message: [String: Any]) {
        let session = WCSession.default
        guard session.activationState == .activated else { return }
        if session.isReachable {
            session.sendMessage(message, replyHandler: nil) { _ in
                session.transferUserInfo(message)
            }
        } else {
            session.transferUserInfo(message)
        }
    }

    // MARK: - WCSessionDelegate

    func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {
        DispatchQueue.main.async {
            self.isActivated = activationState == .activated
            self.isReachable = session.isReachable
            // 마지막으로 수신된 컨텍스트 복원 (폰이 꺼져 있어도 직전 상태 표시)
            if !session.receivedApplicationContext.isEmpty {
                self.applicationContext = session.receivedApplicationContext
            }
        }
    }

    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        DispatchQueue.main.async {
            self.applicationContext = applicationContext
        }
    }

    func sessionReachabilityDidChange(_ session: WCSession) {
        DispatchQueue.main.async {
            self.isReachable = session.isReachable
        }
    }
}
