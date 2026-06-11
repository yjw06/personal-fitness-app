// WORK OUT! 워치 앱 — 메인 화면
// 폰의 운동 페이즈에 따라 화면 전환: 대기 / 운동 / 휴식 / 기록 / 다음 운동 선택

import SwiftUI

private let ember = Color(red: 1.0, green: 0.36, blue: 0.18)   // #ff5c2e
private let amber = Color(red: 1.0, green: 0.65, blue: 0.18)   // #ffa62e

struct ContentView: View {
    @ObservedObject var model = WorkoutModel.shared

    var body: some View {
        Group {
            if !model.hasState {
                WaitingView(reachable: model.isReachable)
            } else {
                switch model.phase {
                case "active":    ActiveView(model: model)
                case "rest":      RestView(model: model)
                case "log_reps":  LogRepsView(model: model)
                case "pick_next": PickNextView(model: model)
                default:          OverviewView(model: model)
                }
            }
        }
        .onAppear { model.send(["action": "requestState"]) }
    }
}

// MARK: - 연결 대기

struct WaitingView: View {
    let reachable: Bool
    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: "iphone.radiowaves.left.and.right")
                .font(.title2)
                .foregroundStyle(ember)
            Text(reachable ? "동기화 중..." : "아이폰 앱을 열어주세요")
                .font(.footnote)
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
        }
    }
}

// MARK: - 대기 (overview)

struct OverviewView: View {
    @ObservedObject var model: WorkoutModel

    var doneCount: Int { model.exercises.filter(\.isDone).count }

    var body: some View {
        VStack(spacing: 10) {
            if model.exercises.isEmpty {
                Text("오늘 운동이 없어요")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                Text("아이폰에서 운동을 추가하세요")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            } else {
                Text("오늘의 운동")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text("\(doneCount) / \(model.exercises.count)")
                    .font(.system(size: 34, weight: .bold, design: .rounded))
                    .foregroundStyle(ember)
                Text("종목 완료")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)

                Button {
                    model.startWorkout()
                } label: {
                    Label(doneCount > 0 ? "이어서 시작" : "운동 시작",
                          systemImage: "play.fill")
                        .font(.headline)
                }
                .tint(ember)
                .buttonStyle(.borderedProminent)
                .disabled(doneCount == model.exercises.count)
            }
        }
        .padding(.horizontal, 4)
    }
}

// MARK: - 운동 중 (active)

struct ActiveView: View {
    @ObservedObject var model: WorkoutModel

    var body: some View {
        let ex = model.current
        ScrollView {
            VStack(spacing: 8) {
                // 부위 + 진행
                HStack {
                    Text(ex?.part ?? "")
                        .font(.caption2.bold())
                        .padding(.horizontal, 8).padding(.vertical, 3)
                        .background(ember.opacity(0.22), in: Capsule())
                        .foregroundStyle(ember)
                    Spacer()
                    Text("\(model.currentIndex + 1)/\(model.exercises.count)")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }

                // 운동명
                Text(ex?.name ?? "")
                    .font(.system(.headline, design: .rounded))
                    .multilineTextAlignment(.center)
                    .lineLimit(3)
                    .minimumScaleFactor(0.7)

                // 세트 / 반복 / 무게
                HStack(spacing: 10) {
                    VStack(spacing: 0) {
                        Text("\(model.currentSet)/\(ex?.sets ?? 3)")
                            .font(.system(.title3, design: .rounded).bold())
                            .foregroundStyle(ember)
                        Text("세트").font(.caption2).foregroundStyle(.tertiary)
                    }
                    VStack(spacing: 0) {
                        Text(ex?.reps ?? "-")
                            .font(.system(.title3, design: .rounded).bold())
                            .lineLimit(1).minimumScaleFactor(0.6)
                        Text("반복").font(.caption2).foregroundStyle(.tertiary)
                    }
                    if let w = ex?.weight {
                        VStack(spacing: 0) {
                            Text("\(w.formatted())kg")
                                .font(.system(.title3, design: .rounded).bold())
                                .lineLimit(1).minimumScaleFactor(0.6)
                            Text("무게").font(.caption2).foregroundStyle(.tertiary)
                        }
                    }
                }

                // 세트 완료
                Button {
                    model.completeSet()
                } label: {
                    Label("세트 완료", systemImage: "checkmark")
                        .font(.headline)
                }
                .tint(ember)
                .buttonStyle(.borderedProminent)

                // 이전/다음 운동
                HStack {
                    Button { jump(-1) } label: { Image(systemName: "chevron.left") }
                        .disabled(model.currentIndex <= 0)
                    Spacer()
                    Button { jump(1) } label: { Image(systemName: "chevron.right") }
                        .disabled(model.currentIndex >= model.exercises.count - 1)
                }
                .buttonStyle(.bordered)
                .controlSize(.small)
            }
            .padding(.horizontal, 2)
        }
    }

    private func jump(_ delta: Int) {
        let target = model.currentIndex + delta
        guard model.exercises.indices.contains(target) else { return }
        model.pick(target)
    }
}

// MARK: - 휴식 (rest)

struct RestView: View {
    @ObservedObject var model: WorkoutModel

    var body: some View {
        VStack(spacing: 10) {
            Text("휴식")
                .font(.caption)
                .foregroundStyle(.secondary)

            Text(timeString(model.restRemaining))
                .font(.system(size: 44, weight: .bold, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(model.restRemaining <= 3 ? amber : ember)
                .contentTransition(.numericText())

            HStack(spacing: 8) {
                Button("+15초") { model.extendRest(15) }
                    .buttonStyle(.bordered)
                    .controlSize(.small)
                Button("-15초") { model.extendRest(-15) }
                    .buttonStyle(.bordered)
                    .controlSize(.small)
            }

            Button {
                model.afterRest()
            } label: {
                Label("다음 세트", systemImage: "forward.fill")
                    .font(.headline)
            }
            .tint(ember)
            .buttonStyle(.borderedProminent)
        }
    }

    private func timeString(_ sec: Int) -> String {
        sec >= 60 ? String(format: "%d:%02d", sec / 60, sec % 60) : "\(sec)"
    }
}

// MARK: - 횟수 기록 대기 (log_reps)

struct LogRepsView: View {
    @ObservedObject var model: WorkoutModel

    var body: some View {
        VStack(spacing: 10) {
            Image(systemName: "square.and.pencil")
                .font(.title3)
                .foregroundStyle(ember)
            Text("아이폰에서\n수행 횟수 기록 중")
                .font(.footnote)
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
            Button("건너뛰기") { model.skipReps() }
                .buttonStyle(.bordered)
                .controlSize(.small)
        }
    }
}

// MARK: - 다음 운동 선택 (pick_next)

struct PickNextView: View {
    @ObservedObject var model: WorkoutModel

    var body: some View {
        List {
            Section("다음 운동 선택") {
                ForEach(model.remainingExercises) { ex in
                    Button {
                        model.pick(ex.id)
                    } label: {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(ex.name)
                                .font(.footnote.bold())
                                .lineLimit(2)
                            Text("\(ex.part) · \(ex.sets - ex.done)세트 남음")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
        .listStyle(.carousel)
    }
}

#Preview {
    ContentView()
}
