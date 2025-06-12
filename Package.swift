import PackageDescription

let package = Package(
    name: "PointsOptimizerApp",
    platforms: [
        .iOS(.v17)
    ],
    products: [
        .library(
            name: "PointsOptimizerApp",
            targets: ["PointsOptimizerApp"]),
    ],
    dependencies: [
        .package(url: "https://github.com/firebase/firebase-ios-sdk", from: "10.0.0")
    ],
    targets: [
        .target(
            name: "PointsOptimizerApp",
            dependencies: [
                .product(name: "FirebaseAuth", package: "firebase-ios-sdk"),
                .product(name: "FirebaseFirestore", package: "firebase-ios-sdk")
            ]),
        .testTarget(
            name: "PointsOptimizerAppTests",
            dependencies: ["PointsOptimizerApp"]),
    ]
)
