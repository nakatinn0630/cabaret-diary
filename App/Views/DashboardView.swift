import SwiftUI

struct DashboardView: View {
    @EnvironmentObject var authManager: AuthManager
    
    var body: some View {
        NavigationView {
            VStack(spacing: 20) {
                Text("ダッシュボード")
                    .font(.largeTitle)
                    .fontWeight(.bold)
                
                if let user = authManager.user {
                    Text("ようこそ、\(user.email ?? "ユーザー")さん")
                        .font(.headline)
                }
                
                NavigationLink(destination: ProfileView()) {
                    Text("プロファイル表示")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                
                Button(action: {
                    authManager.logout()
                }) {
                    Text("ログアウト")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                
                Spacer()
            }
            .padding()
            .navigationTitle("ホーム")
        }
    }
}
