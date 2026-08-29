#include <iostream>
#include <string>
#include <unordered_map>

int main() {
    std::unordered_map<std::string, int> counts;

    for (const std::string event : {"login", "logout", "login"}) {
        ++counts[event];
    }

    std::cout << "login=" << counts.at("login") << '\n';
    std::cout << "logout=" << counts.at("logout") << '\n';
}
