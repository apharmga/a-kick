import UIKit
import Capacitor
import AuthenticationServices
import CryptoKit

/// 앱 시작 화면. 기본 Capacitor 화면에 A-KICK 전용 플러그인을 붙인다.
class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(AKickPlugin())
    }
}

/// 웹앱(apharmga.github.io/a-kick)에서 부르는 아이폰 전용 기능.
/// - appleSignIn: Apple로 로그인 → Firebase에 넣을 idToken과 rawNonce를 돌려준다.
/// - googleSignIn: 사파리 로그인 창(ASWebAuthenticationSession)으로 Google 로그인 → idToken을 돌려준다.
///   (Google은 앱 안 웹뷰 로그인을 막기 때문에 이 방식이 필요하다.)
@objc(AKickPlugin)
public class AKickPlugin: CAPPlugin, CAPBridgedPlugin, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding, ASWebAuthenticationPresentationContextProviding {
    public let identifier = "AKickPlugin"
    public let jsName = "AKick"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "info", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "appleSignIn", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "googleSignIn", returnType: CAPPluginReturnPromise)
    ]

    private var appleCall: CAPPluginCall?
    private var appleNonce = ""
    private var webSession: ASWebAuthenticationSession?

    // MARK: 앱 정보
    @objc func info(_ call: CAPPluginCall) {
        let b = Bundle.main
        call.resolve([
            "version": b.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "",
            "build": b.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "",
            "google": !googleClientId().isEmpty
        ])
    }

    // MARK: Apple 로그인
    @objc func appleSignIn(_ call: CAPPluginCall) {
        appleCall = call
        appleNonce = AKickPlugin.randomString(32)
        DispatchQueue.main.async {
            let req = ASAuthorizationAppleIDProvider().createRequest()
            req.requestedScopes = [.fullName, .email]
            req.nonce = AKickPlugin.sha256(self.appleNonce)
            let ctl = ASAuthorizationController(authorizationRequests: [req])
            ctl.delegate = self
            ctl.presentationContextProvider = self
            ctl.performRequests()
        }
    }

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        guard let call = appleCall else { return }
        appleCall = nil
        guard let cred = authorization.credential as? ASAuthorizationAppleIDCredential,
              let data = cred.identityToken, let token = String(data: data, encoding: .utf8) else {
            call.reject("Apple 로그인 정보를 받지 못했어요")
            return
        }
        let name = [cred.fullName?.familyName, cred.fullName?.givenName].compactMap { $0 }.joined()
        let code = cred.authorizationCode.flatMap { String(data: $0, encoding: .utf8) } ?? ""
        call.resolve(["idToken": token, "rawNonce": appleNonce, "authorizationCode": code, "email": cred.email ?? "", "name": name])
    }

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        guard let call = appleCall else { return }
        appleCall = nil
        let canceled = (error as? ASAuthorizationError)?.code == .canceled
        call.reject(canceled ? "canceled" : error.localizedDescription)
    }

    public func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        return anchor()
    }

    // MARK: Google 로그인 (PKCE, 클라이언트 비밀값 없음)
    private func googleClientId() -> String {
        let v = (Bundle.main.object(forInfoDictionaryKey: "AKickGoogleClientID") as? String ?? "").trimmingCharacters(in: .whitespaces)
        return v.hasSuffix(".apps.googleusercontent.com") ? v : ""
    }

    @objc func googleSignIn(_ call: CAPPluginCall) {
        let clientId = googleClientId()
        if clientId.isEmpty { call.reject("Google 로그인이 아직 설정되지 않았어요"); return }
        let scheme = "com.googleusercontent.apps." + clientId.replacingOccurrences(of: ".apps.googleusercontent.com", with: "")
        let redirect = scheme + ":/oauth2redirect"
        let verifier = AKickPlugin.randomString(64)
        let challenge = AKickPlugin.base64url(Data(SHA256.hash(data: Data(verifier.utf8))))
        var comp = URLComponents(string: "https://accounts.google.com/o/oauth2/v2/auth")!
        comp.queryItems = [
            URLQueryItem(name: "client_id", value: clientId),
            URLQueryItem(name: "redirect_uri", value: redirect),
            URLQueryItem(name: "response_type", value: "code"),
            URLQueryItem(name: "scope", value: "openid email profile"),
            URLQueryItem(name: "code_challenge", value: challenge),
            URLQueryItem(name: "code_challenge_method", value: "S256"),
            URLQueryItem(name: "prompt", value: "select_account")
        ]
        DispatchQueue.main.async {
            let session = ASWebAuthenticationSession(url: comp.url!, callbackURLScheme: scheme) { url, error in
                self.webSession = nil
                if let error = error {
                    let canceled = (error as? ASWebAuthenticationSessionError)?.code == .canceledLogin
                    call.reject(canceled ? "canceled" : error.localizedDescription)
                    return
                }
                guard let url = url,
                      let code = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems?.first(where: { $0.name == "code" })?.value else {
                    call.reject("Google 로그인 코드를 받지 못했어요")
                    return
                }
                self.exchange(code: code, clientId: clientId, redirect: redirect, verifier: verifier, call: call)
            }
            session.presentationContextProvider = self
            session.prefersEphemeralWebBrowserSession = false
            self.webSession = session
            if !session.start() { call.reject("로그인 창을 열 수 없어요") }
        }
    }

    private func exchange(code: String, clientId: String, redirect: String, verifier: String, call: CAPPluginCall) {
        var req = URLRequest(url: URL(string: "https://oauth2.googleapis.com/token")!)
        req.httpMethod = "POST"
        req.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        var body = URLComponents()
        body.queryItems = [
            URLQueryItem(name: "code", value: code),
            URLQueryItem(name: "client_id", value: clientId),
            URLQueryItem(name: "redirect_uri", value: redirect),
            URLQueryItem(name: "code_verifier", value: verifier),
            URLQueryItem(name: "grant_type", value: "authorization_code")
        ]
        req.httpBody = body.percentEncodedQuery?.data(using: .utf8)
        URLSession.shared.dataTask(with: req) { data, _, err in
            guard err == nil, let data = data,
                  let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let idToken = json["id_token"] as? String else {
                call.reject("Google 로그인을 마치지 못했어요")
                return
            }
            call.resolve(["idToken": idToken, "accessToken": json["access_token"] as? String ?? ""])
        }.resume()
    }

    public func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        return anchor()
    }

    // MARK: 도우미
    private func anchor() -> ASPresentationAnchor {
        if let w = bridge?.viewController?.view.window { return w }
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        return scenes.flatMap { $0.windows }.first { $0.isKeyWindow } ?? ASPresentationAnchor()
    }

    static func randomString(_ length: Int) -> String {
        let chars = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-._")
        var out = ""
        var rng = SystemRandomNumberGenerator()
        for _ in 0..<length { out.append(chars[Int(rng.next() % UInt64(chars.count))]) }
        return out
    }

    static func sha256(_ s: String) -> String {
        return SHA256.hash(data: Data(s.utf8)).map { String(format: "%02x", $0) }.joined()
    }

    static func base64url(_ d: Data) -> String {
        return d.base64EncodedString().replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
    }
}
