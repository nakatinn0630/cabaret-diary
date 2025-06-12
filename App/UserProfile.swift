import FirebaseFirestoreSwift

struct UserProfile: Identifiable, Codable {
    @DocumentID var id: String?
    let name: String
    let email: String
    let createdAt: Date
}
