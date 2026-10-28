import WidgetKit
import SwiftUI

/// 앱(웹)이 넘겨준 다음 경기 정보
struct NextGame: Decodable {
    var club: String?
    var date: String?
    var time: String?
    var place: String?
    var count: Int?
    var mine: String?
    var none: Int?
}

struct GameEntry: TimelineEntry {
    let date: Date
    let game: NextGame?
}

struct Provider: TimelineProvider {
    static let group = "group.com.anqua.akick"

    func load() -> NextGame? {
        guard let s = UserDefaults(suiteName: Provider.group)?.string(forKey: "next"),
              let d = s.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(NextGame.self, from: d)
    }

    func placeholder(in context: Context) -> GameEntry {
        GameEntry(date: Date(), game: NextGame(club: "도남풋살", date: "2026-11-01", time: "16:00", place: "도남풋살장", count: 12, mine: "참석"))
    }

    func getSnapshot(in context: Context, completion: @escaping (GameEntry) -> Void) {
        completion(context.isPreview ? placeholder(in: context) : GameEntry(date: Date(), game: load()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<GameEntry>) -> Void) {
        let now = Date(), g = load()
        // 자정마다 D-day가 바뀌도록 오늘·내일 0시 항목을 미리 만들어 둠
        var cal = Calendar(identifier: .gregorian); cal.timeZone = TimeZone(identifier: "Asia/Seoul")!
        let t1 = cal.startOfDay(for: now.addingTimeInterval(86400))
        let t2 = cal.startOfDay(for: now.addingTimeInterval(2 * 86400))
        completion(Timeline(entries: [GameEntry(date: now, game: g), GameEntry(date: t1, game: g), GameEntry(date: t2, game: g)], policy: .after(t2)))
    }
}

enum Fmt {
    static let seoul = TimeZone(identifier: "Asia/Seoul")!
    static func day(_ ymd: String?) -> Date? {
        guard let ymd = ymd else { return nil }
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; f.timeZone = seoul
        return f.date(from: ymd)
    }
    static func dday(_ ymd: String?, from now: Date) -> String {
        guard let d = day(ymd) else { return "" }
        var cal = Calendar(identifier: .gregorian); cal.timeZone = seoul
        let n = cal.dateComponents([.day], from: cal.startOfDay(for: now), to: cal.startOfDay(for: d)).day ?? 0
        return n == 0 ? "오늘" : n == 1 ? "내일" : n > 0 ? "D-\(n)" : "지난 경기"
    }
    static func md(_ ymd: String?) -> String {
        guard let d = day(ymd) else { return "" }
        let f = DateFormatter(); f.locale = Locale(identifier: "ko_KR"); f.timeZone = seoul; f.dateFormat = "M/d (E)"
        return f.string(from: d)
    }
}

let navy = Color(red: 0x1E / 255, green: 0x3A / 255, blue: 0x8A / 255)
let ball = Color(red: 1, green: 0xD2 / 255, blue: 0x3F / 255)

struct AKickWidgetView: View {
    @Environment(\.widgetFamily) var family
    let entry: GameEntry

    var body: some View {
        content.padding(family == .systemSmall ? 2 : 4).widgetBg()
    }

    @ViewBuilder var content: some View {
        if let g = entry.game, g.none == nil, g.date != nil {
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text("⚽ " + (g.club ?? "A-KICK")).font(.caption.bold()).foregroundColor(.white.opacity(0.85)).lineLimit(1)
                    Spacer(minLength: 0)
                }
                Text(Fmt.dday(g.date, from: entry.date)).font(.system(size: family == .systemSmall ? 30 : 34, weight: .heavy)).foregroundColor(ball)
                Text(Fmt.md(g.date) + " " + (g.time ?? "")).font(.subheadline.bold()).foregroundColor(.white).lineLimit(1)
                if family != .systemSmall, let p = g.place, !p.isEmpty {
                    Text(p).font(.caption).foregroundColor(.white.opacity(0.8)).lineLimit(1)
                }
                Spacer(minLength: 0)
                HStack(spacing: 6) {
                    Text("참석 \(g.count ?? 0)명").font(.caption.bold()).foregroundColor(.white)
                    if let m = g.mine {
                        Text("나: " + m).font(.caption2.bold())
                            .padding(.horizontal, 6).padding(.vertical, 2)
                            .background(m == "참석" ? Color.green : m == "불참" ? Color.gray : Color.orange)
                            .foregroundColor(.white).clipShape(Capsule())
                    }
                }
            }.frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        } else {
            VStack(alignment: .leading, spacing: 6) {
                Text("A-KICK").font(.headline.weight(.heavy)).foregroundColor(.white)
                Text(entry.game == nil ? "앱을 한 번 열면\n다음 경기가 여기에 떠요" : "다음 경기가\n아직 정해지지 않았어요").font(.caption).foregroundColor(.white.opacity(0.85))
                Spacer(minLength: 0)
            }.frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
    }
}

extension View {
    @ViewBuilder func widgetBg() -> some View {
        if #available(iOS 17.0, *) {
            containerBackground(navy, for: .widget)
        } else {
            padding().background(navy)
        }
    }
}

@main
struct AKickWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "AKickNextGame", provider: Provider()) { entry in
            AKickWidgetView(entry: entry)
        }
        .configurationDisplayName("다음 경기")
        .description("다음 경기 날짜·시간과 참석 인원을 보여줘요.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
