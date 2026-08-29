#include <iostream>
#include <string>
#include <unordered_set>

int main() {
    const std::unordered_set<std::string> roles{"admin", "editor"};
    std::cout << std::boolalpha;
    std::cout << "admin=" << roles.contains("admin") << '\n';
    std::cout << "guest=" << roles.contains("guest") << '\n';
}
