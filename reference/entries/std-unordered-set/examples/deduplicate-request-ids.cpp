#include <iostream>
#include <string>
#include <unordered_set>
#include <vector>

int main() {
    const std::vector<std::string> requests{"req-2", "req-7", "req-2"};
    std::unordered_set<std::string> seen;

    for (const std::string& request : requests) {
        const auto [position, inserted] = seen.insert(request);
        std::cout << (inserted ? "accepted=" : "duplicate=") << *position
                  << '\n';
    }
    std::cout << "unique=" << seen.size() << '\n';
}
