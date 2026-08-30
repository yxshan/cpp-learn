#include <iostream>
#include <memory>
#include <string>

struct Session {
    int id;
    std::string user;
};

int main() {
    const auto session = std::make_shared<Session>(Session{7, "lin"});
    const std::shared_ptr<int> id(session, &session->id);

    std::cout << "id=" << *id << '\n';
    std::cout << "owners=" << session.use_count() << '\n';
}
