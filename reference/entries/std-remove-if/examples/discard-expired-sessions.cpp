#include <algorithm>
#include <iostream>
#include <string>
#include <vector>

struct Session {
    std::string id;
    bool expired;
};

int main() {
    std::vector<Session> sessions{{"a1", false}, {"b2", true}, {"c3", false}};
    const auto new_end = std::remove_if(
        sessions.begin(), sessions.end(),
        [](const Session& session) { return session.expired; });
    sessions.erase(new_end, sessions.end());

    for (const Session& session : sessions) {
        std::cout << "active=" << session.id << '\n';
    }
}
