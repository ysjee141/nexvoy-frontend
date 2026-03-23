// swift-tools-version: 5.9
import PackageDescription

// DO NOT MODIFY THIS FILE - managed by Capacitor CLI commands
let package = Package(
    name: "CapApp-SPM",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "CapApp-SPM",
            targets: ["CapApp-SPM"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", exact: "8.2.0"),
        .package(name: "CapacitorApp", path: "../../../node_modules/.pnpm/@capacitor+app@8.0.1_@capacitor+core@8.2.0/node_modules/@capacitor/app"),
        .package(name: "CapacitorLocalNotifications", path: "../../../node_modules/.pnpm/@capacitor+local-notifications@8.0.2_@capacitor+core@8.2.0/node_modules/@capacitor/local-notifications"),
        .package(name: "CapacitorNetwork", path: "../../../node_modules/.pnpm/@capacitor+network@8.0.1_@capacitor+core@8.2.0/node_modules/@capacitor/network"),
        .package(name: "CapacitorPreferences", path: "../../../node_modules/.pnpm/@capacitor+preferences@8.0.1_@capacitor+core@8.2.0/node_modules/@capacitor/preferences"),
        .package(name: "CapacitorPushNotifications", path: "../../../node_modules/.pnpm/@capacitor+push-notifications@8.0.2_@capacitor+core@8.2.0/node_modules/@capacitor/push-notifications"),
        .package(name: "CapacitorStatusBar", path: "../../../node_modules/.pnpm/@capacitor+status-bar@8.0.1_@capacitor+core@8.2.0/node_modules/@capacitor/status-bar"),
        .package(name: "CapgoCapacitorNavigationBar", path: "../../../node_modules/.pnpm/@capgo+capacitor-navigation-bar@8.0.25_@capacitor+core@8.2.0/node_modules/@capgo/capacitor-navigation-bar"),
        .package(name: "SentryCapacitor", path: "../../../node_modules/.pnpm/@sentry+capacitor@3.2.0_@capacitor+core@8.2.0/node_modules/@sentry/capacitor")
    ],
    targets: [
        .target(
            name: "CapApp-SPM",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
                .product(name: "CapacitorApp", package: "CapacitorApp"),
                .product(name: "CapacitorLocalNotifications", package: "CapacitorLocalNotifications"),
                .product(name: "CapacitorNetwork", package: "CapacitorNetwork"),
                .product(name: "CapacitorPreferences", package: "CapacitorPreferences"),
                .product(name: "CapacitorPushNotifications", package: "CapacitorPushNotifications"),
                .product(name: "CapacitorStatusBar", package: "CapacitorStatusBar"),
                .product(name: "CapgoCapacitorNavigationBar", package: "CapgoCapacitorNavigationBar"),
                .product(name: "SentryCapacitor", package: "SentryCapacitor")
            ]
        )
    ]
)
