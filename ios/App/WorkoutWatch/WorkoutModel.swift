// 워치 앱 상태 모델 — 폰의 workoutStore가 단일 진실 공급원
// applicationContext(폰 → 워치)를 파싱해 화면 상태로 변환하고,
// 사용자 액션을 message(워치 → 폰)로 보낸다.

import Foundation
import Combine
import WatchKit

struct WExercise: Identifiable {
    let id: Int          // 폰 쪽 인덱스
    let name: String
    let part: String
    let sets: Int
    let reps: String
    let weight: Double?  // nil = 없음(맨몸/러닝)
    let done: Int

    var isDone: Bool { done >= sets }
}

@MainActor
final class WorkoutModel: ObservableObject {
    static let shared = WorkoutModel()

    @Published var phase: String = "overview"   // overview | active | rest | log_reps | pick_next
    @Published var currentIndex: Int = 0
    @Published var currentSet: Int = 1
    @Published var restEnd: Double = 0          // ms epoch
    @Published var exercises: [WExercise] = []
    @Published var hasState: Bool = false       // 폰에서 한 번이라도 상태를 받았는지
    @Published var restRemaining: Int = 0
    @Published var isReachable: Bool = false

    private var cancellables = Set<AnyCancellable>()
    private var restTimer: AnyCancellable?
    private var restHapticFired = false

    private init() {
        WatchSession.shared.$applicationContext
            .receive(on: DispatchQueue.main)
            .sink { [weak self] ctx in self?.apply(ctx) }
            .store(in: &cancellables)

        WatchSession.shared.$isReachable
            .receive(on: DispatchQueue.main)
            .sink { [weak self] reachable in
                self?.isReachable = reachable
                if reachable { self?.send(["action": "requestState"]) }
            }
            .store(in: &cancellables)

        startRestTicker()
    }

    // MARK: - 컨텍스트 파싱

    private func apply(_ ctx: [String: Any]) {
        guard !ctx.isEmpty else { return }
        hasState = true

        let oldPhase = phase
        phase        = ctx["phase"] as? String ?? "overview"
        currentIndex = intValue(ctx["idx"]) ?? 0
        currentSet   = intValue(ctx["set"]) ?? 1
        restEnd      = doubleValue(ctx["restEnd"]) ?? 0

        if let arr = ctx["exercises"] as? [[String: Any]] {
            exercises = arr.enumerated().map { i, ex in
                let w = doubleValue(ex["weight"]) ?? -1
                return WExercise(
                    id:     i,
                    name:   ex["name"] as? String ?? "",
                    part:   ex["part"] as? String ?? "",
                    sets:   intValue(ex["sets"]) ?? 3,
                    reps:   ex["reps"] as? String ?? "",
                    weight: w < 0 ? nil : w,
                    done:   intValue(ex["done"]) ?? 0
                )
            }
        }

        // 휴식 시작 → 클릭 햅틱 + 종료 햅틱 재무장
        if phase == "rest" && oldPhase != "rest" {
            restHapticFired = false
            WKInterfaceDevice.current().play(.click)
        }
        // 휴식 → 운동 복귀 피드백
        if phase == "active" && oldPhase == "rest" {
            WKInterfaceDevice.current().play(.start)
        }
    }

    // MARK: - 휴식 카운트다운 (워치 자체 계산 — 폰 없이도 정확)

    private func startRestTicker() {
        restTimer = Timer.publish(every: 0.5, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in
                Task { @MainActor in self?.tickRest() }
            }
    }

    private func tickRest() {
        guard phase == "rest", restEnd > 0 else {
            restRemaining = 0
            return
        }
        let remaining = Int(ceil((restEnd - Date().timeIntervalSince1970 * 1000) / 1000))
        restRemaining = max(0, remaining)

        if remaining <= 0 && !restHapticFired {
            restHapticFired = true
            WKInterfaceDevice.current().play(.notification)
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) {
                WKInterfaceDevice.current().play(.notification)
            }
        }
    }

    // MARK: - 워치 → 폰 액션

    func send(_ message: [String: Any]) {
        WatchSession.shared.send(message)
    }

    func startWorkout()        { tap(); send(["action": "start"]) }
    func completeSet()         { tap(); send(["action": "completeSet"]) }
    func afterRest()           { tap(); send(["action": "afterRest"]) }
    func extendRest(_ d: Int)  { tap(); send(["action": "extendRest", "delta": d]) }
    func skipReps()            { tap(); send(["action": "skipReps"]) }
    func pick(_ index: Int)    { tap(); send(["action": "pick", "index": index]) }

    private func tap() { WKInterfaceDevice.current().play(.click) }

    // MARK: - 헬퍼

    var current: WExercise? {
        exercises.indices.contains(currentIndex) ? exercises[currentIndex] : nil
    }

    var remainingExercises: [WExercise] {
        exercises.filter { !$0.isDone }
    }

    private func intValue(_ v: Any?) -> Int? {
        if let i = v as? Int { return i }
        if let d = v as? Double { return Int(d) }
        if let s = v as? String { return Int(s) }
        return nil
    }

    private func doubleValue(_ v: Any?) -> Double? {
        if let d = v as? Double { return d }
        if let i = v as? Int { return Double(i) }
        if let s = v as? String { return Double(s) }
        return nil
    }
}
