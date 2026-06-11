// WORK OUT! 워치 앱 엔트리 — WatchConnectivity 세션 활성화

import SwiftUI

@main
struct WorkoutWatchApp: App {
    init() {
        WatchSession.shared.activate()
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
