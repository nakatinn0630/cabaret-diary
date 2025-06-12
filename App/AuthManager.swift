import FirebaseAuth
import FirebaseFirestore

class AuthManager: ObservableObject {
    @Published var user: User?
    @Published var errorMessage: String?
    
    private let db = Firestore.firestore()
    
    init() {
        FirebaseConfig.configure()
        Auth.auth().addStateDidChangeListener { [weak self] (_, user) in
            self?.user = user
        }
    }
    
    func signUp(email: String, password: String, name: String) {
        Auth.auth().createUser(withEmail: email, password: password) { [weak self] result, error in
            if let error = error {
                self?.errorMessage = error.localizedDescription
                return
            }
            
            guard let uid = result?.user.uid else { return }
            
            self?.db.collection("users").document(uid).setData([
                "name": name,
                "email": email,
                "createdAt": Timestamp(date: Date())
            ]) { error in
                if let error = error {
                    self?.errorMessage = "プロファイル保存エラー: \(error.localizedDescription)"
                }
            }
        }
    }
    
    func login(email: String, password: String) {
        Auth.auth().signIn(withEmail: email, password: password) { [weak self] _, error in
            if let error = error {
                self?.errorMessage = error.localizedDescription
            }
        }
    }
    
    func logout() {
        do {
            try Auth.auth().signOut()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
