import UIKit

/**
 * The scene lifecycle, which the iOS 27 SDK REQUIRES.
 *
 * Capacitor's template still ships the pre-scene shape — `@UIApplicationMain`,
 * a `window` on the AppDelegate, `UIMainStoryboardFile` in Info.plist — and
 * UIKit now traps that at launch rather than warning
 * (`NoSceneLifecycleAdoption`, measured 25 Aug 2026: EXC_BREAKPOINT before
 * the first frame). The scene manifest in Info.plist names the Main
 * storyboard, so UIKit instantiates Capacitor's bridge view controller into
 * the scene's window itself; nothing here needs to do anything but exist.
 */
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?
}
