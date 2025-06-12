import SwiftUI
import FirebaseFirestore

struct ProfileView: View {
    @EnvironmentObject var authManager: AuthManager
    @State private var userProfile: UserProfile?
    @State private var isLoading = true
    
    private let db = Firestore.firestore()
    
    var body: some View {
        VStack(spacing: 20) {
            if isLoading {
                ProgressView("プロファイル読み込み中...")
            } else if let profile = userProfile {
                VStack(alignment: .leading, spacing: 10) {
                    Text("ユーザー情報")
                        .font(.largeTitle)
                        .fontWeight(.bold)
                    
                    HStack {
                        Text("名前:")
                            .fontWeight(.semibold)
                        Text(profile.name)
                    }
                    
                    HStack {
                        Text("メールアドレス:")
                            .fontWeight(.semibold)
                        Text(profile.email)
                    }
                    
                    HStack {
                        Text("登録日:")
                            .fontWeight(.semibold)
                        Text(profile.createdAt, style: .date)
                    }
                }
                .padding()
                .background(Color.gray.opacity(0.1))
                .cornerRadius(10)
            } else {
                Text("プロファイル情報を取得できませんでした")
                    .foregroundColor(.red)
            }
            
            Spacer()
        }
        .padding()
        .navigationTitle("プロファイル")
        .onAppear {
            loadUserProfile()
        }
    }
    
    private func loadUserProfile() {
        guard let uid = authManager.user?.uid else { return }
        
        db.collection("users").document(uid).getDocument { document, error in
            isLoading = false
            
            if let error = error {
                print("プロファイル取得エラー: \(error.localizedDescription)")
                return
            }
            
            if let document = document, document.exists {
                do {
                    userProfile = try document.data(as: UserProfile.self)
                } catch {
                    print("プロファイルデコードエラー: \(error.localizedDescription)")
                }
            }
        }
    }
}
