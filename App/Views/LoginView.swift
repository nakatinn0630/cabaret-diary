import SwiftUI

struct LoginView: View {
    @StateObject private var auth = AuthManager()
    @State private var email = ""
    @State private var password = ""
    
    var body: some View {
        VStack(spacing: 20) {
            TextField("メールアドレス", text: $email)
                .textFieldStyle(.roundedBorder)
                .autocapitalization(.none)
            
            SecureField("パスワード", text: $password)
                .textFieldStyle(.roundedBorder)
            
            Button(action: login) {
                Text("ログイン")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            
            Button(action: signUp) {
                Text("新規登録")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
            
            if let error = auth.errorMessage {
                Text(error)
                    .foregroundColor(.red)
            }
        }
        .padding()
    }
    
    private func login() {
        auth.login(email: email, password: password)
    }
    
    private func signUp() {
        auth.signUp(email: email, password: password, name: "新規ユーザー")
    }
}
